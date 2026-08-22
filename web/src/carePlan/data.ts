import type {
  DogProfile,
  EmergencyContact,
  JournalEntry,
  MedicalSummary,
  Milestone,
  ScheduleBlock,
  TaskTemplate,
  Tip,
  WeekPhase,
} from "./types";

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

export function daysSincePickup(pickupIso: string): number {
  const [y, m, d] = pickupIso.split("-").map(Number);
  const pickup = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  pickup.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - pickup.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export const taskTemplates: TaskTemplate[] = [
  {
    id: "t-feed",
    kind: "feeding",
    title: "Feed Marty (3× today)",
    why: "Puppies need small frequent meals — steady blood sugar, easier house training.",
    cadence: "daily",
    appearsWeek: 1,
  },
  {
    id: "t-walk-short",
    kind: "walk",
    title: "Short leash walk (10 min)",
    why: "Week 1 is decompression — short walks in quiet spots build trust.",
    cadence: "daily",
    appearsWeek: 1,
    disappearsWeek: 2,
  },
  {
    id: "t-walk-long",
    kind: "walk",
    title: "Two walks (15–20 min)",
    why: "Routine is locking in — longer walks help drain puppy energy.",
    cadence: "daily",
    appearsWeek: 2,
  },
  {
    id: "t-setup",
    kind: "setup",
    title: "Set up quiet crate space",
    why: "A den-like corner helps Marty feel safe. Don't force him in — leave the door open.",
    cadence: "once",
    appearsWeek: 1,
    disappearsWeek: 2,
  },
  {
    id: "t-weigh",
    kind: "weigh",
    title: "Weigh-in",
    why: "Weekly weight is the earliest signal something is off. Puppies should trend up.",
    cadence: "weekly",
    appearsWeek: 1,
  },
  {
    id: "t-crate-practice",
    kind: "crate",
    title: "Crate practice — food in crate",
    why: "Feeding meals inside the crate builds a positive association. Door stays open.",
    cadence: "daily",
    appearsWeek: 2,
  },
  {
    id: "t-chew-rotate",
    kind: "enrich",
    title: "Rotate chew toys",
    why: "Teething peaks around 12–16 weeks. Frozen wet washcloths + rubber chews save your shoes.",
    cadence: "daily",
    appearsWeek: 3,
  },
  {
    id: "t-train-cue",
    kind: "train",
    title: "5-min cue practice (sit / touch)",
    why: "Short, upbeat sessions. Marty is testing limits this week — training reinforces trust.",
    cadence: "daily",
    appearsWeek: 4,
  },
];

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
    title: "Marty came home",
    kind: "behavior",
    note: "Hid under the coffee table for the first two hours.",
  },
  {
    id: "m-wag",
    dayInFoster: 4,
    title: "First tail wag on the couch",
    kind: "behavior",
    weightLbs: 21,
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
    upcoming: true,
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

export const weekPhases: WeekPhase[] = [
  {
    index: 1,
    name: "Decompression",
    eyebrow: "Week 1",
    taskTemplateIds: ["t-feed", "t-walk-short", "t-setup", "t-weigh"],
    pinnedTipId: "tip-decompress",
    milestonePrompts: ["First tail wag?", "First time eating a full meal?"],
  },
  {
    index: 2,
    name: "Routine locks in",
    eyebrow: "Week 2",
    taskTemplateIds: ["t-feed", "t-walk-long", "t-crate-practice", "t-weigh"],
    pinnedTipId: "tip-crate",
    milestonePrompts: ["First full night without whining?", "First loose-leash walk?"],
  },
  {
    index: 3,
    name: "Teething & testing",
    eyebrow: "Week 3",
    taskTemplateIds: ["t-feed", "t-walk-long", "t-crate-practice", "t-chew-rotate", "t-weigh"],
    pinnedTipId: "tip-teething",
    milestonePrompts: ["Any biting incidents?", "Favorite chew toy?"],
  },
  {
    index: 4,
    name: "Honeymoon ends",
    eyebrow: "Week 4",
    taskTemplateIds: ["t-feed", "t-walk-long", "t-crate-practice", "t-train-cue", "t-weigh"],
    pinnedTipId: "tip-honeymoon",
    milestonePrompts: ["First 'sit' on cue?", "Any new fears surfacing?"],
  },
  {
    index: 6,
    name: "Adoption prep",
    eyebrow: "Week 6+",
    taskTemplateIds: ["t-feed", "t-walk-long", "t-train-cue", "t-weigh"],
    pinnedTipId: "tip-adoption",
    milestonePrompts: ["Star your favorite photos for the adoption profile"],
  },
];

export const scheduleBlocks: ScheduleBlock[] = [
  {
    id: "week-1",
    label: "Week 1",
    startDay: 1,
    items: [
      { id: "s-vet-wellness", label: "Vet wellness visit", kind: "wellness", done: true },
      { id: "s-flea", label: "Flea prevention", kind: "medication", done: true },
      { id: "s-deworm", label: "Deworming (round 1)", kind: "medication", done: false },
    ],
  },
  {
    id: "week-2",
    label: "Week 2",
    startDay: 8,
    items: [
      { id: "s-dhpp-1", label: "DHPP booster", kind: "vaccine", done: true },
      { id: "s-nail-1", label: "First nail trim", kind: "grooming", done: false },
      { id: "s-weigh-2", label: "Weight check", kind: "checkup", done: false },
    ],
  },
  {
    id: "week-3",
    label: "Week 3",
    startDay: 15,
    items: [
      { id: "s-teeth-check", label: "Teething check-in", kind: "checkup", done: false },
      { id: "s-bordetella", label: "Bordetella (kennel cough)", kind: "vaccine", done: false },
      { id: "s-train-sit", label: "Intro to 'sit' + 'touch'", kind: "training", done: false },
    ],
  },
  {
    id: "month-2",
    label: "Month 2",
    startDay: 30,
    items: [
      { id: "s-heartworm", label: "Heartworm prevention", kind: "medication", done: false },
      { id: "s-dental", label: "Dental check", kind: "checkup", done: false },
      { id: "s-skin", label: "Skin & coat check", kind: "checkup", done: false },
    ],
  },
  {
    id: "month-3",
    label: "Month 3",
    startDay: 60,
    items: [
      { id: "s-nail-3", label: "Nail trim", kind: "grooming", done: false },
      { id: "s-rabies", label: "Rabies vaccine", kind: "vaccine", done: false },
      { id: "s-fecal", label: "Fecal test", kind: "checkup", done: false },
    ],
  },
];

export const medicalSummary: MedicalSummary = {
  vaccines: ["DHPP (booster complete)", "Bordetella (pending)", "Rabies (due Month 3)"],
  allergies: ["None reported"],
  medications: ["Flea/tick preventative — monthly", "Deworming — in progress"],
};

export const emergencyContacts: EmergencyContact[] = [
  {
    name: "Bay Area 24h Vet",
    role: "Nearest 24h emergency",
    phone: "(415) 555-0142",
    distanceMi: 1.2,
    hours: "Open now · 24 hrs",
  },
  {
    name: "Copper's Dream Rescue",
    role: "Foster coordinator",
    phone: "(415) 555-0180",
    hours: "On-call today",
  },
  {
    name: "Pet Poison Helpline",
    role: "Toxin ingestion",
    phone: "(855) 764-7661",
    hours: "24 hrs",
  },
];

export const tips: Tip[] = [
  {
    id: "tip-decompress",
    title: "Week 1 is for decompression",
    category: "Adjustment",
    urgency: "info",
    body: "Marty may hide, sleep a lot, or seem 'off' — that's normal. Give a quiet corner, a soft bed, and let him come to you. Rule of thumb: 3 days to decompress, 3 weeks to feel at home, 3 months to feel like family.",
  },
  {
    id: "tip-crate",
    title: "The food-in-crate trick",
    category: "Crate training",
    urgency: "info",
    body: "Feed every meal inside the crate with the door open. Marty walks in for the food, walks out on his own — no forcing. Within a week, the crate becomes 'the good place.' Once he goes in on his own, start closing the door for the duration of the meal.",
  },
  {
    id: "tip-teething",
    title: "The wet towel trick",
    category: "Biting & teething",
    urgency: "info",
    body: "Puppies peak biting around 12–16 weeks. Wet a washcloth, twist it, freeze it — hand it over when Marty gets mouthy. Cold soothes the gums and redirects the bite off your hand. Keep 2–3 in rotation.",
  },
  {
    id: "tip-honeymoon",
    title: "The honeymoon is ending — that's good",
    category: "Behavior",
    urgency: "info",
    body: "Around week 3–4, dogs feel safe enough to test limits. This isn't regression — it's trust. Reinforce basic cues calmly, hold your routine, and don't take it personally when Marty ignores you the first few times.",
  },
  {
    id: "tip-adoption",
    title: "Building Marty's adoption profile",
    category: "Adoption prep",
    urgency: "info",
    body: "Star your favorite journal entries and photos — we'll auto-compose them into an adoption profile the shelter can use. Aim for 5–8 photos and 3–4 short stories that show personality.",
  },
  {
    id: "tip-not-eating",
    title: "Marty skipped meals — try this first",
    category: "Feeding",
    urgency: "warn",
    body: "Warm the food slightly, add a spoon of low-sodium broth, or top with a bit of wet food. Puppies can't skip meals safely for long — if 24 hours pass with nothing, call the vet or shelter.",
  },
  {
    id: "tip-biting-teething",
    title: "Biting — puppy playbook",
    category: "Biting & teething",
    urgency: "warn",
    body: "For puppies under 6 months, biting is almost always teething or over-arousal. Yelp softly and disengage for 20 seconds — hands stop being fun when they leave. Redirect to a frozen wet towel or rubber chew. Never scold physically; that teaches fear, not manners.",
  },
  {
    id: "tip-biting-adult",
    title: "Biting — adult dog playbook",
    category: "Biting & teething",
    urgency: "escalate",
    body: "For adult dogs, identify the trigger (resource, fear, over-arousal). Do NOT punish — that intensifies fear-based biting. Log every incident with what happened just before, and loop in the shelter's behavior contact today. If skin was broken, treat as an escalation.",
  },
  {
    id: "tip-crate-refusal",
    title: "Won't go in the crate?",
    category: "Crate training",
    urgency: "info",
    body: "Never force. Leave the door open, toss a treat just inside, then further. Feed all meals in there. If Marty whines at night, a soft blanket over the crate + something that smells like you often does it.",
  },
  {
    id: "tip-scared",
    title: "Marty is scared of things",
    category: "Behavior",
    urgency: "info",
    body: "Fear in the first 2 weeks is normal — new sounds, new house, new humans. Don't force exposure. Let Marty retreat, reward calm approaches with high-value treats, and go at his pace. Most fears fade with routine.",
  },
];
