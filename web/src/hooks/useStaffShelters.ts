import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "../firebase";

/**
 * The `shelters/{id}` document a staff member's own record actually looks like -- distinct
 * from `web/src/lib/shelters.ts`'s `Shelter` (the static browsing-side list with map
 * coordinates), which is a different shape backing a different surface.
 */
export interface StaffShelter {
  id: string;
  name: string;
  address: string;
  staffUids: string[];
}

/**
 * Which shelter(s), if any, the signed-in uid staffs.
 *
 * A `getDoc` on `shelters/{id}` can't tell "not staff" from "no such shelter" -- both read as
 * `permission-denied` against `firestore.rules`' `staffUids` check, since a missing document
 * and a document you can't read collapse to the same thing. This query form sidesteps that:
 * the rules engine can prove every matching doc is readable (the documented secure-query
 * pattern), so a signed-in non-staff uid just gets zero results back, not an error. See
 * docs/initiatives/real-data-and-shelters.md, "The staff-resolution bug, and the fix".
 */
export type StaffSheltersResult =
  | { state: "loading" }
  | { state: "notStaff" }
  | { state: "error" }
  | { state: "staff"; shelters: StaffShelter[] };

/** What we last resolved, and for whom — so switching users can't show the previous one's access. */
type Snapshot = { for: string; result: StaffSheltersResult };

export function useStaffShelters(uid: string | null): StaffSheltersResult {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(firestore, "shelters"), where("staffUids", "array-contains", uid));
    return onSnapshot(
      q,
      (snap) => {
        const shelters = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffShelter, "id">) }));
        setSnapshot({ for: uid, result: shelters.length ? { state: "staff", shelters } : { state: "notStaff" } });
      },
      () => setSnapshot({ for: uid, result: { state: "error" } }),
    );
  }, [uid]);

  // Derived rather than stored, so a signed-out visit and a user switch both read correctly
  // without an extra setState round trip inside the effect.
  if (!uid) return { state: "notStaff" };
  if (snapshot?.for !== uid) return { state: "loading" };
  return snapshot.result;
}

/**
 * Carries the shelters StaffGate already resolved down to the screens behind it, so they
 * don't each re-run the query the gate just ran to let them through.
 */
const StaffShelterContext = createContext<StaffShelter[]>([]);
export const StaffShelterProvider = StaffShelterContext.Provider;
export const useMyShelters = () => useContext(StaffShelterContext);
