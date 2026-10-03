import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Application, Dog } from "../../types";

/**
 * The screen RS-12 added, rendered.
 *
 * `lib/shelterDog.test.ts` covers the grouping and the actions as arithmetic; this covers
 * what a staff member actually sees, which is the half that cannot be reached by driving the
 * app. `ready_for_adoption` is only ever written by the agent's
 * `send_adoption_profile_to_shelter` through the Admin SDK at the very end of a completed
 * foster journey, so no browser walkthrough short of running one end to end produces a dog in
 * this state -- and the whole point of the group is that it renders a paragraph that
 * previously reached no human at all.
 *
 * `renderToStaticMarkup` rather than a DOM testing library, matching `MatchView.test.tsx`:
 * this asserts what is on the page, not what happens when you click it.
 */

const dogs = vi.hoisted(() => ({ current: [] as Dog[] }));
const applications = vi.hoisted(() => ({ current: [] as Application[] }));

vi.mock("../../hooks/useStaffShelters", () => ({
  useMyShelters: () => [{ id: "sfspca-mission", name: "SF SPCA Mission Campus", address: "", staffUids: [] }],
}));
vi.mock("../../hooks/useShelterApplications", () => ({
  useShelterApplications: () => ({ result: { state: "ready", applications: applications.current }, retry: vi.fn() }),
}));
vi.mock("../../hooks/useShelterDogs", () => ({
  useShelterDogs: () => ({ result: { state: "ready", dogs: dogs.current }, retry: vi.fn() }),
}));
// Never actually reached -- the writes are behind a click -- but importing the module pulls
// in `firebase.ts`, which a clone with no `web/.env` cannot construct.
vi.mock("../../lib/shelterRoster", () => ({
  addShelterDog: vi.fn(),
  applyRosterAction: vi.fn(),
}));

const { ShelterRosterView } = await import("./ShelterRosterView");

const dog = (over: Partial<Dog> & { id: string }): Dog => ({
  name: "Tip Toe",
  breed: "Retriever",
  age_years: 2,
  status: "available",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
  shelter_id: "sfspca-mission",
  ...over,
});

const render = (roster: Dog[], open: Application[] = []) => {
  dogs.current = roster;
  applications.current = open;
  return renderToStaticMarkup(<ShelterRosterView />);
};

const PROFILE =
  "Tip Toe spent six weeks learning that couches are for sitting on, not shredding. " +
  "She sleeps through the night and walks past skateboards without flinching.";

describe("ShelterRosterView — back from foster", () => {
  it("renders the returned dog first, above the listed ones", () => {
    const html = render([
      dog({ id: "a", name: "Arlo" }),
      dog({ id: "b", name: "Bean", status: "ready_for_adoption", adoption_profile: PROFILE }),
    ]);
    expect(html.indexOf("Back from foster")).toBeGreaterThan(-1);
    expect(html.indexOf("Back from foster")).toBeLessThan(html.indexOf(">Listed<"));
  });

  it("renders the whole profile, not a truncation of it", () => {
    const html = render([dog({ id: "b", status: "ready_for_adoption", adoption_profile: PROFILE })]);
    // The last clause matters as much as the first: a card that cut this off would be a
    // second way of not showing the shelter what the foster wrote.
    expect(html).toContain("walks past skateboards without flinching.");
  });

  it("offers the two honest moves and never Retire", () => {
    const html = render([dog({ id: "b", status: "ready_for_adoption", adoption_profile: PROFILE })]);
    expect(html).toContain("List for adoption");
    expect(html).toContain("Mark adopted");
    expect(html).not.toContain(">Retire<");
  });

  it("says so rather than rendering a blank card when no profile came back", () => {
    const html = render([dog({ id: "b", status: "ready_for_adoption" })]);
    expect(html).toContain("No write-up came back with them");
    expect(html).toContain("Mark adopted");
  });

  // PH-21. Staff decide from this paragraph whether a real animal gets listed, and until
  // now it rendered bare -- indistinguishable from something the shelter itself recorded.
  it("says the assistant drafted it", () => {
    const html = render([
      dog({ id: "b", status: "ready_for_adoption", adoption_profile: PROFILE, adoption_profile_source: "agent" }),
    ]);
    expect(html).toContain("Drafted by the Pawthway assistant");
  });

  it("reads as a retraction, not a description, once the foster withdraws it", () => {
    const html = render([
      dog({
        id: "b",
        status: "ready_for_adoption",
        adoption_profile: "The foster withdrew this write-up. In their words: she is scared of cats.",
        adoption_profile_source: "foster_withdrawn",
      }),
    ]);
    expect(html).toContain("no longer a description of the dog");
    // The status is RS-12's arrival state and a withdrawal never touches it, so the card
    // still offers both moves -- staff decide, with the retraction in front of them.
    expect(html).toContain("List for adoption");
  });

  it("renders no heading at all on a roster with nobody in foster", () => {
    const html = render([dog({ id: "a" }), dog({ id: "c", status: "retired" })]);
    expect(html).not.toContain("Back from foster");
    expect(html).toContain(">Listed<");
    expect(html).toContain("Not listed");
  });
});

describe("ShelterRosterView — in foster (RS-17)", () => {
  it("puts a dog out with a foster under its own heading, between Back from foster and Listed", () => {
    const html = render([
      dog({ id: "a", name: "Arlo" }),
      dog({ id: "f", name: "Fern", status: "foster" }),
      dog({ id: "b", name: "Bean", status: "ready_for_adoption", adoption_profile: PROFILE }),
    ]);
    const inFoster = html.indexOf(">In foster<");
    expect(inFoster).toBeGreaterThan(html.indexOf("Back from foster"));
    expect(inFoster).toBeLessThan(html.indexOf(">Listed<"));
    // Not beside retired dogs: nobody took Fern down, she's away.
    expect(html).not.toContain("Not listed");
    expect(html).toContain("List again");
  });

  it("omits the group when nobody is in foster", () => {
    expect(render([dog({ id: "a" })])).not.toContain(">In foster<");
  });
});

describe("ShelterRosterView — taking a dog down says who is still waiting (RS-20)", () => {
  const app = (id: string, dogId: string, status: Application["status"]) =>
    ({ id, dogId, status, fosterId: "u", fosterName: "Robin", shelterId: "sfspca-mission" }) as Application;

  it("counts only live applications beside Retire", () => {
    const html = render(
      [dog({ id: "a", name: "Arlo" })],
      [app("1", "a", "submitted"), app("2", "a", "approved"), app("3", "a", "withdrawn")],
    );
    expect(html).toContain("2 open applications");
    expect(html).toContain("each foster will see Arlo isn");
    expect(html).toContain(">Retire<");
  });

  it("says nothing for a dog nobody has applied to, or only a closed application", () => {
    expect(render([dog({ id: "a" })])).not.toContain("open application");
    expect(render([dog({ id: "a" })], [app("1", "a", "declined")])).not.toContain("open application");
  });

  it("says it beside Mark adopted on a returned dog, and not on a dog already retired", () => {
    const returned = render(
      [dog({ id: "b", name: "Bean", status: "ready_for_adoption", adoption_profile: PROFILE })],
      [app("1", "b", "approved")],
    );
    expect(returned).toContain("1 open application —");
    expect(render([dog({ id: "c", status: "retired" })], [app("1", "c", "approved")])).not.toContain("open application");
  });
});
