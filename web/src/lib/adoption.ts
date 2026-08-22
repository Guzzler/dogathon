import type { CareLogEntry, Foster } from "../types";
import type { JournalEntry } from "../phases/careplan/types";
import { photoUrl, type RichDog } from "./dog";

/**
 * Everything the adoption page renders.
 *
 * The Care Plan journal is the intended source: weigh-ins drive the health section, photos
 * fill the gallery, notes become highlights. Where the journal is still empty we fall back to
 * content derived from the dog's own record, and flag it in `fromJournal` so the UI can say
 * which parts are real and which are placeholder.
 */
export interface AdoptionProfile {
  headline: string;
  summary: string;
  /** Either a real image URL, or a colour swatch until photo upload exists. */
  photos: { url?: string; color?: string; caption?: string }[];
  personality: { label: string; text: string }[];
  routine: { when: string; text: string }[];
  manners: { label: string; value: string; good: boolean }[];
  health: {
    currentWeight: string;
    startWeight: string | null;
    trend: string | null;
    vetVisits: { date: string; note: string }[];
  };
  highlights: { date: string; text: string }[];
  fosterNote: string;
  idealHome: string[];
  fromJournal: { photos: boolean; weight: boolean; notes: boolean; vet: boolean };
  /** Raw note text, for the agent to condense into tags. */
  noteTexts: string[];
}

const stamp = (e: CareLogEntry) =>
  e.created_at
    ? new Date(e.created_at.seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

const ENERGY_ROUTINE: Record<number, { when: string; text: string }[]> = {
  0: [
    { when: "Morning", text: "A slow amble round the block, then straight back to the warmest spot in the house." },
    { when: "Afternoon", text: "Sleeps through most of it. Will relocate to follow the sun." },
    { when: "Evening", text: "Dinner, a short potty trip, and lights out early." },
  ],
  1: [
    { when: "Morning", text: "One easy 20-minute walk is plenty to start the day." },
    { when: "Afternoon", text: "Naps near whoever's home, with the occasional patrol of the kitchen." },
    { when: "Evening", text: "A gentle stroll, dinner, then settles on the couch without being asked." },
  ],
  2: [
    { when: "Morning", text: "A proper 30-minute walk, then breakfast and a solid nap." },
    { when: "Afternoon", text: "Happy with a chew or a puzzle toy while you get on with things." },
    { when: "Evening", text: "A second walk and some play, then settles down for the night." },
  ],
  3: [
    { when: "Morning", text: "Needs a real walk or a run before anything else happens." },
    { when: "Afternoon", text: "A training session or a puzzle keeps the brain busy; otherwise gets restless." },
    { when: "Evening", text: "One more outing, then genuinely tired and content." },
  ],
  4: [
    { when: "Morning", text: "An hour on the move — a run, a hike, or a long game of fetch." },
    { when: "Afternoon", text: "Needs a job: training, scent games, or a yard to patrol." },
    { when: "Evening", text: "A final burst of energy, then sleeps like a rock." },
  ],
};

export function buildAdoptionProfile(
  dog: RichDog,
  foster: Foster | null,
  entries: CareLogEntry[],
  journal: JournalEntry[] = [],
): AdoptionProfile {
  const fosterName = foster?.name?.trim() || "their foster";

  const weighIns = entries.filter((e) => e.type === "weigh_in" && e.value);
  const vetVisits = entries.filter((e) => e.type === "vet_visit");

  // The Care Plan journal is the primary source. `starred` is how the foster marks an entry
  // for the adoption profile, so those come first; if nothing is starred we take everything.
  const starred = journal.filter((e) => e.starred);
  const chosen = starred.length ? starred : journal;
  const journalPhotos = chosen.filter((e) => e.kind === "photo");
  const journalNotes = chosen.filter((e) => e.kind === "note" && e.text?.trim());

  // The older care-log collection still feeds photos and notes where it has them.
  const photoEntries = entries.filter((e) => e.type === "photo" && e.photo_url);
  const notes = entries.filter((e) => e.type === "note" && e.note);

  // Gallery: journal photos first, then care-log photos, then a spread from the dog's own set.
  let photos: AdoptionProfile["photos"];
  if (journalPhotos.length) {
    photos = journalPhotos.map((e) => ({ url: e.photoUrl, color: e.imageColor, caption: e.caption }));
  } else if (photoEntries.length) {
    photos = photoEntries.map((e) => ({ url: e.photo_url }));
  } else {
    photos = [dog.photoId, dog.photoId + 3, dog.photoId + 7, dog.photoId + 11].map((n) => ({
      url: photoUrl(((n - 1) % 20) + 1, 700, 700),
    }));
  }

  const startWeight = weighIns.length ? weighIns[0].value : null;
  const currentWeight = weighIns.length ? weighIns[weighIns.length - 1].value : `${dog.weight_lbs} lb`;
  let trend: string | null = null;
  if (weighIns.length >= 2) {
    const a = parseFloat(weighIns[0].value);
    const b = parseFloat(weighIns[weighIns.length - 1].value);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) {
      const diff = Math.abs(b - a).toFixed(1);
      trend = b > a ? `Gained ${diff} lb in foster care` : `Lost ${diff} lb in foster care`;
    } else trend = "Held a steady weight throughout";
  }

  const energyWords = ["very low", "low", "moderate", "high", "very high"][dog.energyLevel];

  return {
    headline: `${dog.name} is ready for a forever home`,
    summary: dog.notes,
    photos,

    personality: [
      { label: "Energy", text: `${dog.name} has ${energyWords} energy — ${ENERGY_ROUTINE[dog.energyLevel][0].text.toLowerCase()}` },
      ...dog.traitList.slice(0, 3).map((t) => ({ label: t, text: traitBlurb(t, dog.name) })),
    ],

    routine: ENERGY_ROUTINE[dog.energyLevel],

    manners: [
      { label: "House-trained", value: "Yes, no accidents in foster", good: true },
      { label: "Crate", value: dog.needsList.some((n) => /crate/i.test(n)) ? "Settles in a crate overnight" : "Sleeps loose, no crate needed", good: true },
      { label: "Leash", value: dog.traitList.some((t) => /leash|walk/i.test(t)) ? "Walks nicely, no pulling" : "Still learning not to pull", good: dog.traitList.some((t) => /leash|walk/i.test(t)) },
      { label: "Alone time", value: dog.energyLevel <= 2 ? "Comfortable alone for a work day" : "Best with someone around most of the day", good: dog.energyLevel <= 2 },
      { label: "Good with kids", value: dog.good_with_kids ? "Yes" : "Better in an adult home", good: dog.good_with_kids },
      { label: "Good with dogs", value: dog.good_with_dogs ? "Yes" : "Prefers to be the only dog", good: dog.good_with_dogs },
      { label: "Good with cats", value: dog.goodWithCats ? "Yes" : "Not cat-tested / prefers no cats", good: dog.goodWithCats },
    ],

    health: {
      currentWeight,
      startWeight,
      trend,
      vetVisits: vetVisits.map((e) => ({ date: stamp(e), note: e.note || "Routine check-up" })),
    },

    highlights: journalNotes.length
      ? journalNotes.slice(0, 5).map((e) => ({ date: e.createdAt, text: e.text ?? "" }))
      : notes.length
      ? notes.slice(-5).map((e) => ({ date: stamp(e), text: e.note }))
      : [
          { date: "Week 1", text: `${dog.name} spent the first few days watching from a distance, then decided the couch was home.` },
          { date: "Week 2", text: "Started coming when called, and stopped startling at the doorbell." },
          { date: "Week 3", text: `Now greets visitors at the door. ${dog.name} has really come out of their shell.` },
        ],

    fosterNote:
      `${dog.name} came to us ${dog.fosterLength} ago and has been an absolute joy. ` +
      `${dog.notes} Whoever adopts ${dog.name} is getting a dog who is already settled, ` +
      `already loved, and ready to pick up right where we left off. — ${fosterName}`,

    idealHome: [
      dog.energyLevel >= 3 ? "An active household that can commit to real daily exercise" : "A calm household with a comfortable routine",
      dog.size === "large" ? "Space to stretch out — a house suits better than a studio" : "Happy in an apartment or a house",
      ...(dog.good_with_kids ? ["Kids are welcome"] : ["An adult-only home"]),
      ...(dog.needsList.length ? [`Will need: ${dog.needsList.join(", ")}`] : []),
    ],

    fromJournal: {
      photos: journalPhotos.length > 0 || photoEntries.length > 0,
      weight: weighIns.length > 0,
      notes: journalNotes.length > 0 || notes.length > 0,
      vet: vetVisits.length > 0,
    },

    noteTexts: [
      ...journalNotes.map((e) => e.text ?? ""),
      ...notes.map((e) => e.note),
    ].filter(Boolean),
  };
}

function traitBlurb(trait: string, name: string): string {
  const t = trait.toLowerCase();
  if (/cuddl|gentle|sweet|sweetheart/.test(t)) return `${name} will lean into you the moment you sit down.`;
  if (/smart|learn|train/.test(t)) return `${name} picks up new cues fast and enjoys the work.`;
  if (/quiet|calm|mellow|unbothered|slow/.test(t)) return `${name} is easy to live with and rarely makes a fuss.`;
  if (/vocal|chatty|loud/.test(t)) return `${name} has opinions and will share them.`;
  if (/food|treat/.test(t)) return `${name} will do almost anything for a treat, which makes training simple.`;
  if (/yard|fence|athletic|hik|fetch|ball/.test(t)) return `${name} is at their best outdoors with room to move.`;
  if (/senior|golden years/.test(t)) return `${name} is past the chaotic years and just wants comfort.`;
  return `${name} is known for this by everyone who's met them.`;
}
