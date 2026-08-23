import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
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

export async function patchFoster(patch: Record<string, unknown>): Promise<void> {
  const id = fosterDocId();
  if (!id) { writeLocalFoster(patch); return; }
  await setDoc(doc(firestore, "fosters", id), patch, { merge: true });
}
