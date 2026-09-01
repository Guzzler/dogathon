import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import type { FirestoreError } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Application } from "../types";
import { byNewest } from "../lib/applicationView";

/**
 * One shelter's applications, newest first.
 *
 * `where("shelterId","==",id)` + `orderBy("createdAt","desc")` is exactly the composite index
 * shipped in `firestore.indexes.json` (RS-7) and confirmed `READY` (RS-9). Queried one shelter
 * at a time rather than with an `in` over every shelter the staff member belongs to: the read
 * rule is `fosterId == uid || isStaff(shelterId)`, and a single equality on `shelterId` is the
 * shape the rules engine can prove safe for a list. Staff at more than one shelter get a
 * switcher in the UI instead.
 */
export type ApplicationsResult =
  | { state: "loading" }
  | { state: "ready"; applications: Application[] }
  | { state: "error"; code: string | undefined };

/** What we last resolved, and for which subscription -- see the derivation note below. */
type Snapshot = { key: string; result: ApplicationsResult };

export function useShelterApplications(shelterId: string | null): {
  result: ApplicationsResult;
  retry: () => void;
} {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Bumped by retry() to re-run the effect. `onSnapshot` does not reconnect on its own once
  // it has surfaced a terminal error, so resubscribing from scratch *is* the retry.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const key = `${shelterId ?? ""}#${attempt}`;

  useEffect(() => {
    if (!shelterId) return;
    return onSnapshot(
      query(
        collection(firestore, "applications"),
        where("shelterId", "==", shelterId),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        const applications = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Application, "id">) }))
          .sort(byNewest);
        setSnapshot({ key, result: { state: "ready", applications } });
      },
      (err: FirestoreError) => setSnapshot({ key, result: { state: "error", code: err.code } }),
    );
  }, [shelterId, key]);

  // Derived rather than stored, same as useStaffShelters: switching shelters (or retrying)
  // reads as "loading" immediately, without an extra setState round trip inside the effect.
  if (!shelterId) return { result: { state: "ready", applications: [] }, retry };
  if (snapshot?.key !== key) return { result: { state: "loading" }, retry };
  return { result: snapshot.result, retry };
}
