import type { CareLogEntry, Foster } from "../types";
import type { JournalEntry, Milestone, ScheduleBlock } from "../phases/careplan/types";
import { medicalSummary, seedMilestones } from "../phases/careplan/data";
import { ENERGY_WORD, dogPhotoOrNull, sizeLabel, type RichDog } from "./dog";

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
  photos: { url: string; caption?: string; date: string; source: "shelter" | "journal" }[];
  hasJournalPhotos: boolean;
  /** Every note the foster logged, oldest first — the whole foster period, not just recent. */
  journalNotes: { date: string; text: string; starred: boolean; day: number }[];

  /** Care items the foster has ticked off in the Care Plan — updates as they tick. */
  careDone: { label: string; kind: string; block: string }[];
  careOutstanding: number;
  /** Vet visits and weigh-ins from the Care Plan timeline. */
  milestones: { day: number; title: string; kind: string; note?: string; weight?: number }[];
  medical: { vaccines: string[]; allergies: string[]; medications: string[] };
  /** Latest recorded weight, from a milestone weigh-in if there is one. */
  weight: { value: string; source: "care plan" | "shelter" };

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

export function buildAdoptionProfile(
  dog: RichDog,
  foster: Foster | null,
  entries: CareLogEntry[],
  journal: JournalEntry[] = [],
  schedule: ScheduleBlock[] = [],
  dayInFoster = Number.POSITIVE_INFINITY,
  milestones: Milestone[] = seedMilestones,
): AdoptionProfile {
  // Oldest first, so the page and the summary both read Day 1 → today rather than newest-first.
  const byDay = [...journal].sort((a, b) => a.dayInFoster - b.dayInFoster);

  // Only entries that actually carry an image. Early builds logged a colour swatch when the
  // composer couldn't upload, and a blank tile on a page someone reads to decide about a real
  // animal is worse than one fewer photo.
  const journalPhotos = byDay
    .filter((e) => e.kind === "photo" && e.photoUrl)
    .map((e) => ({
      url: e.photoUrl!, caption: e.caption,
      date: e.createdAt, source: "journal" as const,
    }));

  // The carousel opens on the shelter's own photo, then everything the foster added.
  // A dog with no shelter photo simply has no shelter slide -- a stand-in photograph of a
  // different animal on the page a stranger reads to decide about this one is exactly what
  // "nothing on this page is invented" rules out.
  const shelterPhoto = dogPhotoOrNull(dog, 700, 700);
  const photos = [
    ...(shelterPhoto ? [{ url: shelterPhoto, date: "From the shelter", source: "shelter" as const }] : []),
    ...journalPhotos,
  ];

  // Every note across the whole foster period. `starred` is kept as a marker rather than a
  // filter — a summary that only saw starred entries would miss most of what happened.
  const journalNotes = byDay
    .filter((e) => e.kind === "note" && e.text?.trim())
    .map((e) => ({ date: e.createdAt, text: e.text!.trim(), starred: e.starred, day: e.dayInFoster }));

  // Health comes from the Care Plan: items the foster ticks off, plus timeline milestones.
  const items = schedule.flatMap((b) => b.items.map((i) => ({ ...i, block: b.label })));
  const careDone = items.filter((i) => i.done).map((i) => ({ label: i.label, kind: i.kind, block: i.block }));
  const careOutstanding = items.length - careDone.length;

  const passed = milestones.filter((m) => m.dayInFoster <= dayInFoster && !m.upcoming);
  const milestoneList = passed.map((m) => ({
    day: m.dayInFoster, title: m.title, kind: m.kind, note: m.note, weight: m.weightLbs,
  }));

  // The older careLog collection still counts if anything wrote to it.
  const logWeighIns = entries.filter((e) => e.type === "weigh_in" && e.value);
  const lastMilestoneWeight = [...passed].reverse().find((m) => m.weightLbs)?.weightLbs;

  const weight = logWeighIns.length
    ? { value: logWeighIns[logWeighIns.length - 1].value, source: "care plan" as const }
    : lastMilestoneWeight
    ? { value: `${lastMilestoneWeight} lb`, source: "care plan" as const }
    : dog.weight_lbs != null
    ? { value: `${dog.weight_lbs} lb`, source: "shelter" as const }
    : { value: sizeLabel(dog.size), source: "shelter" as const };

  const shelterFacts = [
    { label: "Breed", value: dog.breed },
    { label: "Age", value: dog.ageLabel },
    { label: "Size", value: sizeLabel(dog.size) + (dog.weight_lbs != null ? ` · ${dog.weight_lbs} lb at intake` : "") },
    { label: "Energy level", value: ENERGY_WORD[dog.energyLevel] },
    ...(dog.groomingLevel || dog.coatLength
      ? [{ label: "Grooming", value: [
          dog.groomingLevel && (dog.groomingLevel === "low" ? "Low" : "High"),
          dog.coatLength && `${dog.coatLength} coat`,
        ].filter(Boolean).join(" · ") }]
      : []),
  ];

  // All three are tri-state: a shelter that never recorded it is not the same as a "no",
  // and printing "Not recommended" for an unknown is a claim about a real animal.
  const compat = (ok: boolean | null | undefined) => ({
    known: ok != null,
    value: ok == null ? "Not tested" : ok ? "Yes" : "Not recommended",
  });
  const compatibility = [
    { label: "Kids", ...compat(dog.good_with_kids) },
    { label: "Dogs", ...compat(dog.good_with_dogs) },
    { label: "Cats", ...compat(dog.good_with_cats) },
  ];

  const fosterNote = foster?.adoptionNote?.trim() || null;

  const missing: string[] = [];
  if (!journalPhotos.length) missing.push("photos");
  if (!journalNotes.length) missing.push("journal notes");
  if (!careDone.length) missing.push("care plan items");
  if (!fosterNote) missing.push("your note");

  return {
    photos,
    hasJournalPhotos: journalPhotos.length > 0,
    journalNotes,
    careDone,
    careOutstanding,
    milestones: milestoneList,
    medical: medicalSummary,
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
 * Everything the foster wrote across the whole foster period — notes and photo captions.
 * Deliberately undated: the summary should read as one picture of the dog, not a diary.
 */
export const noteTextsFor = (p: AdoptionProfile) => [
  ...p.journalNotes.map((n) => n.text),
  ...p.photos.filter((ph) => ph.source === "journal" && ph.caption).map((ph) => ph.caption!),
];
