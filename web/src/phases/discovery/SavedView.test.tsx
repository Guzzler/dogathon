import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Dog, DogStatus, Foster } from "../../types";

/**
 * PH-31: *not listed* means *not appliable*. A dog the foster saved while it was available can
 * later be retired, adopted or come back from another foster, and the Saved list still holds its
 * id -- so the card has to ask the same question Discovery does, not just whether the org exists.
 *
 * Rendered with `renderToStaticMarkup`, as `MatchView.test.tsx` is: this asserts which button a
 * foster is shown, which needs no jsdom and no new dependency.
 */

const dogs = vi.hoisted(() => ({ current: [] as Dog[] }));

vi.mock("../../hooks/useFoster", () => ({
  useFoster: () => ({ foster: FOSTER, loading: false }),
  patchFoster: vi.fn(),
}));
vi.mock("../../hooks/useDogs", () => ({
  useDogs: () => ({ dogs: dogs.current, loading: false }),
}));
vi.mock("../../hooks/useApplication", () => ({
  useApplication: () => ({ application: null, loading: false }),
}));

const { SavedView } = await import("./SavedView");

const FOSTER: Foster = {
  id: "f1",
  name: "Demo",
  phase: "discovery",
  intake: {},
  likedDogIds: ["dog-1"],
  passedDogIds: [],
  matchedDogId: null,
} as unknown as Foster;

const dog = (status: DogStatus, shelter_id = "sfspca-mission"): Dog => ({
  id: "dog-1",
  name: "Tip Toe",
  breed: "Retriever",
  age_years: 1.5,
  status,
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
  shelter_id,
});

function applyButton(d: Dog): string {
  dogs.current = [d];
  const html = renderToStaticMarkup(<MemoryRouter><SavedView /></MemoryRouter>);
  const button = html.match(/<button[^>]*>(Apply to foster|Not taking applications)<\/button>/);
  if (!button) throw new Error("no apply button rendered");
  return button[0];
}

describe("a saved dog is appliable only while it is listed (PH-31)", () => {
  it("offers Apply on an available dog at a known shelter", () => {
    const b = applyButton(dog("available"));
    expect(b).toContain("Apply to foster");
    expect(b).not.toContain("disabled");
  });

  for (const status of ["retired", "adopted", "ready_for_adoption", "foster", "medical_hold"] as const) {
    it(`shows no enabled Apply on a ${status} dog`, () => {
      const b = applyButton(dog(status));
      expect(b).toContain("Not taking applications");
      expect(b).toContain("disabled");
    });
  }

  it("shows no enabled Apply at an org we can't name", () => {
    const b = applyButton(dog("available", "petsun"));
    expect(b).toContain("Not taking applications");
    expect(b).toContain("disabled");
  });
});
