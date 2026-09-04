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

vi.mock("../../hooks/useFoster", () => ({
  useFoster: () => ({ foster: foster.current, loading: false }),
  patchFoster: vi.fn(),
}));
vi.mock("../../hooks/useDogs", () => ({
  useDogs: () => ({ dogs: [DOG], loading: false }),
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
}): string {
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
         status: opts.status, checklist: list, pickup: null } as Application)
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
    expect(html).toContain("Schedule pickup");
  });

  it("still says the shelter approved you when only its own steps are ticked", () => {
    const html = screen({ checklistDone: true });
    expect(html).toContain("Shelter approved you as a foster");
  });

  it("replaces a fully-ticked checklist's badge and screen when the application is declined", () => {
    // The case the whole precedence exists for: before RS-11 this rendered
    // "Approved — schedule pickup" on an application that had been refused.
    const html = screen({ status: "declined", checklistDone: true });
    expect(html).toContain("couldn&#x27;t approve this application");
    expect(html).toContain("said no this time");
    expect(html).toContain("Browse other dogs");
    // The checklist, the scheduler and the hand-off to Care Plan are all gone.
    expect(html).not.toContain("Schedule pickup");
    expect(html).not.toContain("Get ready at home");
    expect(html).not.toContain("start Care Plan");
  });

  it("declines loudly even when the foster has done nothing yet", () => {
    const html = screen({ status: "declined", checklistDone: false });
    expect(html).toContain("said no this time");
    expect(html).not.toContain("Schedule pickup");
  });

  it("shows an approval on the badge without unlocking the scheduler", () => {
    // Approving early means the decision is made and the paperwork isn't. A scheduler at
    // that moment books a slot for a home visit that hasn't happened.
    const html = screen({ status: "approved", checklistDone: false });
    expect(html).toContain("SF SPCA approved your application");
    expect(html).toContain("🔒 Schedule pickup");
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
