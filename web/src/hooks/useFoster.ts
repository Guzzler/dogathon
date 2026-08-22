import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Foster } from "../types";
import { LOCAL_MODE, subscribeLocalFoster, writeLocalFoster } from "../lib/localMode";

export const FOSTER_ID = "annie";

export function useFoster() {
  const [foster, setFoster] = useState<Foster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (LOCAL_MODE) {
      const unsub = subscribeLocalFoster((f) => { setFoster(f); setLoading(false); });
      return unsub;
    }
    const ref = doc(firestore, "fosters", FOSTER_ID);
    const unsub = onSnapshot(ref, (snap) => {
      setFoster(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Foster, "id">) }) : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { foster, loading };
}

export async function patchFoster(patch: Record<string, unknown>): Promise<void> {
  if (LOCAL_MODE) { writeLocalFoster(patch); return; }
  const ref = doc(firestore, "fosters", FOSTER_ID);
  await setDoc(ref, patch, { merge: true });
}
