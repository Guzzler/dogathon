import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deleteAccount()`'s correctness is almost entirely an ordering property, and ordering is
 * invisible in a diff: the agent transcript lives in a subcollection only the backend can
 * clear, `POST /reset` is authenticated with an ID token, and after `deleteUser()` there is
 * no user left to mint one from. Get the order wrong and nothing throws — a verbatim dump of
 * everything the foster typed is simply left behind, unreachable forever.
 *
 * So these tests record the order calls actually happen in, rather than asserting each one
 * happened. Everything below the module boundary is faked; there is no emulator here.
 */
const calls: string[] = [];

const currentUser = { uid: "foster-1" };
const fakeAuth: { currentUser: typeof currentUser | null } = { currentUser };

let resetChatFails = false;

vi.mock("./firebase", () => ({ firebaseApp: {}, firestore: {} }));

// LOCAL_MODE is derived from web/.env, which is gitignored — present locally, absent in CI.
// Pinning it here is what stops the same test asserting two different things in two places.
vi.mock("./lib/localMode", () => ({
  LOCAL_MODE: false,
  BLANK_FOSTER: {},
  clearGuestData: vi.fn(),
  readLocalCareLog: () => [],
  readLocalFoster: () => ({}),
}));

// session.ts reaches for localStorage, which the node test environment doesn't have.
vi.mock("./lib/session", () => ({
  clearGuest: vi.fn(),
  setSession: vi.fn(),
  wasGuest: () => false,
}));

vi.mock("./api", () => ({
  resetChat: vi.fn(async () => {
    calls.push("resetChat");
    if (resetChatFails) throw new Error("503");
    return { ok: true };
  }),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  getAuth: () => fakeAuth,
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  deleteUser: vi.fn(async () => { calls.push("deleteUser"); }),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  deleteDoc: vi.fn(async (ref: { path: string }) => { calls.push(`delete:${ref.path}`); }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  getDoc: vi.fn(),
  getDocs: vi.fn(async (ref: { path: string }) => {
    calls.push(`read:${ref.path}`);
    return { docs: [{ id: "e1", ref: { path: `${ref.path}/e1` }, data: () => ({}) }] };
  }),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
}));

const { AccountDeletionError, deleteAccount } = await import("./auth");
const { deleteUser } = await import("firebase/auth");

describe("deleteAccount", () => {
  beforeEach(() => {
    calls.length = 0;
    resetChatFails = false;
    fakeAuth.currentUser = currentUser;
    vi.mocked(deleteUser).mockClear();
  });

  it("clears the agent transcript before the Auth user, while a token can still be minted", async () => {
    await deleteAccount();

    expect(calls.indexOf("resetChat")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("resetChat")).toBeLessThan(calls.indexOf("deleteUser"));
  });

  it("clears it before the careLog too, since the delete loop can outlive a fresh token", async () => {
    await deleteAccount();

    expect(calls.indexOf("resetChat"))
      .toBeLessThan(calls.indexOf("read:fosters/foster-1/careLog"));
  });

  it("deletes nothing at all when the transcript can't be cleared", async () => {
    resetChatFails = true;

    await expect(deleteAccount()).rejects.toThrow(AccountDeletionError);
    expect(calls).toEqual(["resetChat"]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("says what survived, rather than failing silently or with a code", async () => {
    resetChatFails = true;

    await expect(deleteAccount()).rejects.toThrow(/conversations with the assistant/);
    await expect(deleteAccount()).rejects.toThrow(/nothing was deleted/);
  });

  it("still refuses when nobody is signed in", async () => {
    fakeAuth.currentUser = null;

    await expect(deleteAccount()).rejects.toThrow("Not signed in.");
    expect(calls).toEqual([]);
  });
});
