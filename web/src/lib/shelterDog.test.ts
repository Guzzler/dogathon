import { describe, expect, it } from "vitest";
import {
  EMPTY_DOG_FORM,
  MANUAL_SOURCE,
  dogFromForm,
  dogIdFor,
  isHttpsUrl,
  rosterAction,
  validateDogForm,
  type DogFormValues,
} from "./shelterDog";
import { dogPhotoOrNull, normalizeDog } from "./dog";

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

describe("rosterAction", () => {
  it("offers retire for anything still on the roster and relist for a retired dog", () => {
    expect(rosterAction("available")).toBe("retire");
    expect(rosterAction("foster")).toBe("retire");
    expect(rosterAction("medical_hold")).toBe("retire");
    expect(rosterAction("retired")).toBe("relist");
  });

  it("offers nothing for an adopted dog -- that is not a checkbox to reopen", () => {
    expect(rosterAction("adopted")).toBeNull();
  });
});
