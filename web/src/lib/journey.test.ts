import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareLogEntry, Foster } from "../types";
import type { RichDog } from "./dog";

/**
 * PH-36: a second foster starts with a clean journal.
 *
 * `firebase/firestore` is faked with an in-memory store of documents keyed by path, enough for
 * `addDoc`, `getDocs` and `writeBatch().update()`; the guest half runs the real `localMode` code
 * over a `localStorage` shim. As with `useFoster.test.ts`, the Firestore half is modelled, not
 * observed against a real backend.
 */

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();
let nextId = 0;
const writes: string[] = [];

vi.mock("../firebase", () => ({ firestore: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  addDoc: vi.fn(async (ref: { path: string }, data: Doc) => {
    const path = `${ref.path}/auto-${nextId++}`;
    store.set(path, { ...data });
    writes.push(`add:${path}`);
  }),
  getDocs: vi.fn(async (ref: { path: string }) => ({
    docs: [...store.entries()]
      .filter(([k]) => k.startsWith(`${ref.path}/`) && !k.slice(ref.path.length + 1).includes("/"))
      .map(([k, v]) => ({ ref: { path: k }, data: () => v })),
  })),
  writeBatch: () => {
    const ops: [string, Doc][] = [];
    return {
      update: (ref: { path: string }, data: Doc) => { ops.push([ref.path, data]); },
      commit: async () => {
        for (const [path, data] of ops) {
          store.set(path, { ...store.get(path), ...data });
          writes.push(`update:${path}`);
        }
      },
    };
  },
}));

let docId: string | null = "f1";
vi.mock("./session", () => ({ fosterDocId: () => docId }));

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v); },
  removeItem: (k: string) => { memory.delete(k); },
  clear: () => memory.clear(),
});

const { JOURNEY_FIELDS, belongsToDog, hasJourney, journeyReset, leaveJourney, movesOffDog } = await import("./journey");
const { appendLocalCareLog, clearGuestData, readLocalCareLog, readLocalJourneys } = await import("./localMode");
const { buildAdoptionProfile } = await import("./adoption");
const { DEFAULT_PREP_CHECKLIST } = await import("../checklists");
const { normalizeDog } = await import("./dog");

const BARE: Foster = {
  id: "f1", name: "Sam", phase: "complete", intake: {}, likedDogIds: [], passedDogIds: [],
  matchedDogId: "dog-a", approvalChecklist: [], prepChecklist: [], careChecklist: [],
  pickup: null, readyForAdoption: false,
};

const LIVED: Foster = {
  ...BARE,
  journal: [{ id: "j1", kind: "note", text: "Loves the beach", dayInFoster: 3, createdAt: "Day 3" }] as unknown as Foster["journal"],
  adoptionNote: "Dog A is the best boy.",
  pickup: { date: "2026-09-01", time: "10:00", location: "Mission" },
  prepChecklist: DEFAULT_PREP_CHECKLIST.map((i) => ({ ...i, done: true })),
  readyForAdoption: true,
};

const entry = (dogId?: string): Doc => ({
  type: "weigh_in", note: "", value: "24 lbs", photo_url: "", created_at: null, ...(dogId ? { dogId } : {}),
});

beforeEach(() => {
  store.clear();
  memory.clear();
  writes.length = 0;
  nextId = 0;
  docId = "f1";
});

describe("leaveJourney files the journey under its dog (PH-36)", () => {
  it("archives every journey field, stamps only untagged entries, and returns the reset", async () => {
    store.set("fosters/f1/careLog/e1", entry());
    store.set("fosters/f1/careLog/e2", entry("dog-older"));

    const reset = await leaveJourney(LIVED);

    const archive = store.get("fosters/f1/journeys/auto-0")!;
    expect(archive.dogId).toBe("dog-a");
    expect(archive.adoptionNote).toBe("Dog A is the best boy.");
    expect(archive.pickup).toEqual(LIVED.pickup);
    expect(archive.journal).toEqual(LIVED.journal);
    expect(archive.archivedAt).toBe("SERVER_TIMESTAMP");
    // A field the foster never wrote is left out -- Firestore rejects `undefined`.
    expect("careSchedule" in archive).toBe(false);

    expect(store.get("fosters/f1/careLog/e1")!.dogId).toBe("dog-a");
    expect(store.get("fosters/f1/careLog/e2")!.dogId).toBe("dog-older");
    expect(writes).not.toContain("update:fosters/f1/careLog/e2");

    expect(reset).toEqual(journeyReset());
    expect(Object.keys(reset).sort()).toEqual([...JOURNEY_FIELDS].sort());
    expect(reset.journal).toEqual([]);
    expect(reset.pickup).toBeNull();
    // Named with no value: patchFoster removes these rather than writing them blank.
    expect("adoptionNote" in reset && reset.adoptionNote === undefined).toBe(true);
  });

  it("writes nothing for a foster with no matched dog", async () => {
    expect(await leaveJourney({ ...LIVED, matchedDogId: null })).toEqual({});
    expect(await leaveJourney(null)).toEqual({});
    expect(writes).toEqual([]);
  });

  it("writes nothing for a matched foster who recorded nothing", async () => {
    expect(hasJourney(BARE)).toBe(false);
    expect(await leaveJourney(BARE)).toEqual({});
    expect(writes).toEqual([]);
  });

  it("still files the agent's care-log entries when the document itself is empty", async () => {
    store.set("fosters/f1/careLog/e1", entry());
    expect(await leaveJourney(BARE)).toEqual({});
    expect(store.get("fosters/f1/careLog/e1")!.dogId).toBe("dog-a");
    expect(writes.some((w) => w.startsWith("add:"))).toBe(false);
  });

  it("re-applying to the same dog doesn't leave it", () => {
    expect(movesOffDog(LIVED, "dog-a")).toBe(false);
    expect(movesOffDog(LIVED, "dog-b")).toBe(true);
    expect(movesOffDog(LIVED, null)).toBe(true);
    expect(movesOffDog(BARE && { ...BARE, matchedDogId: null }, "dog-b")).toBe(false);
  });

  it("does the same for a guest, in localStorage, and clearGuestData takes the archive too", async () => {
    docId = null;
    appendLocalCareLog({ type: "note", note: "first", value: "", photo_url: "" });
    appendLocalCareLog({ type: "note", note: "older", value: "", photo_url: "", dogId: "dog-older" });

    expect(await leaveJourney(LIVED)).toEqual(journeyReset());
    expect(readLocalJourneys()).toHaveLength(1);
    expect(readLocalJourneys()[0].dogId).toBe("dog-a");
    expect(readLocalCareLog().map((e) => e.dogId)).toEqual(["dog-a", "dog-older"]);
    expect(writes).toEqual([]);

    clearGuestData();
    expect(readLocalJourneys()).toEqual([]);
  });
});

describe("a record about one dog never reaches another's page (PH-36)", () => {
  it("reads untagged entries as current and another dog's as not", () => {
    expect(belongsToDog({}, "dog-b")).toBe(true);
    expect(belongsToDog({ dogId: "dog-b" }, "dog-b")).toBe(true);
    expect(belongsToDog({ dogId: "dog-a" }, "dog-b")).toBe(false);
  });

  it("buildAdoptionProfile fed dog A's tagged entries for dog B prints none of them", () => {
    const dogB: RichDog = normalizeDog({
      id: "dog-b", name: "Bea", breed: "Mix", age_years: 2, status: "foster", notes: "",
      good_with_kids: null, good_with_dogs: null, shelter_id: "sfspca-mission",
    });
    const entries: CareLogEntry[] = [
      { id: "a1", type: "weigh_in", note: "", value: "11 lbs", photo_url: "", created_at: { seconds: 1, nanoseconds: 0 }, dogId: "dog-a" },
      { id: "a2", type: "vet_visit", note: "Dog A's vaccines", value: "", photo_url: "", created_at: { seconds: 2, nanoseconds: 0 }, dogId: "dog-a" },
    ];
    const page = JSON.stringify(buildAdoptionProfile(dogB, { ...BARE, matchedDogId: "dog-b" }, entries));
    expect(page).not.toContain("11 lbs");
    expect(page).not.toContain("Dog A's vaccines");
  });
});

/**
 * The four places `matchedDogId` moves off a dog. There's no DOM in this test setup (the render
 * tests use `renderToStaticMarkup`, which can't click), so this reads the source: every
 * `patchFoster` that writes `matchedDogId` must sit in a function that called `leaveJourney`.
 * It's a guard against a fifth site being added without it, not a behavioural test.
 */
describe("every site that moves matchedDogId files the journey first (PH-36)", () => {
  const root = join(__dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk(root);

  const sites = files.flatMap((f) => {
    const src = readFileSync(f, "utf8");
    return [...src.matchAll(/patchFoster\(\{(?:(?!\}\))[\s\S])*?\bmatchedDogId:/g)].map((m) => ({ f, src, at: m.index! }));
  });

  it("finds the four known sites", () => {
    expect(sites.map((s) => s.f.replace(/\\/g, "/").split("/src/")[1]).sort()).toEqual([
      "phases/discovery/DogDetailView.tsx",
      "phases/discovery/SavedView.tsx",
      "phases/discovery/SavedView.tsx",
      "phases/hub/HubView.tsx",
    ]);
  });

  for (const [n, s] of sites.entries()) {
    it(`site ${n + 1} calls leaveJourney and spreads its reset into the same write`, () => {
      // The enclosing function: back to the nearest `async` arrow or function keyword.
      const before = s.src.slice(0, s.at);
      const start = Math.max(before.lastIndexOf("async () =>"), before.lastIndexOf("async function"));
      const body = s.src.slice(start, s.at + 200);
      expect(body).toContain("leaveJourney(foster)");
      expect(s.src.slice(s.at, s.at + 40)).toMatch(/patchFoster\(\{\s*\.\.\.(reset|leave)/);
    });
  }
});
