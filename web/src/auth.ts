import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut,
  type Auth,
} from "firebase/auth";
import { firebaseApp } from "./firebase";
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

export const AUTH_AVAILABLE = !LOCAL_MODE;
