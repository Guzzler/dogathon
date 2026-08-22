import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Dog } from "../types";
import { LOCAL_DOGS, LOCAL_MODE } from "../lib/localMode";

export function useDogs() {
  const [dogs, setDogs] = useState<Dog[]>(LOCAL_MODE ? LOCAL_DOGS : []);
  const [loading, setLoading] = useState(!LOCAL_MODE);

  useEffect(() => {
    if (LOCAL_MODE) return;
    const unsub = onSnapshot(collection(firestore, "dogs"), (snap) => {
      setDogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dog, "id">) })));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { dogs, loading };
}
