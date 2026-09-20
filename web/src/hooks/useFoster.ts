import { useEffect, useState } from "react";
import { FieldPath, doc, onSnapshot, setDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Foster } from "../types";
import { subscribeLocalFoster, writeLocalFoster } from "../lib/localMode";
import { fosterDocId, getSession, subscribeSession } from "../lib/session";

/** What we last loaded, and for whom — so switching users can't show stale data. */
type Snapshot = { for: string | null; foster: Foster | null };

/**
 * Each signed-in user owns `fosters/{uid}`. Guests — and anyone running without Firebase
 * config — keep the same journey in localStorage instead, so a fresh clone still works.
 */
export function useFoster() {
  const [sessionKind, setSessionKind] = useState(() => getSession().kind);
  const [docId, setDocId] = useState<string | null>(fosterDocId);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => subscribeSession((s) => { setDocId(fosterDocId()); setSessionKind(s.kind); }), []);

  useEffect(() => {
    // Signed out belongs to nobody: don't load the guest journey behind the sign-in screen,
    // or the chrome (tab bar, badges) renders as if someone were partway through it.
    if (sessionKind === "loading" || sessionKind === "signedOut") return;

    if (!docId) {
      return subscribeLocalFoster((foster) => setSnapshot({ for: null, foster }));
    }

    return onSnapshot(
      doc(firestore, "fosters", docId),
      (snap) => setSnapshot({
        for: docId,
        foster: snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Foster, "id">) } : null,
      }),
      // Rules deny cross-user reads; a shared adoption link hits this. Degrade, don't crash.
      () => setSnapshot({ for: docId, foster: null }),
    );
  }, [docId, sessionKind]);

  if (sessionKind === "signedOut") return { foster: null, loading: false };

  // Derived rather than stored, so a user switch reads as loading without an extra setState.
  const loading = sessionKind === "loading" || snapshot?.for !== docId;

  return { foster: loading ? null : snapshot!.foster, loading };
}

/**
 * Write these keys onto the foster document: **every key in `patch` is replaced whole**, and
 * keys absent from `patch` are left alone.
 *
 * That is `mergeFields`, not `{ merge: true }`, and the difference is the whole point (PH-25).
 * `{ merge: true }` merges a *nested map* key by key, so a `{ intake }` that deliberately
 * leaves out `pref_size` keeps whichever `pref_size` was already stored. A questionnaire that
 * carefully declines to record an answer nobody gave (PH-24), over a write layer that reads
 * declining as "keep the old answer", has recorded the old answer as a new one — which is the
 * claim PH-24 removed, arriving one layer down.
 *
 * `writeLocalFoster()` is a shallow spread and has always replaced the whole key, so the guest
 * path was already right and only Firestore disagreed. Both layers now answer the same, which
 * matters because guest is a supported path and not a fallback.
 *
 * A `FieldPath` per key rather than a bare string, because `mergeFields` parses a string as a
 * dotted path — `new FieldPath(k)` is one segment whatever `k` contains.
 */
export async function patchFoster(patch: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(patch);
  // Nothing to say. Checked before either branch so both layers agree on the empty patch too,
  // and because `mergeFields: []` would be a round trip that touches nothing.
  if (!keys.length) return;
  const id = fosterDocId();
  if (!id) { writeLocalFoster(patch); return; }
  await setDoc(doc(firestore, "fosters", id), patch, {
    mergeFields: keys.map((k) => new FieldPath(k)),
  });
}
