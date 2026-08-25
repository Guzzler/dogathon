import {
  GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup,
  signInWithPopup, signOut, type Auth,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
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

export const AUTH_AVAILABLE = !LOCAL_MODE;
