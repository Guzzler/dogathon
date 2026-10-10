import { useEffect, useState } from "react";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where,
  type Timestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";
import { LOCAL_MODE } from "./localMode";
import type { PublishedPart } from "./adoption";

/**
 * PH-32. What a foster has published about the dog they fostered, at `adoptionProfiles/{dogId}`:
 * the one place a stranger opening the shared link may read. Written only by an explicit
 * **Publish** -- never synced on every change -- because a journal is written for oneself, and
 * nothing in it should become public because it was typed.
 *
 * `firestore.rules` admits the write only for the foster whose application on this dog carries
 * the shelter's `pickupConfirmedAt`: a stamp only staff can set, unlike `matchedDogId`, which a
 * foster writes about themselves.
 */
export interface PublishedProfile extends Partial<PublishedPart> {
  fosterId: string;
  applicationId: string;
  dogId: string;
  publishedAt: Timestamp | null;
}

export async function publishAdoptionProfile(
  dogId: string,
  fosterId: string,
  applicationId: string,
  part: PublishedPart,
): Promise<void> {
  if (LOCAL_MODE) return;
  await setDoc(doc(firestore, "adoptionProfiles", dogId), {
    ...part,
    fosterId,
    applicationId,
    dogId,
    publishedAt: serverTimestamp(),
  });
}

/**
 * Takes down this foster's page for a dog, if they have one. Found by the owner's own `list`
 * query rather than a `get`: the rules hide a page whose authorizing application was withdrawn,
 * which is exactly the moment the withdraw path calls this. Deleting only what the query found
 * also means a missing page, or another foster's page on the same dog, is never attempted.
 * Two equalities and no `orderBy`, so no composite index.
 */
export async function unpublishAdoptionProfile(dogId: string, fosterId: string): Promise<void> {
  if (LOCAL_MODE) return;
  const snap = await getDocs(query(
    collection(firestore, "adoptionProfiles"),
    where("fosterId", "==", fosterId),
    where("dogId", "==", dogId),
  ));
  await Promise.all(snap.docs.map((page) => deleteDoc(page.ref)));
}

/** Every page this foster has published -- for account export and deletion. */
export async function publishedByFoster(fosterId: string) {
  const snap = await getDocs(
    query(collection(firestore, "adoptionProfiles"), where("fosterId", "==", fosterId)),
  );
  return snap.docs;
}

/**
 * The published page for a dog, live, as a reader sees it -- the sender included. `null` for
 * nothing published, for `LOCAL_MODE`, and for a refused or failed read. Refused is a real state:
 * the rules hide a page once the shelter takes back the confirmation that authorized it. Every
 * caller wants the shelter-only page in all of them, so the error callback degrades rather than
 * throws, as `useFoster`'s does.
 */
export function usePublishedProfile(dogId: string | null | undefined): {
  published: PublishedProfile | null;
  loading: boolean;
} {
  const [snapshot, setSnapshot] = useState<{ key: string; published: PublishedProfile | null } | null>(null);

  useEffect(() => {
    if (LOCAL_MODE || !dogId) return;
    return onSnapshot(
      doc(firestore, "adoptionProfiles", dogId),
      (snap) => setSnapshot({
        key: dogId,
        published: snap.exists() ? (snap.data({ serverTimestamps: "estimate" }) as PublishedProfile) : null,
      }),
      () => setSnapshot({ key: dogId, published: null }),
    );
  }, [dogId]);

  if (LOCAL_MODE || !dogId) return { published: null, loading: false };
  if (snapshot?.key !== dogId) return { published: null, loading: true };
  return { published: snapshot.published, loading: false };
}

/** "9 Oct 2026" -- or null while the server timestamp hasn't come back. */
export function publishedDate(p: Pick<PublishedProfile, "publishedAt"> | null): string | null {
  const at = p?.publishedAt;
  if (!at || typeof at.toDate !== "function") return null;
  return at.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
