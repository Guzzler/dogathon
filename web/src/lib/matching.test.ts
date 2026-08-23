import { describe, expect, it } from "vitest";
import type { Dog, FosterIntake } from "../types";
import { normalizeDog } from "./dog";
import { matchReasons, scoreDog } from "./matching";

/**
 * The score is a pile of hand-tuned constants, so testing exact numbers would just restate
 * them. What's worth protecting is the shape: the clamp holds, a rule only fires for the
 * home it belongs to, a dealbreaker actually breaks the deal, and the "Why you match" copy
 * never claims something the dog's record doesn't say.
 */

const BASE: Dog = {
  id: "biscuit",
  name: "Biscuit",
  breed: "Beagle mix",
  age_years: 3,
  weight_lbs: 30, // medium, so the size term is neutral at the default pref_size of 50
  status: "available",
  intake_date: "2026-01-04",
  good_with_kids: true,
  good_with_dogs: true,
  notes: "",
  shelter_id: "sfspca",
  good_with_cats: true,
  energy_level: 2,
  grooming: "low",
  coat: "short",
  traits: [],
  needs: [],
  foster_weeks: 6,
};

const dog = (over: Partial<Dog> = {}) => normalizeDog({ ...BASE, ...over });

describe("scoreDog", () => {
  it("stays inside the 4–99 band at both extremes", () => {
    const mismatch: FosterIntake = {
      pref_size: 0,
      pref_energy: 0,
      pref_home: "apartment",
      pref_experience: "first",
      pref_tags: ["puppy", "groomLow", "coatShort", "kidsGood", "withDogs", "withCats"],
    };
    const wrongDog = dog({
      weight_lbs: 80,
      energy_level: 4,
      grooming: "high",
      coat: "long",
      good_with_kids: false,
      good_with_dogs: false,
      good_with_cats: false,
      needs: ["Needs a fenced yard"],
    });
    expect(scoreDog(wrongDog, mismatch)).toBe(4);

    const ideal: FosterIntake = {
      pref_size: 50,
      pref_energy: 3,
      pref_home: "houseYard",
      pref_experience: "experienced",
      pref_tags: ["adult", "groomLow", "coatShort", "kidsGood", "withDogs", "withCats"],
    };
    expect(scoreDog(dog({ energy_level: 3 }), ideal)).toBe(99);
  });

  it("ranks a dog at the foster's pace above one two levels off it", () => {
    const intake: FosterIntake = { pref_energy: 2 };
    expect(scoreDog(dog({ energy_level: 2 }), intake)).toBeGreaterThan(scoreDog(dog({ energy_level: 4 }), intake));
  });

  it("only charges for a yard requirement when there is no yard", () => {
    const needsYard = dog({ needs: ["Needs a securely fenced yard"] });
    const apartment: FosterIntake = { pref_home: "apartment" };
    const house: FosterIntake = { pref_home: "houseYard" };

    expect(scoreDog(needsYard, apartment)).toBeLessThan(scoreDog(dog(), apartment));
    expect(scoreDog(needsYard, house)).toBe(scoreDog(dog(), house));
  });

  it("treats a must-have tag the dog fails as worse than not asking at all", () => {
    const noCats = dog({ good_with_cats: false });
    expect(scoreDog(noCats, { pref_tags: ["withCats"] })).toBeLessThan(scoreDog(noCats, {}));
  });
});

describe("matchReasons", () => {
  it("never credits the dog with a trait its record doesn't claim", () => {
    const reasons = matchReasons(dog({ good_with_cats: false, good_with_kids: false }), {
      pref_tags: ["withCats", "kidsGood"],
    });
    expect(reasons.some(r => /cat|kid/i.test(r))).toBe(false);
  });

  it("distinguishes an exact energy match from a near one", () => {
    const intake: FosterIntake = { pref_energy: 2 };
    expect(matchReasons(dog({ energy_level: 2 }), intake)).toContain("Medium energy, exactly the pace you picked");
    expect(matchReasons(dog({ energy_level: 3 }), intake)).toContain("High energy, close to your pace");
  });

  it("caps the list at four so the card can't overflow", () => {
    const everything: FosterIntake = {
      pref_size: 50,
      pref_energy: 2,
      pref_home: "apartment",
      pref_experience: "first",
      pref_tags: ["adult", "groomLow", "kidsGood", "withDogs", "withCats"],
    };
    expect(matchReasons(dog(), everything)).toHaveLength(4);
  });
});
