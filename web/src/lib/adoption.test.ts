import { describe, expect, it } from "vitest";
import { buildAdoptionProfile } from "./adoption";
import { normalizeDog } from "./dog";
import type { CareLogEntry, Dog, Foster } from "../types";
import type { ScheduleBlock } from "../phases/careplan/types";

/**
 * The standard this file exists to hold: nothing on the adoption page is invented.
 *
 * These cases are written against a dog with *nothing* recorded, because that is the state a
 * real foster starts in and the state the page used to fill in for them — a demo dog's
 * vaccines, allergies and weigh-ins, printed under a provenance line saying the foster
 * observed them.
 */
const bareDog: Dog = {
  id: "d-bare",
  name: "Juniper",
  breed: "Terrier mix",
  age_years: 2,
  status: "available",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "Came in as a stray. Quiet in the kennel.",
};

const emptyFoster: Foster = { phase: "care_plan" } as Foster;

describe("buildAdoptionProfile with nothing logged", () => {
  const p = buildAdoptionProfile(normalizeDog(bareDog), emptyFoster, [], [], []);

  it("asserts nothing medical", () => {
    expect(p.medical).toBeNull();
  });

  it("shows no milestones", () => {
    expect(p.milestones).toEqual([]);
  });

  it("attributes the weight to the shelter, never to the foster", () => {
    expect(p.weight.source).toBe("shelter");
  });

  it("names every absent section so the page can ask for it", () => {
    expect(p.missing).toEqual(
      expect.arrayContaining(["photos", "journal notes", "care plan items", "medical record", "your note"]),
    );
  });

  it("leaves untested compatibility untested", () => {
    expect(p.compatibility.every((c) => !c.known && c.value === "Not tested")).toBe(true);
  });
});

describe("buildAdoptionProfile with things the foster actually did", () => {
  const schedule: ScheduleBlock[] = [
    {
      id: "week-1",
      label: "Week 1",
      startDay: 1,
      items: [
        { id: "s-dhpp", label: "DHPP booster", kind: "vaccine", done: true },
        { id: "s-flea", label: "Flea prevention", kind: "medication", done: true },
        { id: "s-nail", label: "First nail trim", kind: "grooming", done: false },
      ],
    },
  ];
  const entries: CareLogEntry[] = [
    { id: "c1", type: "weigh_in", note: "", value: "31 lb", photo_url: "", created_at: null },
    { id: "c2", type: "vet_visit", note: "Ear infection cleared", value: "", photo_url: "", created_at: null },
  ];

  const p = buildAdoptionProfile(normalizeDog(bareDog), emptyFoster, entries, [], schedule);

  it("builds the medical record from ticked rows and logged visits only", () => {
    expect(p.medical).toEqual({
      vaccines: ["DHPP booster"],
      medications: ["Flea prevention"],
      vetVisits: ["Ear infection cleared"],
    });
  });

  it("credits the foster with a weight they actually took", () => {
    expect(p.weight).toEqual({ value: "31 lb", source: "care plan" });
  });

  it("counts what is still outstanding", () => {
    expect(p.careDone).toHaveLength(2);
    expect(p.careOutstanding).toBe(1);
    expect(p.missing).not.toContain("medical record");
  });
});
