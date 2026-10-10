import { describe, expect, it } from "vitest";
import { buildAdoptionProfile, publishedPart, samePublished, shelterRecordTitle, withPublished } from "./adoption";
import { normalizeDog } from "./dog";
import type { CareLogEntry, Dog, Foster } from "../types";
import type { JournalEntry, ScheduleBlock } from "../phases/careplan/types";

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

describe("shelterRecordTitle (PH-28)", () => {
  it("names the org when there is one", () => {
    expect(shelterRecordTitle(normalizeDog({ ...bareDog, shelter_id: "sfspca-mission" }))).toBe("SF SPCA's record");
  });

  it("never borrows another org's name when there isn't", () => {
    expect(shelterRecordTitle(normalizeDog({ ...bareDog, shelter_id: "petsun" }))).toBe("The shelter's record");
  });
});

describe("what a foster publishes (PH-32)", () => {
  const dog = normalizeDog({ ...bareDog, weight_lbs: 40, good_with_kids: true });
  const journal: JournalEntry[] = [
    { id: "j1", createdAt: "Day 2", dayInFoster: 2, kind: "note", text: "Sleeps through the night", starred: false },
    { id: "j2", createdAt: "Day 3", dayInFoster: 3, kind: "photo", photoUrl: "https://x/p.jpg", caption: "Park", starred: true },
  ];
  const schedule: ScheduleBlock[] = [
    { id: "w1", label: "Week 1", startDay: 1, items: [{ id: "v", label: "DHPP", kind: "vaccine", done: true }] },
  ];
  const foster = { ...emptyFoster, adoptionNote: "A gentle soul." } as Foster;
  const full = buildAdoptionProfile(dog, foster, [], journal, schedule);
  const shelterOnly = buildAdoptionProfile(dog, null, [], [], []);

  it("carries every foster-sourced field and none of the shelter's", () => {
    const part = publishedPart(full, ["calm"], "A calm dog.");
    expect(Object.keys(part).sort()).toEqual([
      "careDone", "careOutstanding", "fosterNote", "journalNotes", "medical", "milestones",
      "photos", "summary", "tags", "weight",
    ]);
    for (const shelterKey of ["shelterFacts", "shelterNotes", "compatibility", "careNeeds"]) {
      expect(part).not.toHaveProperty(shelterKey);
    }
    expect(part.photos.every((p) => p.source === "journal")).toBe(true);
    expect(part.fosterNote).toBe("A gentle soul.");
  });

  it("keeps a weight only when the foster took it", () => {
    expect(publishedPart(full, [], "").weight).toBeNull();
    const weighed = buildAdoptionProfile(dog, foster, [
      { id: "c1", type: "weigh_in", note: "", value: "38 lb", photo_url: "", created_at: null },
    ], journal, schedule);
    expect(publishedPart(weighed, [], "").weight).toEqual({ value: "38 lb", source: "care plan" });
  });

  it("changes nothing when nothing is published", () => {
    expect(withPublished(shelterOnly, null)).toBe(shelterOnly);
  });

  it("lays the published part over the shelter's live record", () => {
    const page = withPublished(shelterOnly, publishedPart(full, ["calm"], "A calm dog."));
    expect(page.journalNotes.map((n) => n.text)).toEqual(["Sleeps through the night"]);
    expect(page.photos.filter((p) => p.source === "journal")).toHaveLength(1);
    expect(page.medical?.vaccines).toEqual(["DHPP"]);
    expect(page.fosterNote).toBe("A gentle soul.");
    // The shelter's half stays the live one.
    expect(page.shelterFacts).toEqual(shelterOnly.shelterFacts);
    expect(page.compatibility).toEqual(shelterOnly.compatibility);
    expect(page.weight).toEqual({ value: "40 lb", source: "shelter" });
  });

  it("says a page is up to date regardless of the order Firestore returns keys in", () => {
    const part = publishedPart(full, ["calm"], "A calm dog.");
    const reordered = Object.fromEntries(Object.entries(part).reverse());
    expect(samePublished(part, reordered)).toBe(true);
    const edited = buildAdoptionProfile(dog, foster, [], [...journal,
      { id: "j3", createdAt: "Day 4", dayInFoster: 4, kind: "note", text: "Learned sit", starred: false }], schedule);
    expect(samePublished(publishedPart(edited, ["calm"], "A calm dog."), part)).toBe(false);
  });
});
