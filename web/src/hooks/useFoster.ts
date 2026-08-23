import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Foster } from "../types";
import { LOCAL_MODE, subscribeLocalFoster, writeLocalFoster } from "../lib/localMode";
import { FOSTER_ID } from "../lib/fosterId";

// Re-exported so the existing `from "./useFoster"` imports keep working; the id
// itself now comes from lib/fosterId (one per browser, not one per deployment).
export { FOSTER_ID };

export function useFoster() {
  const [foster, setFoster] = useState<Foster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (LOCAL_MODE) {
      const unsub = subscribeLocalFoster((f) => { setFoster(f); setLoading(false); });
      return unsub;
    }
    const ref = doc(firestore, "fosters", FOSTER_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setFoster(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Foster, "id">) }) : null);
        setLoading(false);
      },
      // Without this, a rules rejection leaves `loading` true forever and the app
      // sits on the boot spinner with no way out. Treat it as "no record yet" so
      // the journey falls back to onboarding rather than hanging.
      (err) => {
        console.error("foster snapshot failed", err);
        setFoster(null);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { foster, loading };
}

export async function patchFoster(patch: Record<string, unknown>): Promise<void> {
  if (LOCAL_MODE) { writeLocalFoster(patch); return; }
  const ref = doc(firestore, "fosters", FOSTER_ID);
  await setDoc(ref, patch, { merge: true });
}
