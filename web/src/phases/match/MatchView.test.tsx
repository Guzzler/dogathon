import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, ApplicationStatus, ChecklistItem, Dog, Foster, Pickup } from "../../types";

/**
 * The screen RS-11 changed, rendered.
 *
 * `applicationView.test.ts` covers the precedence as arithmetic; this covers what a foster
 * actually sees, which is where the two ways of being wrong live: a declined application
 * still offering a pickup, and an *absent* one being mistaken for a declined one. Neither
 * can be reached by driving the app -- `status` only ever arrives from Firestore, and a
 * `LOCAL_MODE` or guest journey has no application document at all, so a browser walkthrough
 * exercises exactly one of the four cases below.
 *
 * Rendered with `renderToStaticMarkup` rather than a DOM testing library, matching
 * `lib/markdown.test.tsx`: this asserts what is on the page, not what happens when you click
 * it, and that needs no jsdom and no new dependency.
 */

const foster = vi.hoisted(() => ({ current: null as Foster | null }));
const application = vi.hoisted(() => ({ current: null as Application | null }));
const dogStatus = vi.hoisted(() => ({ current: "available" as Dog["status"] }));

vi.mock("../../hooks/useFoster", () => ({
  useFoster: () => ({ foster: foster.current, loading: false }),
  patchFoster: vi.fn(),
}));
vi.mock("../../hooks/useDogs", () => ({
  useDogs: () => ({ dogs: [{ ...DOG, status: dogStatus.current }], loading: false }),
}));
vi.mock("../../hooks/useApplication", () => ({
  useApplication: () => ({ application: application.current, loading: false }),
}));

const { MatchView } = await import("./MatchView");

const DOG: Dog = {
  id: "dog-1",
  name: "Tip Toe",
  breed: "Retriever",
  age_years: 1.5,
  status: "available",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
  foster_weeks: 6,
  shelter: {
    id: "sfspca-mission",
    name: "SF SPCA Mission Campus",
    short: "SF SPCA",
    address: "201 Alabama St",
    lat: 37.7,
    lng: -122.4,
  },
};

const item = (id: string, label: string, owner: "foster" | "shelter", done: boolean): ChecklistItem =>
  ({ id, label, owner, done });

const CHECKLIST = (done: boolean) => [
  item("application", "Foster application submitted", "foster", done),
  item("home-check", "Home environment check", "shelter", done),
];

function screen(opts: {
  status?: ApplicationStatus;
  checklistDone?: boolean;
  pickup?: Pickup | null;
  /** The application's own copy of the request, and the shelter's answer to it (RS-14). */
  appPickup?: Pickup | null;
  confirmed?: boolean;
  /** The shelter's other answer (RS-15), and what staff typed with it. */
  declined?: boolean;
  note?: string | null;
  /** The dog's listing (RS-18): `foster` once staff confirmed somebody's pickup. */
  dogStatus?: Dog["status"];
}): string {
  dogStatus.current = opts.dogStatus ?? "available";
  const list = CHECKLIST(opts.checklistDone ?? false);
  foster.current = {
    id: "f1",
    name: "Demo",
    phase: "match",
    intake: {},
    likedDogIds: [],
    passedDogIds: [],
    matchedDogId: "dog-1",
    approvalChecklist: list,
    prepChecklist: [item("crate", "Crate", "foster", false)],
    careChecklist: [],
    pickup: opts.pickup ?? null,
    readyForAdoption: false,
  } as Foster;
  application.current = opts.status
    ? ({ id: "a1", fosterId: "f1", fosterName: "Demo", dogId: "dog-1", shelterId: "sfspca-mission",
         status: opts.status, checklist: list, pickup: opts.appPickup ?? null,
         pickupConfirmedAt: opts.confirmed ? { toMillis: () => 1 } : null,
         pickupDeclinedAt: opts.declined ? { toMillis: () => 1 } : null,
         pickupNote: opts.note ?? null } as Application)
    : null;
  return renderToStaticMarkup(
    <MemoryRouter>
      <MatchView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  foster.current = null;
  application.current = null;
});

describe("MatchView, once the shelter has decided", () => {
  it("falls back to the checklist when there is no application document at all", () => {
    // A guest, LOCAL_MODE, or any record predating the collection -- the only case a browser
    // walkthrough can reach, and the one where reading absence as a decline would be worst.
    const html = screen({});
    expect(html).toContain("Waiting on shelter review");
    expect(html).not.toContain("said no this time");
    expect(html).toContain("Request a pickup");
  });

  it("still says the shelter approved you when only its own steps are ticked", () => {
    const html = screen({ checklistDone: true });
    expect(html).toContain("Shelter approved you as a foster");
  });

  it("replaces a fully-ticked checklist's badge and screen when the application is declined", () => {
    // The case the whole precedence exists for: before RS-11 this rendered
    // "Approved — schedule pickup" on an application that had been refused.
    // (The copy is "Request a pickup" since PH-23; the point of the case is unchanged.)
    const html = screen({ status: "declined", checklistDone: true });
    expect(html).toContain("couldn&#x27;t approve this application");
    expect(html).toContain("said no this time");
    expect(html).toContain("Browse other dogs");
    // The checklist, the scheduler and the hand-off to Care Plan are all gone.
    expect(html).not.toContain("Request a pickup");
    expect(html).not.toContain("Get ready at home");
    expect(html).not.toContain("start Care Plan");
  });

  it("declines loudly even when the foster has done nothing yet", () => {
    const html = screen({ status: "declined", checklistDone: false });
    expect(html).toContain("said no this time");
    expect(html).not.toContain("Request a pickup");
  });

  it("shows an approval on the badge without unlocking the scheduler", () => {
    // Approving early means the decision is made and the paperwork isn't. A scheduler at
    // that moment books a slot for a home visit that hasn't happened.
    const html = screen({ status: "approved", checklistDone: false });
    expect(html).toContain("SF SPCA approved your application");
    expect(html).toContain("🔒 Request a pickup");
    expect(html).toContain("Get ready at home");
  });

  it("leaves the two in-progress statuses reading exactly as they did before", () => {
    for (const status of ["submitted", "in_review"] as ApplicationStatus[]) {
      const html = screen({ status });
      expect(html).toContain("Waiting on shelter review");
      expect(html).not.toContain("said no this time");
    }
  });
});

/**
 * PH-23. What this screen is allowed to say about a pickup.
 *
 * Nothing had ever told Pawthway a shelter's opening days, appointment times or notice period,
 * and the screen printed all three under a real organisation's real street address. These cases
 * pin the absence: a claim that is gone needs a test, or the next person to write warm copy puts
 * it back. They are rendered rather than driven, so what they prove is the markup -- a dev server
 * cannot be started from the unattended run that wrote them.
 */
describe("MatchView, on what it knows about the shelter's availability", () => {
  it("does not tell the foster which days the shelter is closed", () => {
    const html = screen({ checklistDone: true });
    expect(html).not.toContain("Closed Sundays");
    expect(html).not.toContain("Closed Sunday");
    // ...and says instead that it doesn't know, in the one shared phrasing (PH-22's Unrecorded).
    expect(html).toContain("opening days and times not recorded");
  });

  it("asks for a time rather than offering one", () => {
    const html = screen({ checklistDone: true });
    expect(html).toContain("Request a pickup");
    expect(html).not.toContain("Schedule pickup");
    // The window is the app's, in the app's own voice -- never "shelters need".
    expect(html).toContain("Pawthway takes requests");
    expect(html).not.toContain("shelters need");
  });

  it("calls a requested slot requested, on the card and on the timeline", () => {
    const html = screen({
      checklistDone: true,
      pickup: { date: "2099-06-12", time: "1:30 PM", location: "201 Alabama St" },
    });
    expect(html).toContain("Pickup requested");
    expect(html).toContain("hasn&#x27;t confirmed it");
    // RS-14: the card no longer sends the foster to a chat to "agree the day" with the shelter.
    expect(html).not.toContain("agree the day");
    expect(html).not.toContain("Message SF SPCA");
    expect(html).toContain("Change request");
    // The last stage is *reached* and never ticked: activeStage() returns 3, so exactly the
    // three before it carry data-done. A fourth would be the screen answering for the shelter.
    expect(html.match(/data-done="true"/g)?.length).toBe(3);
    expect(html).toContain('data-now="true"');
  });

  it("still keeps the scheduler locked until both sides have finished", () => {
    const html = screen({ checklistDone: false });
    expect(html).toContain("🔒 Request a pickup");
  });
});

/**
 * RS-14. The request now reaches the shelter, and only the shelter's write says "confirmed".
 */
describe("MatchView, on whether the shelter has answered the request", () => {
  const SLOT: Pickup = { date: "2099-06-12", time: "1:30 PM", location: "201 Alabama St" };

  it("reads requested while the application holds the slot unconfirmed", () => {
    const html = screen({ status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT });
    expect(html).toContain("Pickup requested");
    expect(html).toContain("hasn&#x27;t confirmed it yet");
    expect(html).not.toContain("confirmed this time");
    expect(html.match(/data-done="true"/g)?.length).toBe(3);
  });

  it("reads confirmed once staff stamped the same slot, and ticks every stage", () => {
    const html = screen({ status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT, confirmed: true });
    expect(html).toContain("Pickup confirmed");
    expect(html).toContain("SF SPCA confirmed this time");
    expect(html).not.toContain("hasn&#x27;t confirmed it");
    expect(html.match(/data-done="true"/g)?.length).toBe(5);
    expect(html).not.toContain('data-now="true"');
  });

  it("stays requested when the stamp is on a different slot than the foster holds", () => {
    const html = screen({
      status: "approved", checklistDone: true, pickup: SLOT,
      appPickup: { ...SLOT, time: "3:00 PM" }, confirmed: true,
    });
    expect(html).toContain("hasn&#x27;t confirmed it yet");
    expect(html).not.toContain("confirmed this time");
  });

  it("titles the chat as Pawthway's, never as the shelter", () => {
    const html = screen({ status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT });
    expect(html).toContain("Ask Pawthway about pickup");
    expect(html).not.toContain("Message SF SPCA");
    expect(html).not.toContain("Confirm the day");
  });
});

/**
 * RS-15. The handoff happens on the shelter's say-so: Care Plan waits for a confirmation, and a
 * shelter that can't make the slot can say so -- in its own words, attributed, never stood in for.
 */
describe("MatchView, on who gets to say the dog is coming home", () => {
  const SLOT: Pickup = { date: "2099-06-12", time: "1:30 PM", location: "201 Alabama St" };
  const startButton = (html: string) => html.match(/<button[^>]*>I&#x27;ve got Tip Toe → start Care Plan/)?.[0] ?? "";

  it("keeps Care Plan shut on a request the shelter hasn't answered", () => {
    const button = startButton(screen({ status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT }));
    expect(button).toContain("disabled");
    expect(button).toContain("Waiting for SF SPCA to confirm pickup");
  });

  it("opens Care Plan once the shelter confirmed the slot", () => {
    const button = startButton(screen({ status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT, confirmed: true }));
    expect(button).not.toBe("");
    expect(button).not.toContain("disabled");
  });

  it("lets a request stand when there is no application -- nobody could answer it", () => {
    const button = startButton(screen({ checklistDone: true, pickup: SLOT }));
    expect(button).not.toBe("");
    expect(button).not.toContain("disabled");
  });

  it("shows the shelter's note attributed, and reopens the calendar", () => {
    const html = screen({
      status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT,
      declined: true, note: "Short-staffed that day. Any weekday afternoon works.",
    });
    expect(html).toContain("SF SPCA asked for a different time");
    expect(html).toContain("Short-staffed that day. Any weekday afternoon works.");
    expect(html).toContain("From SF SPCA</div>");
    expect(html).toContain("Pick another time");
    // The scheduler is back, and the old card's own actions are not.
    expect(html).toContain("Pawthway takes requests");
    expect(html).not.toContain("Change request");
    expect(html).not.toContain("confirmed this time");
    expect(startButton(html)).toContain("disabled");
  });

  it("says nothing in the shelter's place when it left no note", () => {
    const html = screen({
      status: "approved", checklistDone: true, pickup: SLOT, appPickup: SLOT, declined: true,
    });
    expect(html).toContain("SF SPCA asked for a different time");
    expect(html).not.toContain("From SF SPCA</div>");
    expect(html).not.toContain("<blockquote");
  });
});

describe("MatchView, once the dog has gone home with another foster (RS-18)", () => {
  const SLOT: Pickup = { date: "2026-10-03", time: "11:00", location: "SF SPCA Mission Campus" };

  it("states the listing, keeps the scheduler, and does not read as a decline", () => {
    const html = screen({ status: "approved", checklistDone: true, dogStatus: "foster" });
    expect(html).toContain("Tip Toe is listed as in a foster home at SF SPCA. They haven&#x27;t confirmed a pickup");
    expect(html).not.toContain("said no this time");
    expect(html).toContain("Pawthway takes requests");
  });

  it("keeps Change request for the holder whose own change cleared the stamp (RS-19)", () => {
    // The foster side can't tell this from someone else's applicant, so it must strand neither.
    const html = screen({ status: "approved", checklistDone: true, dogStatus: "foster", pickup: SLOT, appPickup: SLOT });
    expect(html).toContain("listed as in a foster home");
    expect(html).toContain("Change request");
    expect(html).not.toContain("another foster home");
  });

  it("never shows on the foster's own confirmed pickup", () => {
    const html = screen({
      status: "approved", checklistDone: true, dogStatus: "foster", pickup: SLOT, appPickup: SLOT, confirmed: true,
    });
    expect(html).not.toContain("listed as in a foster home");
    expect(html).toContain("confirmed this time");
  });
});

describe("MatchView, once the shelter takes the dog off its roster (RS-20)", () => {
  const SLOT: Pickup = { date: "2026-10-03", time: "11:00", location: "SF SPCA Mission Campus" };

  it("states the listing, offers no scheduler, and points at withdrawing", () => {
    const html = screen({ status: "approved", checklistDone: true, dogStatus: "retired" });
    expect(html).toContain("Tip Toe isn&#x27;t listed by SF SPCA right now. They haven&#x27;t answered your application yet.");
    expect(html).not.toContain("Pawthway takes requests");
    expect(html).not.toContain("Request a pickup<");
    expect(html).toContain("withdraw this application from Saved");
    expect(html).not.toContain("said no this time");
  });

  it("keeps an existing request visible but offers no Change request", () => {
    const html = screen({ status: "approved", checklistDone: true, dogStatus: "retired", pickup: SLOT, appPickup: SLOT });
    expect(html).toContain("The time you asked for.");
    expect(html).not.toContain("Change request");
  });

  it("says nothing for a listed dog", () => {
    const html = screen({ status: "approved", checklistDone: true, dogStatus: "available" });
    expect(html).not.toContain("isn&#x27;t listed by");
    expect(html).toContain("Pawthway takes requests");
  });

  it("leaves the holder's own confirmed pickup on an adopted dog alone", () => {
    const html = screen({
      status: "approved", checklistDone: true, dogStatus: "adopted", pickup: SLOT, appPickup: SLOT, confirmed: true,
    });
    expect(html).not.toContain("isn&#x27;t listed by");
    expect(html).toContain("confirmed this time");
  });
});
