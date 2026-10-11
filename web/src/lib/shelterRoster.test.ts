import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RS-22: acknowledging a returned dog closes its foster's application in the same write. Faked
 * below the module boundary, as `auth.test.ts` is -- there is no emulator here, so this asserts
 * which writes are made and whether they share a batch.
 */
const writes = vi.hoisted(() => ({ single: [] as unknown[], batched: [] as unknown[], commits: 0 }));

vi.mock("../firebase", () => ({ firebaseApp: {}, firestore: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: () => "TS",
  updateDoc: vi.fn(async (ref: { path: string }, data: unknown) => { writes.single.push({ path: ref.path, data }); }),
  writeBatch: () => ({
    update: (ref: { path: string }, data: unknown) => writes.batched.push({ path: ref.path, data }),
    commit: async () => { writes.commits += 1; },
  }),
}));

const { applyRosterAction } = await import("./shelterRoster");

beforeEach(() => {
  writes.single = [];
  writes.batched = [];
  writes.commits = 0;
});

describe("applyRosterAction (RS-22)", () => {
  it("lists a returned dog and completes its holder's application in one batch", async () => {
    await applyRosterAction("d1", "list", { id: "a1" });
    expect(writes.commits).toBe(1);
    expect(writes.single).toEqual([]);
    expect(writes.batched).toEqual([
      { path: "dogs/d1", data: { status: "available", updatedAt: "TS" } },
      { path: "applications/a1", data: { status: "completed", completedAt: "TS", updatedAt: "TS" } },
    ]);
  });

  it("does the same for Mark adopted", async () => {
    await applyRosterAction("d1", "adopted", { id: "a1" });
    expect(writes.batched[0]).toEqual({ path: "dogs/d1", data: { status: "adopted", updatedAt: "TS" } });
    expect(writes.batched[1]).toMatchObject({ path: "applications/a1", data: { status: "completed" } });
  });

  it("writes the dog alone with no holder, or for an action that doesn't end a foster", async () => {
    await applyRosterAction("d1", "list");
    await applyRosterAction("d2", "retire", { id: "a1" });
    expect(writes.commits).toBe(0);
    expect(writes.single).toEqual([
      { path: "dogs/d1", data: { status: "available", updatedAt: "TS" } },
      { path: "dogs/d2", data: { status: "retired", updatedAt: "TS" } },
    ]);
  });
});
