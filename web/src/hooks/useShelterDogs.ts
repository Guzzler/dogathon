import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { FirestoreError } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Dog } from "../types";

/**
 * One shelter's own roster (RS-6).
 *
 * A single equality on `shelter_id` and no `orderBy`, so **no composite index is needed** --
 * don't add one to `firestore.indexes.json` for this. Sorting is done here, on a roster that
 * is tens of documents, not thousands.
 *
 * Deliberately not `useDogs()` filtered client-side: that one subscribes to the whole `dogs`
 * collection for Discovery, and a shelter dashboard should read its own rows.
 */
export type ShelterDogsResult =
  | { state: "loading" }
  | { state: "ready"; dogs: Dog[] }
  | { state: "error"; code: string | undefined };

type Snapshot = { key: string; result: ShelterDogsResult };

export function useShelterDogs(shelterId: string | null): {
  result: ShelterDogsResult;
  retry: () => void;
} {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Same retry shape as useShelterApplications: onSnapshot doesn't reconnect after a terminal
  // error, so resubscribing from scratch is the retry.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const key = `${shelterId ?? ""}#${attempt}`;

  useEffect(() => {
    if (!shelterId) return;
    return onSnapshot(
      query(collection(firestore, "dogs"), where("shelter_id", "==", shelterId)),
      (snap) => {
        const dogs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Dog, "id">) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSnapshot({ key, result: { state: "ready", dogs } });
      },
      (err: FirestoreError) => setSnapshot({ key, result: { state: "error", code: err.code } }),
    );
  }, [shelterId, key]);

  if (!shelterId) return { result: { state: "ready", dogs: [] }, retry };
  if (snapshot?.key !== key) return { result: { state: "loading" }, retry };
  return { result: snapshot.result, retry };
}
