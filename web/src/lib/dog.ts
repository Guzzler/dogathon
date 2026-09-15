import type { Dog, DogSize } from "../types";
import { shelterFor, type Shelter } from "./shelters";

/**
 * Which of the three guaranteed fields below this app *invented* rather than read (PH-22).
 *
 * Both dog-writing paths — `dogFromForm()` and the importer's `to_dog()` — deliberately omit a
 * field they have no value for, and `normalizeDog()` then fills the hole so a card can lay
 * itself out. That fallback is honest right up until the same value is printed on a row
 * labelled **Size**, or turned into "12 days left". A default is a fallback when it feeds
 * geometry and a claim when it feeds a labelled row or a sentence; this flag is what lets a
 * render site tell the two apart without every field becoming nullable.
 */
export interface DerivedFields {
  /** No `foster_weeks` and no parseable `foster_length` — the 6 is ours. */
  fosterWeeks: boolean;
  /** No `size` and no `weight_lbs` to bucket — the "medium" is ours. */
  size: boolean;
  /** No `energy_level` — the number came out of `guessEnergy()`'s breed regex. */
  energyLevel: boolean;
}

/** A dog with every Discovery field guaranteed — derived where the record didn't have one. */
export interface RichDog extends Dog {
  /** What was derived rather than recorded. Never render a `true` field as a fact. */
  derived: DerivedFields;
  shelter: Shelter;
  size: DogSize;
  energyLevel: number;
  groomingLevel: "low" | "high" | null;
  coatLength: "short" | "long" | null;
  goodWithCats: boolean | null;
  traitList: string[];
  needsList: string[];
  fosterWeeks: number;
  fosterLength: string;
  photoId: number;
  photos: string[];
  ageLabel: string;
}

export const sizeFromWeight = (lbs: number): DogSize => (lbs < 25 ? "small" : lbs <= 45 ? "medium" : "large");

/**
 * Provenance for a dog a shelter typed in through the RS-6 form, the counterpart of the
 * scraper's `source: "sfspca"`. It lives here rather than next to the form because
 * `dogPhotoOrNull()` below is the thing that has to branch on it, and a form module importing
 * this one is the direction that doesn't make a cycle.
 */
export const MANUAL_SOURCE = "shelter-manual";

/**
 * Rough energy guess for records seeded before `energy_level` existed. A breed regex is a
 * stereotype, not an observation, so anything reading this must consult `derived.energyLevel`
 * before printing it as the shelter's answer.
 */
function guessEnergy(d: Dog): number {
  if (d.age_years >= 8) return 0;
  if (d.age_years >= 6) return 1;
  if (/collie|husky|terrier|shepherd|russell|cattle/i.test(d.breed)) return 4;
  if (d.age_years <= 1) return 3;
  return 2;
}

let photoCounter = 0;
const photoFor = (d: Dog) => {
  if (d.photo) return d.photo;
  let h = 0;
  for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 20) + 1 || ++photoCounter;
};

export function normalizeDog(d: Dog): RichDog {
  // Each of the three is resolved to `null` first and defaulted second, so the question
  // "did anyone record this?" survives the defaulting instead of being answered by it.
  const recordedWeeks = d.foster_weeks ?? parseLegacyLength(d.foster_length);
  // Bucketing a weight the shelter *did* record is a restatement, not an invention, so it
  // counts as recorded. Having neither is the case with nothing behind it.
  const recordedSize = d.size ?? (d.weight_lbs != null ? sizeFromWeight(d.weight_lbs) : null);
  const weeks = recordedWeeks ?? 6;
  return {
    ...d,
    derived: {
      fosterWeeks: recordedWeeks == null,
      size: recordedSize == null,
      energyLevel: d.energy_level == null,
    },
    // A real org travels on the record; shelterFor() is the seeded-demo fallback.
    shelter: d.shelter ?? shelterFor(d.shelter_id, d.id),
    // A published size bucket is better evidence than a weight we had to infer.
    size: recordedSize ?? "medium",
    energyLevel: d.energy_level ?? guessEnergy(d),
    groomingLevel: d.grooming ?? null,
    coatLength: d.coat ?? null,
    goodWithCats: d.good_with_cats ?? null,
    traitList: d.traits ?? [],
    needsList: d.needs ?? [],
    fosterWeeks: weeks,
    fosterLength: formatWeeks(weeks),
    photoId: photoFor(d),
    photos: d.photo_urls ?? [],
    ageLabel:
      d.age_years < 1
        ? `${Math.max(1, Math.round(d.age_years * 12))} mo`
        : d.age_years === 1
          ? "1 yr"
          : `${d.age_years} yrs`,
  };
}

/**
 * The recorded expected stay and its label, or `[null, null]` when nobody recorded one — the
 * argument pair `fosterWindow()` wants (PH-22). Spread it: `fosterWindow(...recordedStay(d), p)`.
 * It lives here rather than at the four call sites so none of them has to remember that
 * `fosterWeeks` is always populated and only sometimes true.
 */
export const recordedStay = (d: RichDog): [number | null, string | null] =>
  d.derived.fosterWeeks ? [null, null] : [d.fosterWeeks, d.fosterLength];

/** "1 week", "6 weeks", "3 months" — months once a stay passes two. */
export function formatWeeks(weeks: number): string {
  if (weeks <= 1) return "1 week";
  if (weeks < 8) return `${weeks} weeks`;
  const months = Math.round(weeks / 4.345);
  return `${months} month${months === 1 ? "" : "s"}`;
}

/** Pull a week count out of older free-text values like "4–6 weeks". */
function parseLegacyLength(text: string | undefined): number | null {
  if (!text) return null;
  const nums = text.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return /month/i.test(text) ? Math.round(avg * 4.345) : Math.round(avg);
}

/**
 * A real photo, or `null` when there genuinely isn't one (RS-6).
 *
 * The placedog stand-in is fine for the seeded demo roster -- it is obviously scenery. It is
 * not fine for a dog a shelter typed in by hand: a stock photograph of some *other* animal on
 * a real adoptable record is indistinguishable from a photo the staff member believes they
 * supplied, which is exactly the "unknown is not a claim" failure. Provenance is what
 * separates the two cases, so the fallback is keyed on `source`.
 */
export const dogPhotoOrNull = (d: RichDog, w = 800, h = 1000): string | null =>
  d.photos[0] ?? (d.source === MANUAL_SOURCE ? null : photoUrl(d.photoId, w, h));

/**
 * Inline background for a square thumbnail, so the five call sites that render one don't each
 * have to branch on the no-photo case. Falls back to the flat cream tile, which reads as an
 * empty slot rather than as a picture.
 */
export function thumbBackground(d: RichDog, w = 300, h = 300): string {
  const url = dogPhotoOrNull(d, w, h);
  return url ? `var(--cream-2) url(${url}) center/cover` : "var(--cream-2)";
}

export const photoUrl = (n: number, w = 800, h = 1000) => `https://placedog.net/${w}/${h}?id=${n}`;
export const sizeLabel = (s: DogSize) => ({ small: "Small", medium: "Medium", large: "Large" }[s]);
export const ENERGY_WORD = ["Couch potato", "Low", "Medium", "High", "Zoomies"];
