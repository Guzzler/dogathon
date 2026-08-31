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
const updates: { path: string; data: Record<string, unknown> }[] = [];

const currentUser = { uid: "foster-1" };
const fakeAuth: { currentUser: typeof currentUser | null } = { currentUser };

let resetChatFails = false;
let updateFails = false;

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

const fakeDoc = (path: string) => ({ id: path.split("/").pop(), ref: { path }, data: () => ({}) });

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  deleteDoc: vi.fn(async (ref: { path: string }) => { calls.push(`delete:${ref.path}`); }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  getDoc: vi.fn(),
  getDocs: vi.fn(async (ref: { path: string }) => {
    calls.push(`read:${ref.path}`);
    // Two applications, so "for each row" is actually exercised rather than assumed.
    if (ref.path === "applications") {
      return { docs: [fakeDoc("applications/a1"), fakeDoc("applications/a2")] };
    }
    return { docs: [fakeDoc(`${ref.path}/e1`)] };
  }),
  query: (ref: { path: string }) => ref,
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
    calls.push(`update:${ref.path}`);
    if (updateFails) throw new Error("permission-denied");
    updates.push({ path: ref.path, data });
  }),
  where: vi.fn(),
}));

const { AccountDeletionError, deleteAccount } = await import("./auth");
const { deleteUser } = await import("firebase/auth");

describe("deleteAccount", () => {
  beforeEach(() => {
    calls.length = 0;
    updates.length = 0;
    resetChatFails = false;
    updateFails = false;
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

  /**
   * The shelter's copy of an application survives a deletion — it's a two-owner record, and
   * a row vanishing out from under a staff member mid-review is the failure this shape
   * avoids. What must not survive is the name denormalised onto it.
   */
  describe("the applications a shelter can still see", () => {
    it("redacts the name off every one of them, not just the first", async () => {
      await deleteAccount();

      expect(updates.map((u) => u.path)).toEqual(["applications/a1", "applications/a2"]);
      for (const update of updates) expect(update.data.fosterName).toBe("(deleted account)");
    });

    it("withdraws them, which is the only reason the write passes the rules at all", async () => {
      await deleteAccount();

      // firestore.rules lets a foster update their own application only when the *resulting*
      // status is "withdrawn". Redacting without it is permission-denied, not a tidier write.
      for (const update of updates) expect(update.data.status).toBe("withdrawn");
    });

    it("leaves fosterId alone, so the row's provenance stays legible to the shelter", async () => {
      await deleteAccount();

      for (const update of updates) expect(update.data).not.toHaveProperty("fosterId");
    });

    it("redacts before the Auth user goes, since afterwards the rule can never pass", async () => {
      await deleteAccount();

      expect(calls.indexOf("update:applications/a2")).toBeLessThan(calls.indexOf("deleteUser"));
    });

    it("deletes nothing at all if the redaction fails", async () => {
      updateFails = true;

      await expect(deleteAccount()).rejects.toThrow(AccountDeletionError);
      await expect(deleteAccount()).rejects.toThrow(/nothing was deleted/);
      expect(deleteUser).not.toHaveBeenCalled();
      expect(calls.filter((c) => c.startsWith("delete:"))).toEqual([]);
    });
  });
});
