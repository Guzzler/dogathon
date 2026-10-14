import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "../firebase";
import type { Application, JourneyArchive } from "../types";
import { fosterDocId, subscribeSession } from "../lib/session";
import { readLocalJourneys } from "../lib/localMode";
import type { FiledJourney } from "../lib/history";

interface Reads {
  journeys: FiledJourney[] | null;
  applications: Application[] | null;
  published: string[] | null;
}

const EMPTY: Reads = { journeys: null, applications: null, published: null };

/**
 * Everything Past fosters (PH-37) reads: the foster's filed journeys, their own applications (for
 * how each one ended), and the dog ids they still have a page published for.
 *
 * **Every Firestore read runs only when `fosterDocId()` is non-null.** A guest -- and `LOCAL_MODE`,
 * where `firestore` is `null` -- reads `readLocalJourneys()` and nothing else: a guest never applied
 * (applying needs an account) and never published (`publishAdoptionProfile` is a no-op locally).
 *
 * The three listeners are live rather than one-off reads so that **Take it down** on the detail page
 * clears its own button. Each degrades a refused or failed read to `[]` -- the same "fall back,
 * don't throw" contract as `useApplication` and `useFoster`. The application and page queries are
 * the two the rules already admit for the owner: `fosterId == auth.uid`, one equality, no index.
 */
export function useJourneys(): {
  journeys: FiledJourney[];
  applications: Application[];
  published: string[];
  loading: boolean;
} {
  const [uid, setUid] = useState<string | null>(fosterDocId);
  const [reads, setReads] = useState<{ key: string; value: Reads }>({ key: "", value: EMPTY });

  useEffect(() => subscribeSession(() => setUid(fosterDocId())), []);

  useEffect(() => {
    if (!uid) return;
    const put = (patch: Partial<Reads>) =>
      setReads((prev) => ({ key: uid, value: { ...(prev.key === uid ? prev.value : EMPTY), ...patch } }));

    const offJourneys = onSnapshot(
      collection(firestore, "fosters", uid, "journeys"),
      (snap) => put({
        journeys: snap.docs.map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: "estimate" }) as JourneyArchive),
        })),
      }),
      () => put({ journeys: [] }),
    );
    const offApplications = onSnapshot(
      query(collection(firestore, "applications"), where("fosterId", "==", uid)),
      (snap) => put({
        applications: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Application, "id">) })),
      }),
      () => put({ applications: [] }),
    );
    const offPublished = onSnapshot(
      query(collection(firestore, "adoptionProfiles"), where("fosterId", "==", uid)),
      (snap) => put({ published: snap.docs.map((d) => d.id) }),
      () => put({ published: [] }),
    );
    return () => { offJourneys(); offApplications(); offPublished(); };
  }, [uid]);

  if (!uid) {
    // Append-only and cleared only whole, so a journey's index is a stable id for the route.
    const journeys = readLocalJourneys().map((j, n) => ({ ...j, id: `local-${n}` }));
    return { journeys, applications: [], published: [], loading: false };
  }

  const value = reads.key === uid ? reads.value : EMPTY;
  const loading = value.journeys === null || value.applications === null || value.published === null;
  return {
    journeys: value.journeys ?? [],
    applications: value.applications ?? [],
    published: value.published ?? [],
    loading,
  };
}

/** Just the count, for the Hub and Saved entry points -- 0 while loading, so nothing flickers in. */
export function usePastFosterCount(): number {
  const { journeys, loading } = useJourneys();
  return loading ? 0 : journeys.length;
}
