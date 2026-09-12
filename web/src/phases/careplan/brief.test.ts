import { describe, expect, it } from "vitest";
import { buildAgentBrief } from "./brief";
import type { DogProfile, Tip, WeekPhase } from "./types";

/**
 * The standard this file exists to hold: the model is told nothing about this dog that
 * nobody recorded.
 *
 * It is the tense test (`docs/initiatives/production-hardening.md`) applied to a prompt
 * rather than a page, and the two surfaces fail differently. A page can render "Not
 * recorded"; a prompt that enumerates a field cannot stay silent about it, so the brief's
 * old empty branch — "No medical flags." — turned a missing record into a categorical
 * negative about a real animal. 9 of the 19 committed dogs have no `needs` at all, and not
 * one of the values the other 10 carry is medical.
 */
const phase: WeekPhase = {
  index: 0,
  name: "Decompression",
  eyebrow: "Week 1",
  taskTemplateIds: [],
  pinnedTipId: "tip-decompress",
  milestonePrompts: [],
};

const pinnedTip: Tip = {
  id: "tip-decompress",
  title: "Give them the first three days",
  category: "Adjustment",
  body: "Quiet room, short leash walks, no visitors.",
  urgency: "info",
};

function brief(dog: Partial<DogProfile>): string {
  const profile: DogProfile = {
    id: "d-1",
    name: "Juniper",
    breed: "Terrier mix",
    ageMonths: 108,
    weightLbs: 34,
    pickupDate: "2026-09-01",
    careNeeds: [],
    backstory: "Came in as a stray. Quiet in the kennel.",
    ...dog,
  };
  return buildAgentBrief({
    dog: profile,
    dayInFoster: 3,
    phase,
    weeks: [],
    milestones: [],
    pinnedTip,
    firedRules: [],
    tipsById: {},
  });
}

describe("a dog with no care needs recorded", () => {
  const text = brief({ careNeeds: [] });

  it("does not tell the model the dog has no medical flags", () => {
    expect(text).not.toContain("No medical flags");
  });

  it("names the gap as a gap rather than leaving it silent", () => {
    expect(text).toContain("does not include any care or behaviour needs");
    expect(text).toContain("gap in the paperwork, not a finding");
  });
});

describe("a dog whose needs are behavioural, which is all of them", () => {
  const text = brief({ careNeeds: ["Leash training", "Daily fetch"] });

  it("never calls them medical", () => {
    expect(text).not.toContain("Medical flags");
    expect(text).toContain("Care and behaviour notes from the shelter: Leash training, Daily fetch.");
  });

  it("reports no gap for a field that is recorded", () => {
    expect(text).not.toContain("any care or behaviour needs");
  });
});

describe("a dog the shelter never weighed", () => {
  const text = brief({ weightLbs: null });

  it("does not invent a weight of zero", () => {
    expect(text).not.toContain("0 lbs");
    expect(text).not.toContain("lbs at intake");
  });

  it("says the weight is missing from the record", () => {
    expect(text).toContain("a weight at intake");
  });

  it("still describes what it does hold", () => {
    expect(text).toContain("108-month-old Terrier mix.");
  });
});

describe("a dog with a weight", () => {
  it("keeps the clause and reports no gap for it", () => {
    const text = brief({ weightLbs: 34 });
    expect(text).toContain("34 lbs at intake");
    expect(text).not.toContain("a weight at intake.");
  });
});

describe("several gaps at once", () => {
  it("reads as a sentence, not a list", () => {
    const text = brief({ careNeeds: [], weightLbs: null, backstory: "" });
    expect(text).toContain(
      "does not include any care or behaviour needs, a weight at intake and a write-up",
    );
  });
});
