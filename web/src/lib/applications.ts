import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import { DEFAULT_APPROVAL_CHECKLIST } from "../checklists";
import type { ApplicationStatus, ChecklistItem, Pickup } from "../types";

/**
 * Opens an `applications/{id}` doc for a foster applying to a dog -- the queryable-by-both-
 * sides record that `fosters/{uid}.matchedDogId` alone can't be (see
 * docs/shelter-integration.md). A guest can't reach this: applying already requires an
 * account (`SignInToApply`), so `fosterId` is always a real Firebase uid.
 *
 * `shelterId` comes from the dog's own `shelter_id`. A dog missing one throws rather than
 * returning quietly (PH-31): both callers gate on `isListable()` and write the foster record
 * only after this resolves, so a silent skip here would have committed the foster to a dog
 * whose shelter was never told.
 */
export async function createApplication(opts: {
  fosterId: string;
  fosterName: string;
  dogId: string;
  shelterId: string | undefined;
}): Promise<void> {
  if (!opts.shelterId) throw new Error(`Dog ${opts.dogId} has no shelter_id to apply to`);
  await addDoc(collection(firestore, "applications"), {
    fosterId: opts.fosterId,
    fosterName: opts.fosterName,
    dogId: opts.dogId,
    shelterId: opts.shelterId,
    status: "submitted",
    checklist: DEFAULT_APPROVAL_CHECKLIST,
    pickup: null,
    pickupConfirmedAt: null,
    pickupDeclinedAt: null,
    pickupNote: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * The foster's pickup request, written where the shelter reads it (RS-14). Before this the slot
 * lived only on `fosters/{uid}.pickup`, which no shelter can read, so a "request" had no
 * addressee.
 *
 * Always clears the shelter's answer -- `pickupConfirmedAt`, and since RS-15 `pickupDeclinedAt`
 * and `pickupNote`: a new slot, or withdrawing the request with `null`, is not the slot the
 * shelter answered. `null` is also the only value `firestore.rules`' foster pickup branch lets a
 * foster write to any of the three; answering is staff-only (`setPickupConfirmed`,
 * `askForAnotherTime`). A foster must never be able to write a note in the shelter's voice.
 */
export async function requestPickup(applicationId: string, pickup: Pickup | null): Promise<void> {
  await updateDoc(doc(firestore, "applications", applicationId), {
    pickup,
    pickupConfirmedAt: null,
    pickupDeclinedAt: null,
    pickupNote: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Staff agreeing to (or, with `confirmed: false`, taking back) the foster's requested slot.
 * The staff branch of the update rule already allows it; a foster calling this is refused.
 *
 * Either way it clears an earlier "ask for another time" (RS-15): confirming after asking is the
 * shelter changing its mind, and the two answers must never both stand on one slot.
 */
export async function setPickupConfirmed(applicationId: string, confirmed: boolean): Promise<void> {
  await updateDoc(doc(firestore, "applications", applicationId), {
    pickupConfirmedAt: confirmed ? serverTimestamp() : null,
    pickupDeclinedAt: null,
    pickupNote: null,
    updatedAt: serverTimestamp(),
  });
}

/** The longest note staff can send with "Ask for another time" -- one or two sentences. */
export const PICKUP_NOTE_MAX = 200;

/**
 * Staff's second answer to a pickup request (RS-15): they can't make that slot. Leaves `pickup`
 * as it is so the foster sees *which* slot was turned down, and never proposes a slot of its own
 * -- a second writer of `pickup` is the drift RS-14 designed out; a counter-offer goes in the
 * note, in words. A blank note is stored as `null`, so the foster sees no stand-in text.
 */
export async function askForAnotherTime(applicationId: string, note: string): Promise<void> {
  const trimmed = note.trim().slice(0, PICKUP_NOTE_MAX);
  await updateDoc(doc(firestore, "applications", applicationId), {
    pickupDeclinedAt: serverTimestamp(),
    pickupConfirmedAt: null,
    pickupNote: trimmed || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Moves an application forward. Only staff reach this -- the foster's branches of
 * `firestore.rules`' update rule are narrowed to setting `withdrawn` and to the pickup request,
 * so a foster calling this with anything but `withdrawn` would be refused by the database.
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
