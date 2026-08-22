import type { CareLogEntry, Foster } from "../types";
import type { JournalEntry } from "../phases/careplan/types";
import { ENERGY_WORD, photoUrl, sizeLabel, type RichDog } from "./dog";

/**
 * The adoption page's content, with a source for every field.
 *
 * Nothing here is invented. An adoption profile is read by someone deciding whether to take
 * on a real animal, so a plausible-sounding guess ("no accidents in foster") is worse than a
 * blank: it can't be told apart from something the foster actually observed. Every field is
 * either logged by the foster, recorded by the shelter, or absent — and `missing` lists what
 * is absent so the page can ask for it instead of filling it in.
 */
export interface AdoptionProfile {
  /** The shelter's photo first, then every photo the foster logged, oldest to newest. */
  photos: { url?: string; color?: string; caption?: string; date: string; source: "shelter" | "journal" }[];
  hasJournalPhotos: boolean;
  /** Every note the foster logged, oldest first — the whole foster period, not just recent. */
  journalNotes: { date: string; text: string; starred: boolean; day: number }[];

  weighIns: { date: string; value: string }[];
  vetVisits: { date: string; note: string }[];
  /** Falls back to the shelter's intake weight, and says so. */
  weight: { value: string; source: "journal" | "shelter" };

  /** Straight off the dog's record. Facts the shelter recorded, not foster observations. */
  shelterFacts: { label: string; value: string }[];
  shelterNotes: string;
  compatibility: { label: string; known: boolean; value: string }[];
  careNeeds: string[];

  /** Written by the foster. Null until they write one — never generated. */
  fosterNote: string | null;

  /** Sections with no data yet, for the "still to add" prompt. */
  missing: string[];
}

const stamp = (e: CareLogEntry) =>
  e.created_at
    ? new Date(e.created_at.seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

export function buildAdoptionProfile(
  dog: RichDog,
  foster: Foster | null,
  entries: CareLogEntry[],
  journal: JournalEntry[] = [],
): AdoptionProfile {
  // Oldest first, so the page and the summary both read Day 1 → today rather than newest-first.
  const byDay = [...journal].sort((a, b) => a.dayInFoster - b.dayInFoster);

  const journalPhotos = byDay
    .filter((e) => e.kind === "photo")
    .map((e) => ({
      url: e.photoUrl, color: e.imageColor, caption: e.caption,
      date: e.createdAt, source: "journal" as const,
    }));

  // The carousel opens on the shelter's own photo, then everything the foster added.
  const photos = [
    { url: photoUrl(dog.photoId, 700, 700), date: "From the shelter", source: "shelter" as const },
    ...journalPhotos,
  ];

  // Every note across the whole foster period. `starred` is kept as a marker rather than a
  // filter — a summary that only saw starred entries would miss most of what happened.
  const journalNotes = byDay
    .filter((e) => e.kind === "note" && e.text?.trim())
    .map((e) => ({ date: e.createdAt, text: e.text!.trim(), starred: e.starred, day: e.dayInFoster }));

  // The older careLog collection still carries weigh-ins and vet visits.
  const weighIns = entries
    .filter((e) => e.type === "weigh_in" && e.value)
    .map((e) => ({ date: stamp(e), value: e.value }));
  const vetVisits = entries
    .filter((e) => e.type === "vet_visit")
    .map((e) => ({ date: stamp(e), note: e.note || "Vet visit" }));

  const weight = weighIns.length
    ? { value: weighIns[weighIns.length - 1].value, source: "journal" as const }
    : { value: `${dog.weight_lbs} lb`, source: "shelter" as const };

  const shelterFacts = [
    { label: "Breed", value: dog.breed },
    { label: "Age", value: dog.ageLabel },
    { label: "Size", value: `${sizeLabel(dog.size)} · ${dog.weight_lbs} lb at intake` },
    { label: "Energy level", value: ENERGY_WORD[dog.energyLevel] },
    { label: "Grooming", value: `${dog.groomingLevel === "low" ? "Low" : "High"} · ${dog.coatLength} coat` },
  ];

  // good_with_cats is optional on the record — absent means untested, not "no".
  const compatibility = [
    { label: "Kids", known: true, value: dog.good_with_kids ? "Yes" : "Not recommended" },
    { label: "Dogs", known: true, value: dog.good_with_dogs ? "Yes" : "Not recommended" },
    {
      label: "Cats",
      known: dog.good_with_cats !== undefined,
      value: dog.good_with_cats === undefined ? "Not tested" : dog.good_with_cats ? "Yes" : "Not recommended",
    },
  ];

  const fosterNote = foster?.adoptionNote?.trim() || null;

  const missing: string[] = [];
  if (!journalPhotos.length) missing.push("photos");
  if (!journalNotes.length) missing.push("journal notes");
  if (!weighIns.length) missing.push("a weigh-in");
  if (!fosterNote) missing.push("your note");

  return {
    photos,
    hasJournalPhotos: journalPhotos.length > 0,
    journalNotes,
    weighIns,
    vetVisits,
    weight,
    shelterFacts,
    shelterNotes: dog.notes,
    compatibility,
    careNeeds: dog.needsList,
    fosterNote,
    missing,
  };
}

/**
 * Everything the foster wrote, across the whole foster period — notes and photo captions,
 * oldest first, each tagged with its day so the summary can span Day 1 to today.
 */
export const noteTextsFor = (p: AdoptionProfile) => [
  ...p.journalNotes.map((n) => `Day ${n.day}: ${n.text}`),
  ...p.photos.filter((ph) => ph.source === "journal" && ph.caption).map((ph) => `Photo — ${ph.caption}`),
];
