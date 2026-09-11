import type {
  DogProfile,
  JournalEntry,
  MedicalSummary,
  Milestone,
} from "./types";

/**
 * Demo-only content for `LOCAL_MODE`. Nothing here may reach a real foster's document.
 *
 * These are *records*, not advice: dated milestones, weights, a vaccination summary and
 * journal entries written in a foster's voice about a dog called Marty — including a
 * photograph of a different animal. Every one of them could be wrong about a specific
 * animal, which is exactly the test `docs/initiatives/production-hardening.md` sets for
 * what may be seeded. Forward-looking advice (`taskTemplates`, `weekPhases`, `tips`, an
 * unticked `scheduleBlocks`) stays in `data.ts` because it is true of any dog.
 *
 * A fresh clone shows a banner saying the data is local, so showing this behind that banner
 * is honest. **Only `LOCAL_MODE`-guarded code paths may import this module.**
 */

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const marty: DogProfile = {
  id: "marty",
  name: "Marty",
  breed: "Shepherd mix",
  ageMonths: 4,
  weightLbs: 22,
  pickupDate: todayIso(),
  medicalFlags: [],
  backstory: "Surrendered with two littermates. Shy at first, warms up with food.",
};

export const seedMilestones: Milestone[] = [
  {
    id: "m-intake",
    dayInFoster: 1,
    title: "Intake with Copper's Dream",
    kind: "vet",
    note: "Cleared for foster. Deworming complete.",
    weightLbs: 20,
  },
  {
    id: "m-pickup",
    dayInFoster: 1,
    title: "{dog} came home",
    kind: "behavior",
    note: "Hid under the coffee table for the first two hours.",
  },
  {
    id: "m-week1-weigh",
    dayInFoster: 7,
    title: "Weigh-in — 21.5 lbs",
    kind: "weigh",
    weightLbs: 21.5,
  },
  {
    id: "m-vaccine",
    dayInFoster: 10,
    title: "DHPP booster",
    kind: "vaccine",
    note: "Slept the rest of the day. Normal.",
  },
  {
    id: "m-week2-weigh",
    dayInFoster: 14,
    title: "Weigh-in — 22 lbs",
    kind: "weigh",
    weightLbs: 22,
  },
  {
    id: "m-vet-upcoming",
    dayInFoster: 24,
    title: "Vet check-in (Dr. Alvarez)",
    kind: "vet",
  },
  {
    id: "m-week3-weigh",
    dayInFoster: 21,
    title: "Weigh-in — 24 lbs",
    kind: "weigh",
    weightLbs: 24,
  },
  {
    id: "m-sit",
    dayInFoster: 25,
    title: "First 'sit' on cue",
    kind: "training",
    note: "Third try, but he got it. Very proud puppy.",
  },
  {
    id: "m-week4-weigh",
    dayInFoster: 28,
    title: "Weigh-in — 26 lbs",
    kind: "weigh",
    weightLbs: 26,
  },
  {
    id: "m-bordetella",
    dayInFoster: 30,
    title: "Bordetella booster",
    kind: "vaccine",
    note: "Kennel cough shot before daycare visits.",
  },
  {
    id: "m-loose-leash",
    dayInFoster: 33,
    title: "First loose-leash walk (10 min)",
    kind: "training",
  },
  {
    id: "m-week6-weigh",
    dayInFoster: 42,
    title: "Weigh-in — 29 lbs",
    kind: "weigh",
    weightLbs: 29,
  },
  {
    id: "m-adoption-check",
    dayInFoster: 45,
    title: "Adoption readiness check",
    kind: "vet",
    note: "Green light from the shelter — profile can go live.",
  },
];

export const seedJournal: JournalEntry[] = [
  {
    id: "j-1",
    createdAt: "Day 1 · 8:14 pm",
    dayInFoster: 1,
    kind: "note",
    text: "Wouldn't eat kibble. Tried a spoon of wet food on top — cleaned the bowl.",
    starred: false,
  },
  {
    id: "j-2",
    createdAt: "Day 4 · 11:02 am",
    dayInFoster: 4,
    kind: "photo",
    photoUrl: "/journal/day4-couch.jpeg",
    imageColor: "#C4955A",
    caption: "First time on the couch. Look at this face.",
    starred: true,
  },
  {
    id: "j-3",
    createdAt: "Day 9 · 7:30 pm",
    dayInFoster: 9,
    kind: "note",
    text: "Handled the vaccine like a champ. Slept next to my feet all evening.",
    starred: true,
  },
];

export const medicalSummary: MedicalSummary = {
  vaccines: ["DHPP (booster complete)", "Bordetella (pending)", "Rabies (due Month 3)"],
  allergies: ["None reported"],
  medications: ["Flea/tick preventative — monthly", "Deworming — in progress"],
};
