import { describe, expect, it } from "vitest";
import type { Dog } from "../types";
import { normalizeDog, recordedStay } from "./dog";

/**
 * PH-22. `normalizeDog()` fills three holes so a card can lay itself out, and the question
 * these tests protect is not *what* it fills them with — it is whether the fact that it had to
 * survives the filling. Every dog in the committed roster is missing `foster_weeks`, so the
 * `fosterWeeks` half of this is the real roster's normal case, not an edge one.
 */

const BASE: Dog = {
  id: "biscuit",
  name: "Biscuit",
  breed: "Beagle mix",
  age_years: 3,
  status: "available",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
};

const bare = (over: Partial<Dog> = {}) => normalizeDog({ ...BASE, ...over });

describe("normalizeDog's derived flags", () => {
  it("flags all three when the record carries none of them", () => {
    const d = bare();
    expect(d.derived).toEqual({ fosterWeeks: true, size: true, energyLevel: true });
    // The values are still there — layout needs them; only the provenance is new.
    expect(d.size).toBe("medium");
    expect(d.fosterLength).toBe("6 weeks");
    expect(typeof d.energyLevel).toBe("number");
  });

  it("flags none when the shelter recorded all three", () => {
    expect(bare({ foster_weeks: 4, size: "large", energy_level: 1 }).derived).toEqual({
      fosterWeeks: false,
      size: false,
      energyLevel: false,
    });
  });

  it("counts a bucketed weight as recorded — restating a weight is not inventing a size", () => {
    const d = bare({ weight_lbs: 60 });
    expect(d.size).toBe("large");
    expect(d.derived.size).toBe(false);
  });

  it("counts legacy free text as recorded — someone wrote '4–6 weeks'", () => {
    const d = bare({ foster_length: "4–6 weeks" });
    expect(d.fosterWeeks).toBe(5);
    expect(d.derived.fosterWeeks).toBe(false);
  });

  it("treats energy 0 as recorded — a couch potato is an answer, not an absence", () => {
    expect(bare({ energy_level: 0 }).derived.energyLevel).toBe(false);
  });
});

describe("recordedStay", () => {
  it("hands fosterWindow nothing to count when nobody recorded a stay", () => {
    expect(recordedStay(bare())).toEqual([null, null]);
  });

  it("hands it the weeks and the label when someone did", () => {
    expect(recordedStay(bare({ foster_weeks: 8 }))).toEqual([8, "2 months"]);
  });
});
