import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Dog } from "../../types";

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

vi.mock("../../hooks/useStaffShelters", () => ({
  useMyShelters: () => [{ id: "sfspca-mission", name: "SF SPCA Mission Campus", address: "", staffUids: [] }],
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

const render = (roster: Dog[]) => {
  dogs.current = roster;
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

  it("renders no heading at all on a roster with nobody in foster", () => {
    const html = render([dog({ id: "a" }), dog({ id: "c", status: "retired" })]);
    expect(html).not.toContain("Back from foster");
    expect(html).toContain(">Listed<");
    expect(html).toContain("Not listed");
  });
});
