import {
  GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup,
  signInWithPopup, signOut, type Auth,
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc,
  updateDoc, where,
} from "firebase/firestore";
import { firebaseApp, firestore } from "./firebase";
// api.ts imports `auth` back out of this module, so these two form a cycle. It's safe
// because neither side reads the other at module-evaluation time — `authHeader()` reads
// `auth` when a request is made, and `resetChat` is called from inside deleteAccount().
import { resetChat } from "./api";
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
 * A deletion failure whose message is already written for a foster to read, so the sheet can
 * render it directly. Same idea as `ChatError` in api.ts, and the reason the sheet doesn't
 * just print every caught error: a dismissed re-auth popup surfaces as
 * `auth/popup-closed-by-user`, which is not copy anyone should see.
 */
export class AccountDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

/**
 * What a deleted foster's name becomes on the applications a shelter can still see. Written
 * into `fosterName`, which is denormalised onto the application precisely so a shelter can
 * read it without a lookup — which is also why deleting the account has to reach it.
 */
const REDACTED_FOSTER_NAME = "(deleted account)";

/**
 * Permanently deletes the signed-in foster's data and their Auth account. Firestore rules
 * only let the owner delete their own `fosters/{uid}` doc and `careLog` subcollection, so
 * this is mostly a plain client-side delete rather than a backend endpoint. Google-auth users
 * can have a stale session (`auth/requires-recent-login`) — re-prompt once, then retry.
 *
 * The one part the client can't reach is `fosters/{uid}/agentSession/current`: deleting a
 * document does not delete its subcollections, and that one is `allow write: if false`, so
 * only the Admin SDK can clear it. `POST /reset` is that path, and it goes first — see below.
 */
export async function deleteAccount(): Promise<void> {
  if (!auth?.currentUser) throw new Error("Not signed in.");
  const uid = auth.currentUser.uid;

  // Before anything else, because /reset is authenticated with an ID token and after
  // deleteUser() there is no user to mint one from — and the deleteUser retry path below
  // re-authenticates with a popup, which a token minted earlier isn't guaranteed to survive.
  //
  // What's at stake if this is skipped: agentSession/current is a verbatim `messagesJson`
  // dump of everything the foster typed (their dog's medical detail on Care Plan, pickup
  // logistics on Match), and once the uid stops existing nothing can ever read it back —
  // the read rule is request.auth.uid == uid. It would be a permanent orphan holding a
  // deleted person's words.
  //
  // Skipped when there's no backend to ask, the same LOCAL_MODE condition the rest of the
  // app branches on. (A signed-in user implies Firebase is configured, so this is belt and
  // braces rather than a live path — but it's the app's existing answer to the question.)
  if (!LOCAL_MODE) {
    try {
      await resetChat();
    } catch {
      // Deliberately fatal, and deliberately not silent. Carrying on would delete the Auth
      // user and strand the transcript unreachable forever; swallowing it would tell someone
      // their data is gone when it isn't. Naming what failed lets them retry when the
      // backend is back, which does clear it.
      throw new AccountDeletionError(
        "Couldn't delete your saved conversations with the assistant, so nothing was deleted. " +
        "The assistant service may be starting up — try again in a few minutes.",
      );
    }
  }

  // Also before deleting the Auth user, and for the same reason as the transcript above:
  // afterwards this becomes impossible forever. The foster branch of `applications`'s update
  // rule needs `resource.data.fosterId == request.auth.uid`, and that uid never signs in
  // again — so a row that still carries the name at that point carries it permanently.
  //
  // Redact, don't delete. An application isn't the foster's private data; it's a record of a
  // relationship with two legitimate owners, and hard-deleting it makes a row vanish out from
  // under a staff member who may be mid-review. The shelter keeps the fact that an
  // application existed and was withdrawn, and loses the name — the part that belongs to the
  // person who asked to be forgotten. `fosterId` stays: it's a uid that now resolves to
  // nothing, and it's what keeps the row's own provenance legible.
  //
  // `status: "withdrawn"` is load-bearing, not a nicety. `firestore.rules` lets a foster
  // update their own application only when the *resulting* status is "withdrawn", so a
  // redaction that left the status alone would be permission-denied. It's also the honest
  // status: nobody is going to review an application from an account that no longer exists.
  try {
    const applications = await getDocs(
      query(collection(firestore, "applications"), where("fosterId", "==", uid)),
    );
    await Promise.all(applications.docs.map((application) => updateDoc(application.ref, {
      fosterName: REDACTED_FOSTER_NAME,
      status: "withdrawn",
    })));
  } catch {
    throw new AccountDeletionError(
      "Couldn't remove your name from the foster applications you've sent, so nothing was " +
      "deleted. Check your connection and try again.",
    );
  }

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
 * gave us. That line is about *export* only — what someone is entitled to a copy of and what
 * has to be destroyed on request are different questions, and `deleteAccount()` above answers
 * the second one by clearing that document through the backend.
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
