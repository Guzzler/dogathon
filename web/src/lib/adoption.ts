import type { CareLogEntry, Foster } from "../types";
import type { JournalEntry, Milestone, ScheduleBlock } from "../phases/careplan/types";
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
  /**
   * Only what the app actually holds: care items the foster ticked off, and vet visits they
   * logged. `null` when there is nothing — never a template. This used to be a constant
   * written for a demo dog, so every adoption page printed the same vaccines and the same
   * "Allergies: None reported"; allergies have no source anywhere in this app, so the row
   * does not render at all rather than reading as a clean bill of health nobody gave.
   */
  medical: { vaccines: string[]; medications: string[]; vetVisits: string[] } | null;
  /** Latest recorded weight. `"care plan"` means the foster weighed the dog themselves. */
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

/**
 * The heading over the shelter-recorded facts. Named for the org when we know it, and plain
 * "The shelter's record" when we don't — never another org's name standing in (PH-28).
 */
export const shelterRecordTitle = (dog: Pick<RichDog, "shelter">): string =>
  dog.shelter ? `${dog.shelter.short}'s record` : "The shelter's record";

export function buildAdoptionProfile(
  dog: RichDog,
  foster: Foster | null,
  entries: CareLogEntry[],
  journal: JournalEntry[] = [],
  schedule: ScheduleBlock[] = [],
  dayInFoster = Number.POSITIVE_INFINITY,
  milestones: Milestone[] = [],
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

  // A weigh-in the foster logged, else the shelter's intake figure, else the size bucket.
  // Deliberately no fourth source: this used to fall through to the last milestone carrying a
  // weight, and while the milestones were seeded that printed a number nobody measured under
  // a provenance line saying the foster measured it.
  const weight = logWeighIns.length
    ? { value: logWeighIns[logWeighIns.length - 1].value, source: "care plan" as const }
    : dog.weight_lbs != null
    ? { value: `${dog.weight_lbs} lb`, source: "shelter" as const }
    : { value: sizeLabel(dog.size), source: "shelter" as const };

  // Medical facts with an actual source. Ticked vaccine/medication rows are the foster saying
  // it happened; `vet_visit` entries are the same. Nothing here is filled in when empty.
  const ticked = (kind: string) => careDone.filter((c) => c.kind === kind).map((c) => c.label);
  const vaccines = ticked("vaccine");
  const medications = ticked("medication");
  const vetVisits = entries
    .filter((e) => e.type === "vet_visit")
    .map((e) => e.note?.trim() || e.value?.trim())
    .filter((t): t is string => !!t);
  const medical = vaccines.length || medications.length || vetVisits.length
    ? { vaccines, medications, vetVisits }
    : null;

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
  if (!medical) missing.push("medical record");
  if (!fosterNote) missing.push("your note");

  return {
    photos,
    hasJournalPhotos: journalPhotos.length > 0,
    journalNotes,
    careDone,
    careOutstanding,
    milestones: milestoneList,
    medical,
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

/**
 * PH-32. The part of an adoption page a foster **publishes** to `adoptionProfiles/{dogId}` --
 * everything the foster supplied, and nothing the shelter did. The shared link keeps reading the
 * shelter's record live off `dogs/{id}`, so a published snapshot can never go stale about it, and
 * a stranger never reads the foster's private document (which `firestore.rules` wouldn't let
 * them do anyway -- that is why the link used to show nothing but empty states).
 *
 * A weight survives only when the foster measured it: the shelter's intake figure is the
 * shelter's, and the reader gets it from the live record instead.
 */
export interface PublishedPart {
  journalNotes: AdoptionProfile["journalNotes"];
  photos: AdoptionProfile["photos"];
  careDone: AdoptionProfile["careDone"];
  careOutstanding: number;
  milestones: AdoptionProfile["milestones"];
  medical: AdoptionProfile["medical"];
  weight: AdoptionProfile["weight"] | null;
  fosterNote: string | null;
  tags: string[];
  summary: string;
}

/**
 * Firestore refuses `undefined` and hands maps back in its own key order, so the part is
 * normalised once -- `undefined` dropped -- before it is written *and* before it is compared.
 */
const normalise = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function publishedPart(profile: AdoptionProfile, tags: string[], summary: string): PublishedPart {
  return normalise({
    journalNotes: profile.journalNotes,
    photos: profile.photos.filter((p) => p.source === "journal"),
    careDone: profile.careDone,
    careOutstanding: profile.careOutstanding,
    milestones: profile.milestones,
    medical: profile.medical,
    weight: profile.weight.source === "care plan" ? profile.weight : null,
    fosterNote: profile.fosterNote,
    tags,
    summary,
  });
}

/** A key-order-independent fingerprint, so "Publish changes" means a change and not a re-read. */
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort()
      .map((k) => `${JSON.stringify(k)}:${fingerprint((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const PART_KEYS: (keyof PublishedPart)[] = [
  "journalNotes", "photos", "careDone", "careOutstanding", "milestones",
  "medical", "weight", "fosterNote", "tags", "summary",
];

/** True when `live` is what was published -- comparing only the published fields. */
export function samePublished(live: PublishedPart, published: Partial<PublishedPart>): boolean {
  const pick = (p: Partial<PublishedPart>) =>
    Object.fromEntries(PART_KEYS.map((k) => [k, p[k] ?? null]));
  return fingerprint(pick(normalise(live))) === fingerprint(pick(published));
}

/**
 * The page a reader sees: the shelter-only profile (`buildAdoptionProfile(dog, null, ...)`) with
 * the published part laid over it. `null` -- nothing published -- returns it unchanged, so the
 * reader gets the shelter's record and honest empty states, never somebody else's journal.
 */
export function withPublished(
  profile: AdoptionProfile,
  part: Partial<PublishedPart> | null,
): AdoptionProfile {
  if (!part) return profile;
  const journalPhotos = (part.photos ?? []).filter((p) => p.source === "journal");
  const journalNotes = part.journalNotes ?? [];
  const careDone = part.careDone ?? [];
  const medical = part.medical ?? null;
  const fosterNote = part.fosterNote?.trim() || null;

  const missing: string[] = [];
  if (!journalPhotos.length) missing.push("photos");
  if (!journalNotes.length) missing.push("journal notes");
  if (!careDone.length) missing.push("care plan items");
  if (!medical) missing.push("medical record");
  if (!fosterNote) missing.push("your note");

  return {
    ...profile,
    photos: [...profile.photos.filter((p) => p.source === "shelter"), ...journalPhotos],
    hasJournalPhotos: journalPhotos.length > 0,
    journalNotes,
    careDone,
    careOutstanding: part.careOutstanding ?? 0,
    milestones: part.milestones ?? [],
    medical,
    weight: part.weight?.source === "care plan" ? part.weight : profile.weight,
    fosterNote,
    missing,
  };
}
