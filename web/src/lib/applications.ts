import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import { DEFAULT_APPROVAL_CHECKLIST } from "../checklists";
import type { ApplicationStatus, ChecklistItem } from "../types";

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

/**
 * Moves an application forward. Only staff reach this -- `firestore.rules`' update rule has
 * exactly two branches, and the foster's is narrowed to setting `withdrawn` and nothing else,
 * so a foster calling this would simply be refused by the database.
 */
export async function setApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
  await updateDoc(doc(firestore, "applications", id), { status, updatedAt: serverTimestamp() });
}

/**
 * Ticks one checklist item on the application. Firestore has no "update the nth array element"
 * operation, so the caller passes the whole list back -- which is also why the rules pin
 * `checklist` on the foster branch (PH-16): a wholesale array write is exactly what that
 * branch must not be able to do.
 *
 * Deliberately does *not* touch `fosters/{uid}.approvalChecklist`. Joining the shelter's copy
 * to the foster's is RS-10, by `ChecklistItem.owner` with one writer per field; writing both
 * from here would be the last-write-wins mirror that item explicitly rules out.
 */
export async function setApplicationChecklist(id: string, checklist: ChecklistItem[]): Promise<void> {
  await updateDoc(doc(firestore, "applications", id), { checklist, updatedAt: serverTimestamp() });
}
