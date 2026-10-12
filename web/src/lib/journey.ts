import { addDoc, collection, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { firestore } from "../firebase";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_CARE_CHECKLIST, DEFAULT_PREP_CHECKLIST } from "../checklists";
import type { CareLogEntry, ChecklistItem, Foster, JourneyArchive } from "../types";
import { appendLocalJourney, stampLocalCareLog } from "./localMode";
import { fosterDocId } from "./session";

/**
 * A journey's records belong to the dog they were written about (PH-36).
 *
 * Nothing on `fosters/{uid}` that describes a foster period is keyed by dog -- one journal, one
 * schedule, one pickup, one set of checklists -- so before this, a foster who finished with dog A
 * and applied for dog B opened B's Care Plan on A's journal, and B's adoption page printed A's
 * weigh-ins under B's name. Rather than re-key every per-journey field (that rewrites ~20 call
 * sites to protect one transition), the current journey stays where it is and **the moment
 * `matchedDogId` moves off a dog is the moment its records are filed**: archived whole to
 * `fosters/{uid}/journeys`, then reset. Nothing is deleted -- a foster's notes about a dog they
 * loved are theirs -- and nothing is carried.
 */

/** The per-journey fields on `Foster`, archived and reset together. */
export const JOURNEY_FIELDS = [
  "journal", "careSchedule", "adoptionNote", "adoptionHighlights", "pickup",
  "prepChecklist", "careChecklist", "approvalChecklist", "readyForAdoption",
] as const;

const anyDone = (items: ChecklistItem[] | undefined) => (items ?? []).some((i) => i.done);

/** Whether the foster's document holds anything about the current dog worth filing. */
export function hasJourney(foster: Foster): boolean {
  return Boolean(
    foster.journal?.length
    || foster.careSchedule?.length
    || foster.adoptionNote?.trim()
    || foster.adoptionHighlights
    || foster.pickup
    || foster.readyForAdoption
    || anyDone(foster.prepChecklist)
    || anyDone(foster.careChecklist)
    || anyDone(foster.approvalChecklist),
  );
}

/**
 * Whether a care-log entry is about `dogId`. An untagged entry predates the tag and is the current
 * journey's until the first `leaveJourney` stamps it -- honest, because before PH-36 no foster
 * could have *completed* a second journey. Mirrored by `belongs_to` in src/agent/builtin/care.py.
 */
export function belongsToDog(entry: Pick<CareLogEntry, "dogId">, dogId: string | null | undefined): boolean {
  return !entry.dogId || entry.dogId === dogId;
}

/** True when this patch takes `matchedDogId` off the dog the foster currently has. */
export function movesOffDog(foster: Foster | null | undefined, nextDogId: string | null): boolean {
  return Boolean(foster?.matchedDogId) && foster!.matchedDogId !== nextDogId;
}

/**
 * The fields as they stood, for the archive. Firestore rejects `undefined`, so a field the
 * foster never wrote is left out rather than written empty.
 */
export function archiveOf(foster: Foster, dogId: string): Omit<JourneyArchive, "archivedAt"> {
  const archive: Omit<JourneyArchive, "archivedAt"> = {
    dogId,
    pickup: foster.pickup ?? null,
    readyForAdoption: foster.readyForAdoption ?? false,
    prepChecklist: foster.prepChecklist ?? [],
    careChecklist: foster.careChecklist ?? [],
    approvalChecklist: foster.approvalChecklist ?? [],
  };
  if (foster.journal !== undefined) archive.journal = foster.journal;
  if (foster.careSchedule !== undefined) archive.careSchedule = foster.careSchedule;
  if (foster.adoptionNote !== undefined) archive.adoptionNote = foster.adoptionNote;
  if (foster.adoptionHighlights !== undefined) archive.adoptionHighlights = foster.adoptionHighlights;
  return archive;
}

/**
 * What the foster document looks like at the start of a journey. `careSchedule`, `adoptionNote`
 * and `adoptionHighlights` are named with no value, which `patchFoster` reads as *remove* -- the
 * same absent-not-blank state a foster who never wrote one has.
 */
export function journeyReset(): Record<string, unknown> {
  return {
    journal: [],
    pickup: null,
    readyForAdoption: false,
    approvalChecklist: DEFAULT_APPROVAL_CHECKLIST,
    prepChecklist: DEFAULT_PREP_CHECKLIST,
    careChecklist: DEFAULT_CARE_CHECKLIST,
    careSchedule: undefined,
    adoptionNote: undefined,
    adoptionHighlights: undefined,
  };
}

/** Stamp every untagged `careLog` entry with `dogId`, in one batch. Returns how many. */
async function stampCareLog(uid: string, dogId: string): Promise<number> {
  const snap = await getDocs(collection(firestore, "fosters", uid, "careLog"));
  const untagged = snap.docs.filter((d) => !(d.data() as Partial<CareLogEntry>).dogId);
  if (!untagged.length) return 0;
  const batch = writeBatch(firestore);
  for (const d of untagged) batch.update(d.ref, { dogId });
  await batch.commit();
  return untagged.length;
}

/**
 * File the foster's current journey under the dog it was about, and hand back the patch that
 * resets it. Call at every site that moves `matchedDogId` off a dog, and merge the result into
 * that site's own `patchFoster` -- the archive is written here, the reset is the caller's write.
 *
 * Writes nothing and returns `{}` when there is no matched dog. With a matched dog but nothing
 * on the document worth filing, it still stamps the care log (the agent can log entries without
 * touching the document) and returns `{}`: there is nothing to reset.
 *
 * Throws if a write fails, before the caller has moved the pointer -- so a failure leaves the
 * journey exactly where it was, never reset without an archive.
 */
export async function leaveJourney(foster: Foster | null | undefined): Promise<Record<string, unknown>> {
  const dogId = foster?.matchedDogId;
  if (!foster || !dogId) return {};
  const uid = fosterDocId();

  if (hasJourney(foster)) {
    const archive = archiveOf(foster, dogId);
    if (uid) {
      await addDoc(collection(firestore, "fosters", uid, "journeys"), { ...archive, archivedAt: serverTimestamp() });
    } else {
      appendLocalJourney({ ...archive, archivedAt: new Date().toISOString() });
    }
  }

  if (uid) await stampCareLog(uid, dogId);
  else stampLocalCareLog(dogId);

  return hasJourney(foster) ? journeyReset() : {};
}
