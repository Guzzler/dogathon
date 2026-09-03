import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Application } from "../types";
import { fosterDocId, subscribeSession } from "../lib/session";

/**
 * The signed-in foster's own `applications/{id}` document for the dog they've applied to.
 *
 * Two equalities and no `orderBy`, so this needs **no composite index** -- don't add one to
 * `firestore.indexes.json` for it. `firestore.rules`' read rule on `applications` is
 * `fosterId == request.auth.uid || isStaff(shelterId)`, and pinning `fosterId` to the caller's
 * own uid is the shape the rules engine can prove safe for a list query.
 *
 * Returns `null` rather than an error state for every way this can come back empty -- a guest
 * or `LOCAL_MODE` foster (no uid, no collection), a record written before `applications`
 * existed, or a refused read. Every caller wants the same thing in all four cases: fall back
 * to the foster document alone. See `composeApprovalChecklist`.
 */
export function useApplication(dogId: string | null | undefined): {
  application: Application | null;
  loading: boolean;
} {
  const [uid, setUid] = useState<string | null>(fosterDocId);
  const [snapshot, setSnapshot] = useState<{ key: string; application: Application | null } | null>(null);

  useEffect(() => subscribeSession(() => setUid(fosterDocId())), []);

  const key = uid && dogId ? `${uid}#${dogId}` : null;

  useEffect(() => {
    if (!uid || !dogId) return;
    const k = `${uid}#${dogId}`;
    return onSnapshot(
      query(
        collection(firestore, "applications"),
        where("fosterId", "==", uid),
        where("dogId", "==", dogId),
      ),
      (snap) => {
        // At most one application per (foster, dog) in practice; if a duplicate ever exists,
        // the first is as good a choice as any and beats rendering nothing.
        const first = snap.docs[0];
        setSnapshot({
          key: k,
          application: first ? { id: first.id, ...(first.data() as Omit<Application, "id">) } : null,
        });
      },
      // Denied, offline, or no such collection -- all mean "fall back to the foster document".
      () => setSnapshot({ key: k, application: null }),
    );
  }, [uid, dogId]);

  // Derived rather than stored, matching useFoster/useShelterApplications: switching dogs or
  // accounts reads as loading immediately, with no extra setState inside the effect.
  if (!key) return { application: null, loading: false };
  if (snapshot?.key !== key) return { application: null, loading: true };
  return { application: snapshot.application, loading: false };
}
