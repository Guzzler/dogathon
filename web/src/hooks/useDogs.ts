import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Dog } from "../types";

export function useDogs() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, "dogs"), (snap) => {
      setDogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dog, "id">) })));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { dogs, loading };
}
