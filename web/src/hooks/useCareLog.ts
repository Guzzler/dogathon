import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase";
import { fosterDocId, subscribeSession } from "../lib/session";
import type { CareLogEntry } from "../types";
import { appendLocalCareLog, subscribeLocalCareLog } from "../lib/localMode";

/** Subcollection of the signed-in user's foster doc; localStorage for guests. */
export function useCareLog() {
  const [entries, setEntries] = useState<CareLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [docId, setDocId] = useState<string | null>(fosterDocId);

  useEffect(() => subscribeSession(() => setDocId(fosterDocId())), []);

  useEffect(() => {
    if (!docId) {
      return subscribeLocalCareLog((e) => { setEntries(e); setLoading(false); });
    }
    const q = query(collection(firestore, "fosters", docId, "careLog"), orderBy("created_at"));
    return onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CareLogEntry, "id">) })));
        setLoading(false);
      },
      // Rules deny cross-user reads, so a denied listen must still resolve loading —
      // otherwise the screen sits on a spinner with no way out.
      (err) => {
        console.error("care log snapshot failed", err);
        setEntries([]);
        setLoading(false);
      },
    );
  }, [docId]);

  return { entries, loading };
}

export async function addCareLogEntry(entry: {
  type: CareLogEntry["type"];
  note?: string;
  value?: string;
  photo_url?: string;
}): Promise<void> {
  const id = fosterDocId();
  const base = {
    type: entry.type,
    note: entry.note ?? "",
    value: entry.value ?? "",
    photo_url: entry.photo_url ?? "",
  };
  if (!id) { appendLocalCareLog(base); return; }
  await addDoc(collection(firestore, "fosters", id, "careLog"), { ...base, created_at: serverTimestamp() });
}
