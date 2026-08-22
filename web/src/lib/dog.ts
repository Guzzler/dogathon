import type { Dog, DogSize } from "../types";
import { shelterFor, type Shelter } from "./shelters";

/** A dog with every Discovery field guaranteed — derived where the record didn't have one. */
export interface RichDog extends Dog {
  shelter: Shelter;
  size: DogSize;
  energyLevel: number;
  groomingLevel: "low" | "high";
  coatLength: "short" | "long";
  goodWithCats: boolean;
  traitList: string[];
  needsList: string[];
  fosterLength: string;
  photoId: number;
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
  return {
    ...d,
    shelter: shelterFor(d.shelter_id, d.id),
    size: sizeFromWeight(d.weight_lbs),
    energyLevel: d.energy_level ?? guessEnergy(d),
    groomingLevel: d.grooming ?? "low",
    coatLength: d.coat ?? "short",
    goodWithCats: d.good_with_cats ?? false,
    traitList: d.traits ?? [],
    needsList: d.needs ?? [],
    fosterLength: d.foster_length ?? "4–6 weeks",
    photoId: photoFor(d),
    ageLabel: d.age_years === 1 ? "1 yr" : `${d.age_years} yrs`,
  };
}

export const photoUrl = (n: number, w = 800, h = 1000) => `https://placedog.net/${w}/${h}?id=${n}`;
export const sizeLabel = (s: DogSize) => ({ small: "Small", medium: "Medium", large: "Large" }[s]);
export const ENERGY_WORD = ["Couch potato", "Low", "Medium", "High", "Zoomies"];
