import {
  GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup,
  signInWithPopup, signOut, type Auth,
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from "firebase/firestore";
import { firebaseApp, firestore } from "./firebase";
import { BLANK_FOSTER, clearGuestData, readLocalCareLog, readLocalFoster, LOCAL_MODE } from "./lib/localMode";
import { clearGuest, setSession, wasGuest } from "./lib/session";

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

/**
 * Starts watching auth state. Called once at boot.
 *
 * Without Firebase config there is no auth to watch, so we resolve straight to whatever the
 * guest flag says — the app still runs on a fresh clone, it just can't offer Google sign-in.
 */
export function startAuth(): void {
  if (!auth) {
    setSession(wasGuest() ? { kind: "guest" } : { kind: "signedOut" });
    return;
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      setSession({
        kind: "user",
        uid: user.uid,
        name: user.displayName ?? user.email ?? "Foster",
        email: user.email,
        photoURL: user.photoURL,
      });
    } else {
      setSession(wasGuest() ? { kind: "guest" } : { kind: "signedOut" });
    }
  });
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error("Firebase isn't configured — add web/.env to enable sign-in.");
  // Read before clearGuest() below removes the flag this depends on.
  const hadGuestData = wasGuest();
  // Signing in supersedes any guest choice, so the guest doc doesn't shadow the real one.
  clearGuest();
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  if (hadGuestData) await migrateGuestData(cred.user.uid);
}

/**
 * A guest's journey lives entirely in localStorage (`web/src/lib/localMode.ts`) — there's no
 * Firebase Auth user to `linkWithCredential` onto, anonymous or otherwise. So "migration" here
 * means copying that local state into the new `fosters/{uid}` doc on first sign-in, once,
 * rather than linking credentials.
 *
 * Skips entirely if `fosters/{uid}` already exists — a returning user's real data always wins
 * over a stale local guest doc left on the device.
 */
async function migrateGuestData(uid: string): Promise<void> {
  const existing = await getDoc(doc(firestore, "fosters", uid));
  if (existing.exists()) return;

  const localFoster = readLocalFoster();
  if (JSON.stringify(localFoster) === JSON.stringify(BLANK_FOSTER)) return;

  const { id: _id, ...fosterData } = localFoster;
  await setDoc(doc(firestore, "fosters", uid), fosterData);

  // Sequential, not Promise.all, so serverTimestamp() ordering matches the original order.
  for (const { id: _entryId, created_at: _createdAt, ...entry } of readLocalCareLog()) {
    await addDoc(collection(firestore, "fosters", uid, "careLog"), { ...entry, created_at: serverTimestamp() });
  }

  clearGuestData();
}

export async function signOutOfPawthway(): Promise<void> {
  clearGuest();
  if (auth) await signOut(auth);
  else setSession({ kind: "signedOut" });
}

/**
 * Permanently deletes the signed-in foster's data and their Auth account. Firestore rules
 * only let the owner delete their own `fosters/{uid}` doc and `careLog` subcollection, so
 * this is a plain client-side delete rather than a backend endpoint. Google-auth users can
 * have a stale session (`auth/requires-recent-login`) — re-prompt once, then retry.
 */
export async function deleteAccount(): Promise<void> {
  if (!auth?.currentUser) throw new Error("Not signed in.");
  const uid = auth.currentUser.uid;

  const careLog = await getDocs(collection(firestore, "fosters", uid, "careLog"));
  await Promise.all(careLog.docs.map((entry) => deleteDoc(entry.ref)));
  await deleteDoc(doc(firestore, "fosters", uid));

  try {
    await deleteUser(auth.currentUser);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/requires-recent-login") throw err;
    await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
    await deleteUser(auth.currentUser);
  }

  clearGuest();
  setSession({ kind: "signedOut" });
}

/**
 * Builds a JSON export of everything a foster gave the app: their `fosters/{uid}` doc, its
 * `careLog` subcollection, and their `applications` rows (queried by `fosterId`, since
 * `applications` lives outside `fosters/{uid}` — see docs/shelter-integration.md).
 *
 * Deliberately excludes `fosters/{uid}/agentSession/current`: it's a `messagesJson` dump of
 * the agent's own reasoning, already no-client-write in firestore.rules, not data the foster
 * gave us.
 */
export async function exportAccountData(): Promise<void> {
  if (!auth?.currentUser) throw new Error("Not signed in.");
  const uid = auth.currentUser.uid;

  const fosterSnap = await getDoc(doc(firestore, "fosters", uid));
  const careLogSnap = await getDocs(collection(firestore, "fosters", uid, "careLog"));
  const applicationsSnap = await getDocs(
    query(collection(firestore, "applications"), where("fosterId", "==", uid)),
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    foster: fosterSnap.exists() ? fosterSnap.data() : null,
    careLog: careLogSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    applications: applicationsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pawthway-data-${uid}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export const AUTH_AVAILABLE = !LOCAL_MODE;
