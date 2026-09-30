import type { Dog, DogSize, DogStatus } from "../types";
import { MANUAL_SOURCE, sizeFromWeight } from "./dog";
import { SHELTERS } from "./shelters";

/**
 * The pure half of RS-6's "add a dog" form: form values in, a `dogs/{id}` document out,
 * with no Firebase import anywhere in the file so it can be unit tested on a clone that has
 * no config. The writes themselves live in `web/src/lib/shelterRoster.ts`.
 *
 * The shape is deliberately the same one `scripts/shelters/sfspca.py`'s `to_dog()` produces.
 * That is the whole point of manual entry as M3's "second source adapter": a hand-entered dog
 * and a scraped one must be indistinguishable downstream, so Discovery, matching, Match and
 * the adoption page all work on it without a single special case.
 */

export { MANUAL_SOURCE };

/** A tri-state answer, stored as the `boolean | null` the schema already uses. */
export type TriState = "yes" | "no" | "unknown";

export interface DogFormValues {
  name: string;
  breed: string;
  ageYears: string;
  weightLbs: string;
  size: "" | DogSize;
  energy: string;
  fosterWeeks: string;
  notes: string;
  photoUrl: string;
  goodWithKids: TriState;
  goodWithDogs: TriState;
  goodWithCats: TriState;
}

export const EMPTY_DOG_FORM: DogFormValues = {
  name: "",
  breed: "",
  ageYears: "",
  weightLbs: "",
  size: "",
  energy: "",
  fosterWeeks: "",
  notes: "",
  photoUrl: "",
  // Unknown is the honest default and the one the scraper writes too. A form that defaulted
  // these to "no" would manufacture a safety claim about a dog nobody assessed.
  goodWithKids: "unknown",
  goodWithDogs: "unknown",
  goodWithCats: "unknown",
};

export const tri = (v: TriState): boolean | null => (v === "unknown" ? null : v === "yes");

/** Field name → message. An empty object means the form is submittable. */
export function validateDogForm(v: DogFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = "A name is required.";
  if (!v.breed.trim()) errors.breed = "A breed is required — “Mixed breed” is a fine answer.";

  const age = Number(v.ageYears);
  if (!v.ageYears.trim()) errors.ageYears = "An age is required.";
  else if (!Number.isFinite(age) || age < 0 || age > 25) errors.ageYears = "Age should be between 0 and 25 years.";

  if (v.weightLbs.trim()) {
    const w = Number(v.weightLbs);
    if (!Number.isFinite(w) || w <= 0 || w > 250) errors.weightLbs = "Weight should be between 1 and 250 lbs.";
  }
  // Size is only required when there's no weight to derive it from -- a published bucket and
  // a weight are both acceptable evidence, but "medium by default" is neither.
  if (!v.size && !v.weightLbs.trim()) errors.size = "Give a weight or pick a size.";

  if (v.energy.trim()) {
    const e = Number(v.energy);
    if (!Number.isInteger(e) || e < 0 || e > 4) errors.energy = "Energy runs 0 (couch potato) to 4 (zoomies).";
  }
  if (v.fosterWeeks.trim()) {
    const w = Number(v.fosterWeeks);
    if (!Number.isInteger(w) || w < 1 || w > 16) errors.fosterWeeks = "Expected stay runs 1 to 16 weeks.";
  }
  if (v.photoUrl.trim() && !isHttpsUrl(v.photoUrl.trim())) {
    errors.photoUrl = "Paste a full https:// link to a photo, or leave it blank.";
  }
  if (v.notes.length > 600) errors.notes = "Keep the write-up under 600 characters.";
  return errors;
}

/**
 * Shape only. Permanence is explicitly not solved here (RS-6's design note): every one of the
 * 19 committed dogs is a hotlinked third-party image already, so a pasted link is the same
 * practice, not a new one. `https` is required because the app is served over it.
 */
export function isHttpsUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A url-safe id derived from the name, namespaced by shelter so a hand-entered dog can never
 * collide with a scraped `sfspca-<slug>`. The suffix is what keeps two dogs called Luna at
 * the same shelter apart.
 */
export function dogIdFor(shelterId: string, name: string, suffix: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "dog";
  return `${shelterId}-manual-${slug}-${suffix}`;
}

/**
 * Form values → the document body. `shelter_id` is passed in from the staff member's own
 * shelter and is never typed, so there is no path by which a form submits someone else's id
 * (the rules refuse it besides).
 *
 * Optional fields are *omitted* rather than written as null, matching `to_dog()`. An absent key
 * means "not recorded", and as of PH-22 that survives the trip through `normalizeDog()`: it
 * still fills `foster_weeks`, `size` and `energy_level` so a card can lay itself out, but it
 * also records on `RichDog.derived` that it had to, and every surface that prints one of the
 * three renders "Not recorded" instead. Before PH-22 this comment was simply wrong, and had
 * been since RS-6 shipped it -- a dog typed in here was the *most* likely record in the app to
 * carry invented facts, because the scraped roster at least gets size and energy from the
 * shelter's own write-up.
 */
export function dogFromForm(v: DogFormValues, shelterId: string, now: string): Omit<Dog, "id"> {
  const weight = v.weightLbs.trim() ? Number(v.weightLbs) : null;
  const dog: Omit<Dog, "id"> = {
    name: v.name.trim(),
    breed: v.breed.trim(),
    age_years: Number(v.ageYears),
    status: "available",
    good_with_kids: tri(v.goodWithKids),
    good_with_dogs: tri(v.goodWithDogs),
    good_with_cats: tri(v.goodWithCats),
    notes: v.notes.trim(),
    shelter_id: shelterId,
    source: MANUAL_SOURCE,
    imported_at: now,
  };
  if (weight != null) {
    dog.weight_lbs = weight;
    dog.size = v.size || sizeFromWeight(weight);
  } else if (v.size) {
    dog.size = v.size;
  }
  if (v.energy.trim()) dog.energy_level = Number(v.energy);
  if (v.fosterWeeks.trim()) dog.foster_weeks = Number(v.fosterWeeks);
  // Straight into `photo_urls`, the same field the scraper writes, so nothing downstream can
  // tell the two apart. Blank stays blank -- `dogPhotoOrNull()` renders the empty tile rather
  // than a placedog stand-in for a source we entered by hand.
  if (v.photoUrl.trim()) dog.photo_urls = [v.photoUrl.trim()];
  // Denormalised only when we actually know the coordinates. `shelters/{id}` carries a name
  // and an address but no lat/lng, and inventing a pin for a real org is worse than none. So a
  // staff shelter missing from `SHELTERS` writes a dog `normalizeDog()` resolves to
  // `shelter: null`, which Discovery does not list (PH-28) -- correct until a second shelter
  // exists. Denormalising its name from `shelters/{id}` is the fix then; there is no second
  // shelter now, and that document has no coordinates to pin.
  const known = SHELTERS.find((s) => s.id === shelterId);
  if (known) dog.shelter = known;
  return dog;
}

/** Retiring and un-retiring are the only status moves the *listed* half of this surface offers. */
export const isListed = (status: DogStatus): boolean => status === "available";
export const retiredStatus: DogStatus = "retired";

export const DOG_STATUS_LABELS: Record<DogStatus, string> = {
  available: "Listed",
  foster: "In a foster home",
  medical_hold: "Medical hold",
  adopted: "Adopted",
  ready_for_adoption: "Ready for adoption",
  retired: "Retired",
};

/**
 * The status moves the roster offers, as a list because one status wants two of them.
 *
 * `ready_for_adoption` is the dog the agent handed back at the end of a foster journey
 * (`send_adoption_profile_to_shelter`). Until RS-12 it fell through to `retire`, which is the
 * wrong verb entirely: retiring says "stop listing this for a reason of our own", while a dog
 * a foster just returned adoption-ready is waiting on a person to do one of two honest things.
 */
export type RosterAction = "retire" | "relist" | "list" | "adopted";

/** Where each action moves the dog. Every target is already a `DogStatus`; nothing new. */
export const ROSTER_ACTION_STATUS: Record<RosterAction, DogStatus> = {
  retire: "retired",
  relist: "available",
  list: "available",
  adopted: "adopted",
};

export const ROSTER_ACTION_LABELS: Record<RosterAction, string> = {
  retire: "Retire",
  relist: "List again",
  list: "List for adoption",
  adopted: "Mark adopted",
};

/**
 * Retiring is offered for anything still on the roster; un-retiring only for a dog this
 * surface retired; `adopted` is terminal and offers nothing -- that is not a checkbox to
 * quietly reopen.
 */
export function rosterActions(status: DogStatus): RosterAction[] {
  if (status === "ready_for_adoption") return ["list", "adopted"];
  if (status === "retired") return ["relist"];
  if (status === "adopted") return [];
  // RS-17: a dog in a foster home comes back onto the roster by hand when the handoff falls
  // through somewhere the inbox can't undo it for them -- a foster who withdrew after pickup
  // was confirmed.
  if (status === "foster") return ["relist", "retire"];
  return ["retire"];
}

/**
 * Which of the roster's sections a dog belongs in.
 *
 * `back` is rendered first and deliberately: `ready_for_adoption` is an arrival, not a resting
 * state -- a dog waiting on a person, which the old flat available/not-available split could
 * not express at all. It sat in the catch-all bucket with a status pill and a Retire button.
 *
 * `foster` (RS-17) is a dog out with one of Pawthway's fosters. Before it had its own group it
 * sat under *Not listed* beside retired dogs, which says "we took this one down" about a dog
 * that is simply away.
 */
export type RosterGroup = "back" | "foster" | "listed" | "rest";

export function rosterGroup(status: DogStatus): RosterGroup {
  if (status === "ready_for_adoption") return "back";
  if (status === "foster") return "foster";
  if (status === "available") return "listed";
  return "rest";
}

/**
 * One pass over the roster instead of inline `filter` calls in the view, so the grouping is
 * decided somewhere a test can reach it without a Firebase config.
 */
export function groupRoster<T extends { status: DogStatus }>(dogs: T[]): Record<RosterGroup, T[]> {
  const groups: Record<RosterGroup, T[]> = { back: [], foster: [], listed: [], rest: [] };
  for (const dog of dogs) groups[rosterGroup(dog.status)].push(dog);
  return groups;
}

/**
 * The staff answers in the inbox that move a dog on or off the roster (RS-17).
 *
 * - `confirm` -- **Confirm pickup**: the dog is going home with a foster.
 * - `unconfirm` -- taking that back: **Undo confirmation**, or **Ask for another time** on a
 *   slot that was confirmed.
 * - `decline` -- declining an application whose pickup was confirmed.
 */
export type HandoffEvent = "confirm" | "unconfirm" | "decline";

/**
 * What the dog's `status` should become when staff answer, or `null` for "leave it alone".
 *
 * **Why the shelter is the writer**, and in the same batch as its answer: the foster's rules
 * cannot write `dogs` and must not (RS-6 -- `update` needs `isStaff(resource.data.shelter_id)`);
 * the agent may write only the foster's matched dog, and only Post Foster's fields (PH-27); and a
 * Cloud Function watching applications would be a third writer of `status`, which RS-10's and
 * RS-16's *one writer per field* rule out. Staff already own the field, so no rule changes.
 *
 * `confirmedHere` is whether *this application* held the confirmation being taken back. Without
 * it, declining one foster's application -- or asking them for another time on a slot nobody had
 * agreed -- would relist a dog that a different foster is holding. It is ignored for `confirm`.
 *
 * Anything but the exact status on the left of each move is left alone: a `medical_hold` or
 * `retired` dog is staff's own earlier decision, and confirming a pickup must not quietly
 * overrule it (the inbox says so beside the button instead).
 */
export function handoffStatus(event: HandoffEvent, current: DogStatus, confirmedHere = true): DogStatus | null {
  if (event === "confirm") return current === "available" ? "foster" : null;
  if (!confirmedHere) return null;
  return current === "foster" ? "available" : null;
}
