import {
  GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup,
  signInWithPopup, signOut, type Auth,
} from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { firebaseApp, firestore } from "./firebase";
import { LOCAL_MODE } from "./lib/localMode";
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
  // Signing in supersedes any guest choice, so the guest doc doesn't shadow the real one.
  clearGuest();
  await signInWithPopup(auth, new GoogleAuthProvider());
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
