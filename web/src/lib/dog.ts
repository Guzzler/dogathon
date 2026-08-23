import type { Dog, DogSize } from "../types";
import { shelterFor, type Shelter } from "./shelters";

/** A dog with every Discovery field guaranteed — derived where the record didn't have one. */
export interface RichDog extends Dog {
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

/** Rough energy guess for records seeded before `energy_level` existed. */
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
  const weeks = d.foster_weeks ?? parseLegacyLength(d.foster_length) ?? 6;
  return {
    ...d,
    // A real org travels on the record; shelterFor() is the seeded-demo fallback.
    shelter: d.shelter ?? shelterFor(d.shelter_id, d.id),
    // A published size bucket is better evidence than a weight we had to infer.
    size: d.size ?? (d.weight_lbs != null ? sizeFromWeight(d.weight_lbs) : "medium"),
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

/** A real photo when the source gave us one, otherwise the placedog stand-in. */
export const dogPhoto = (d: RichDog, w = 800, h = 1000) => d.photos[0] ?? photoUrl(d.photoId, w, h);

export const photoUrl = (n: number, w = 800, h = 1000) => `https://placedog.net/${w}/${h}?id=${n}`;
export const sizeLabel = (s: DogSize) => ({ small: "Small", medium: "Medium", large: "Large" }[s]);
export const ENERGY_WORD = ["Couch potato", "Low", "Medium", "High", "Zoomies"];
