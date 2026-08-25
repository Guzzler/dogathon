import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase";
import { DEFAULT_APPROVAL_CHECKLIST } from "../checklists";

/**
 * Opens an `applications/{id}` doc for a foster applying to a dog -- the queryable-by-both-
 * sides record that `fosters/{uid}.matchedDogId` alone can't be (see
 * docs/shelter-integration.md). A guest can't reach this: applying already requires an
 * account (`SignInToApply`), so `fosterId` is always a real Firebase uid.
 *
 * `shelterId` comes from the dog's own `shelter_id`; a dog missing one (decorative roster
 * entries pre-dating real shelter data) skips the application rather than writing a doc
 * that could never resolve to a shelter.
 */
export async function createApplication(opts: {
  fosterId: string;
  fosterName: string;
  dogId: string;
  shelterId: string | undefined;
}): Promise<void> {
  if (!opts.shelterId) return;
  await addDoc(collection(firestore, "applications"), {
    fosterId: opts.fosterId,
    fosterName: opts.fosterName,
    dogId: opts.dogId,
    shelterId: opts.shelterId,
    status: "submitted",
    checklist: DEFAULT_APPROVAL_CHECKLIST,
    pickup: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
