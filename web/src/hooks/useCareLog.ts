import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase";
import { FOSTER_ID } from "./useFoster";
import type { CareLogEntry } from "../types";

export function useCareLog() {
  const [entries, setEntries] = useState<CareLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(firestore, "fosters", FOSTER_ID, "careLog"), orderBy("created_at"));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CareLogEntry, "id">) })));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { entries, loading };
}

export async function addCareLogEntry(entry: {
  type: CareLogEntry["type"];
  note?: string;
  value?: string;
  photo_url?: string;
}): Promise<void> {
  await addDoc(collection(firestore, "fosters", FOSTER_ID, "careLog"), {
    type: entry.type,
    note: entry.note ?? "",
    value: entry.value ?? "",
    photo_url: entry.photo_url ?? "",
    created_at: serverTimestamp(),
  });
}
