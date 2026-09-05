import { describe, expect, it } from "vitest";
import {
  EMPTY_DOG_FORM,
  MANUAL_SOURCE,
  dogFromForm,
  dogIdFor,
  ROSTER_ACTION_STATUS,
  groupRoster,
  isHttpsUrl,
  rosterActions,
  rosterGroup,
  validateDogForm,
  type DogFormValues,
} from "./shelterDog";
import { dogPhotoOrNull, normalizeDog } from "./dog";
import type { DogStatus } from "../types";

const NOW = "2026-09-01T00:00:00.000Z";

const filled = (over: Partial<DogFormValues> = {}): DogFormValues => ({
  ...EMPTY_DOG_FORM,
  name: "Luna",
  breed: "Mixed breed",
  ageYears: "3",
  weightLbs: "40",
  ...over,
});

describe("validateDogForm", () => {
  it("accepts the minimum a shelter actually knows", () => {
    expect(validateDogForm(filled())).toEqual({});
  });

  it("requires a name, a breed and an age", () => {
    const errors = validateDogForm(EMPTY_DOG_FORM);
    expect(Object.keys(errors).sort()).toEqual(["ageYears", "breed", "name", "size"]);
  });

  it("takes a size instead of a weight, but insists on one of them", () => {
    expect(validateDogForm(filled({ weightLbs: "", size: "small" }))).toEqual({});
    expect(validateDogForm(filled({ weightLbs: "", size: "" })).size).toBeTruthy();
  });

  it("rejects out-of-range numbers rather than clamping them", () => {
    expect(validateDogForm(filled({ ageYears: "40" })).ageYears).toBeTruthy();
    expect(validateDogForm(filled({ energy: "9" })).energy).toBeTruthy();
    expect(validateDogForm(filled({ fosterWeeks: "40" })).fosterWeeks).toBeTruthy();
    expect(validateDogForm(filled({ weightLbs: "0" })).weightLbs).toBeTruthy();
  });

  it("requires https for a photo link, and treats blank as fine", () => {
    expect(isHttpsUrl("https://example.org/a.jpg")).toBe(true);
    expect(isHttpsUrl("http://example.org/a.jpg")).toBe(false);
    expect(isHttpsUrl("example.org/a.jpg")).toBe(false);
    expect(validateDogForm(filled({ photoUrl: "" }))).toEqual({});
    expect(validateDogForm(filled({ photoUrl: "not a url" })).photoUrl).toBeTruthy();
  });
});

describe("dogFromForm", () => {
  it("produces the shape the scraper's to_dog() produces", () => {
    const dog = dogFromForm(filled(), "sfspca-mission", NOW);
    expect(dog).toMatchObject({
      name: "Luna",
      breed: "Mixed breed",
      age_years: 3,
      status: "available",
      weight_lbs: 40,
      size: "medium",
      shelter_id: "sfspca-mission",
      source: MANUAL_SOURCE,
      imported_at: NOW,
    });
  });

  it("leaves unrecorded compatibility as null, never false", () => {
    const dog = dogFromForm(filled({ goodWithDogs: "yes", goodWithKids: "no" }), "sfspca-mission", NOW);
    expect(dog.good_with_dogs).toBe(true);
    expect(dog.good_with_kids).toBe(false);
    expect(dog.good_with_cats).toBeNull();
  });

  it("omits optional fields rather than writing empty values", () => {
    const dog = dogFromForm(filled({ weightLbs: "", size: "small" }), "sfspca-mission", NOW);
    expect("weight_lbs" in dog).toBe(false);
    expect("energy_level" in dog).toBe(false);
    expect("foster_weeks" in dog).toBe(false);
    expect("photo_urls" in dog).toBe(false);
  });

  it("writes a pasted link straight into photo_urls, the field the scraper writes", () => {
    const dog = dogFromForm(filled({ photoUrl: " https://example.org/luna.jpg " }), "sfspca-mission", NOW);
    expect(dog.photo_urls).toEqual(["https://example.org/luna.jpg"]);
  });

  it("denormalises the shelter only when its coordinates are actually known", () => {
    expect(dogFromForm(filled(), "sfspca-mission", NOW).shelter?.id).toBe("sfspca-mission");
    expect(dogFromForm(filled(), "some-org-nobody-mapped", NOW).shelter).toBeUndefined();
  });

  it("never lets a hand-entered dog borrow a stock photo of another animal", () => {
    const blank = normalizeDog({ id: "x", ...dogFromForm(filled(), "sfspca-mission", NOW) });
    expect(dogPhotoOrNull(blank)).toBeNull();

    const withPhoto = normalizeDog({
      id: "y",
      ...dogFromForm(filled({ photoUrl: "https://example.org/luna.jpg" }), "sfspca-mission", NOW),
    });
    expect(dogPhotoOrNull(withPhoto)).toBe("https://example.org/luna.jpg");
  });

  it("still gives a seeded dog its placedog stand-in", () => {
    const seeded = normalizeDog({
      id: "seed-1",
      name: "Rex",
      breed: "Mixed breed",
      age_years: 2,
      status: "available",
      good_with_kids: null,
      good_with_dogs: null,
      notes: "",
    });
    expect(dogPhotoOrNull(seeded)).toContain("placedog.net");
  });
});

describe("dogIdFor", () => {
  it("namespaces by shelter so it can never collide with a scraped id", () => {
    expect(dogIdFor("sfspca-mission", "Luna Belle", "ab12")).toBe("sfspca-mission-manual-luna-belle-ab12");
  });

  it("survives a name with nothing url-safe in it", () => {
    expect(dogIdFor("acc", "?!", "zz99")).toBe("acc-manual-dog-zz99");
  });
});

describe("rosterActions", () => {
  it("offers retire for anything still on the roster and relist for a retired dog", () => {
    expect(rosterActions("available")).toEqual(["retire"]);
    expect(rosterActions("foster")).toEqual(["retire"]);
    expect(rosterActions("medical_hold")).toEqual(["retire"]);
    expect(rosterActions("retired")).toEqual(["relist"]);
  });

  it("offers nothing for an adopted dog -- that is not a checkbox to reopen", () => {
    expect(rosterActions("adopted")).toEqual([]);
  });

  // RS-12: the whole point. A dog handed back adoption-ready used to fall through to the
  // catch-all and be offered `Retire`, which says something the shelter doesn't mean.
  it("offers a returned dog the two honest moves, and never retire", () => {
    expect(rosterActions("ready_for_adoption")).toEqual(["list", "adopted"]);
    expect(rosterActions("ready_for_adoption")).not.toContain("retire");
  });

  it("covers every DogStatus, and every action lands on a real status", () => {
    const all: DogStatus[] = ["available", "foster", "medical_hold", "adopted", "ready_for_adoption", "retired"];
    for (const status of all) {
      const actions = rosterActions(status);
      expect(Array.isArray(actions)).toBe(true);
      for (const action of actions) expect(ROSTER_ACTION_STATUS[action]).toBeTruthy();
    }
    expect(ROSTER_ACTION_STATUS.list).toBe("available");
    expect(ROSTER_ACTION_STATUS.adopted).toBe("adopted");
  });
});

describe("rosterGroup / groupRoster", () => {
  it("puts a returned dog in its own group rather than the catch-all", () => {
    expect(rosterGroup("ready_for_adoption")).toBe("back");
    expect(rosterGroup("available")).toBe("listed");
    expect(rosterGroup("foster")).toBe("rest");
    expect(rosterGroup("medical_hold")).toBe("rest");
    expect(rosterGroup("adopted")).toBe("rest");
    expect(rosterGroup("retired")).toBe("rest");
  });

  it("splits a roster in one pass and keeps each group's order", () => {
    const roster = [
      { id: "a", status: "available" as DogStatus },
      { id: "b", status: "ready_for_adoption" as DogStatus },
      { id: "c", status: "retired" as DogStatus },
      { id: "d", status: "ready_for_adoption" as DogStatus },
      { id: "e", status: "available" as DogStatus },
    ];
    const groups = groupRoster(roster);
    expect(groups.back.map((d) => d.id)).toEqual(["b", "d"]);
    expect(groups.listed.map((d) => d.id)).toEqual(["a", "e"]);
    expect(groups.rest.map((d) => d.id)).toEqual(["c"]);
  });

  it("returns all three groups for an empty roster, so the view never reads undefined", () => {
    expect(groupRoster([])).toEqual({ back: [], listed: [], rest: [] });
  });
});
