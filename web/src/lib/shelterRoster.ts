import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import { dogFromForm, dogIdFor, retiredStatus, type DogFormValues } from "./shelterDog";
import type { DogStatus } from "../types";

/**
 * The two writes RS-6 adds to `dogs/{id}`, kept apart from `shelterDog.ts` so the pure form
 * logic stays testable without a Firebase config.
 *
 * Both are refused by `firestore.rules` unless the caller is staff at the shelter the dog
 * belongs to, so the checks here are for a decent error message, not for safety.
 */

/** Short, collision-resistant enough for two dogs added at the same shelter on the same day. */
const suffix = () => Math.random().toString(36).slice(2, 6);

/**
 * Creates the dog and returns its id. `setDoc` with a derived id rather than `addDoc`, so a
 * dog's id says where it came from -- the same readability the scraper's `sfspca-<slug>` has,
 * and what lets `import_dogs.py` recognise a hand-entered record it must not delete.
 *
 * The existence check closes the (small) window where two dogs with the same name draw the
 * same random suffix; a second collision just fails the write rather than silently
 * overwriting a real dog's record.
 */
export async function addShelterDog(values: DogFormValues, shelterId: string): Promise<string> {
  const id = dogIdFor(shelterId, values.name, suffix());
  const ref = doc(firestore, "dogs", id);
  if ((await getDoc(ref)).exists()) throw new Error("That id is already taken — try again.");
  await setDoc(ref, dogFromForm(values, shelterId, new Date().toISOString()));
  return id;
}

/**
 * Retire or re-list. A status change, never a delete: an application already open against
 * this dog keeps resolving, and the foster mid-journey isn't dropped onto a "no foster yet"
 * screen with no route back.
 */
export async function setDogStatus(dogId: string, status: DogStatus): Promise<void> {
  await updateDoc(doc(firestore, "dogs", dogId), { status, updatedAt: serverTimestamp() });
}

export const retireDog = (dogId: string) => setDogStatus(dogId, retiredStatus);
export const relistDog = (dogId: string) => setDogStatus(dogId, "available");
