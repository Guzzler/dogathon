import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FosterIntake } from "../types";

/**
 * PH-25: what omitting a key means at the write layer.
 *
 * PH-24 made `OnboardingView.finish()` omit a preference nobody supplied. Whether that omission
 * is *honest* is decided one layer down, by the write, and Pawthway has two of them behind one
 * function: Firestore for a signed-in foster, `localStorage` for a guest. Under
 * `setDoc(..., { merge: true })` a nested map merges key by key, so an omitted `pref_size` means
 * "keep the old one" — a stale answer reprinted as a current one on the Hub's "What you're
 * looking for" card and ranked on by `scoreDog()`. Under a shallow spread it means "gone".
 *
 * So the thing under test is not a call shape, it is an outcome, and it has to be the *same*
 * outcome from the *same* retake on both layers. Hence:
 *
 *  - `firebase/firestore` is faked with a store that models the two `SetOptions` faithfully —
 *    `{ merge: true }` deep-merges plain maps, `mergeFields` replaces each listed top-level key.
 *  - `mergesNestedMaps` below is the model of the *old* behaviour, asserted directly in the
 *    first test. Without it a green suite would prove only that the model and the code agree,
 *    not that the model can see the defect at all.
 *
 * What that buys and what it does not: these semantics are modelled from Firestore's documented
 * behaviour, not observed against a real backend — there is no emulator here. The guest half is
 * the real `localMode` code over a `localStorage` shim, so that half is observed.
 */

type Doc = Record<string, unknown>;

const isMap = (v: unknown): v is Doc =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `{ merge: true }` — the old behaviour, kept so a test can assert it was the defect. */
function mergesNestedMaps(stored: Doc, data: Doc): Doc {
  const out: Doc = { ...stored };
  for (const [k, v] of Object.entries(data)) {
    const before = stored[k];
    out[k] = isMap(v) && isMap(before) ? mergesNestedMaps(before, v) : v;
  }
  return out;
}

/** `mergeFields` — each listed key is written whole, anything unlisted is untouched. */
function replacesListedFields(stored: Doc, data: Doc, fields: string[]): Doc {
  const out: Doc = { ...stored };
  for (const f of fields) out[f] = data[f];
  return out;
}

const store = new Map<string, Doc>();

class FakeFieldPath {
  // A plain field rather than a parameter property: `erasableSyntaxOnly` is on.
  segment: string;
  constructor(segment: string) { this.segment = segment; }
}

vi.mock("../firebase", () => ({ firestore: {} }));

vi.mock("firebase/firestore", () => ({
  FieldPath: FakeFieldPath,
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(async (
    ref: { path: string },
    data: Doc,
    options?: { merge?: boolean; mergeFields?: FakeFieldPath[] },
  ) => {
    const stored = store.get(ref.path) ?? {};
    if (options?.mergeFields) {
      const fields = options.mergeFields.map((f) => {
        // A bare string here would be parsed as a dotted path, which is why patchFoster
        // wraps every key. Fail loudly rather than silently testing the wrong thing.
        if (!(f instanceof FakeFieldPath)) throw new Error("mergeFields needs a FieldPath");
        return f.segment;
      });
      store.set(ref.path, replacesListedFields(stored, data, fields));
    } else if (options?.merge) {
      store.set(ref.path, mergesNestedMaps(stored, data));
    } else {
      store.set(ref.path, { ...data });
    }
  }),
}));

// session.ts reads localStorage at module scope-adjacent call sites; the shim below covers the
// guest path, but the uid is what selects a layer, so it is a plain mutable here.
let docId: string | null = "foster-1";
vi.mock("../lib/session", () => ({
  fosterDocId: () => docId,
  getSession: () => ({ kind: docId ? "user" : "guest" }),
  subscribeSession: () => () => {},
}));

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v); },
  removeItem: (k: string) => { memory.delete(k); },
  clear: () => memory.clear(),
});

const { patchFoster } = await import("./useFoster");
const { readLocalFoster } = await import("../lib/localMode");

/* ---------- the fixture: one foster, two passes through the questionnaire ---------- */

/** First pass: both sliders moved, so both preferences are genuinely supplied. */
const FIRST_PASS: FosterIntake = {
  living_arrangement: "Apartment",
  experience_level: "First-time foster",
  size_preference: "Large",
  pref_size: 88,
  energy_preference: "High",
  pref_energy: 3,
  restrictions: "No stairs",
  pref_home: "apartment",
  pref_experience: "first",
  pref_tags: ["adult"],
};

/**
 * The retake, exactly as `finish()` writes it when neither slider is touched: the four
 * slider-derived keys are absent, not blank. Whether that stays absent is the whole question.
 */
const RETAKE: FosterIntake = {
  living_arrangement: "House with yard",
  experience_level: "First-time foster",
  restrictions: "",
  pref_home: "houseYard",
  pref_experience: "first",
  pref_tags: [],
};

const SLIDER_KEYS = ["pref_size", "size_preference", "pref_energy", "energy_preference"] as const;

/** Drive the same two passes against one layer and hand back what it stored. */
async function retakeUnder(layer: "firestore" | "guest") {
  store.clear();
  memory.clear();
  docId = layer === "firestore" ? "foster-1" : null;

  await patchFoster({ intake: FIRST_PASS, phase: "discovery" });
  await patchFoster({ intake: RETAKE, phase: "discovery" });

  return layer === "firestore"
    ? (store.get("fosters/foster-1") ?? {})
    : (readLocalFoster() as unknown as Doc);
}

const LAYERS = ["firestore", "guest"] as const;

beforeEach(() => {
  store.clear();
  memory.clear();
  docId = "foster-1";
});

describe("what omitting a key means at the write layer", () => {
  it("is 'keep the old answer' under { merge: true } — the defect, stated as a model", () => {
    // Not a test of shipped code: it pins the behaviour patchFoster used to have, so the
    // assertions below are known to be capable of failing.
    const after = mergesNestedMaps({ intake: FIRST_PASS }, { intake: RETAKE });
    const intake = after.intake as FosterIntake;

    expect(intake.pref_size).toBe(88);
    expect(intake.size_preference).toBe("Large");
    expect(intake.living_arrangement).toBe("House with yard");
  });

  it.each(LAYERS)("drops a slider the retake never moved (%s)", async (layer) => {
    const stored = await retakeUnder(layer);
    const intake = stored.intake as FosterIntake;

    for (const key of SLIDER_KEYS) expect(intake).not.toHaveProperty(key);
  });

  it.each(LAYERS)("stores exactly what the second pass supplied, nothing more (%s)", async (layer) => {
    const stored = await retakeUnder(layer);

    expect(stored.intake).toEqual(RETAKE);
    expect(Object.keys(stored.intake as Doc).sort()).toEqual(Object.keys(RETAKE).sort());
  });

  it("answers the same on both layers, which is the acceptance bar", async () => {
    const viaFirestore = await retakeUnder("firestore");
    const viaGuest = await retakeUnder("guest");

    expect(viaGuest.intake).toEqual(viaFirestore.intake);
  });

  it.each(LAYERS)("clears every answer when 'Change answers' writes an empty map (%s)", async (layer) => {
    await retakeUnder(layer);
    docId = layer === "firestore" ? "foster-1" : null;

    await patchFoster({ intake: {}, phase: "onboarding", likedDogIds: [], matchedDogId: null });

    const stored = layer === "firestore"
      ? (store.get("fosters/foster-1") ?? {})
      : (readLocalFoster() as unknown as Doc);
    expect(stored.intake).toEqual({});
    expect(stored.phase).toBe("onboarding");
  });

  it.each(LAYERS)("removes a pre-PH-24 time_availability on the next retake, for free (%s)", async (layer) => {
    // There is no backfill for documents written before PH-24. A true replacement is the
    // backfill: the first retake after this ships takes the derived claim with it.
    store.clear();
    memory.clear();
    docId = layer === "firestore" ? "foster-1" : null;

    await patchFoster({ intake: { ...FIRST_PASS, time_availability: "Evenings and weekends" } });
    await patchFoster({ intake: RETAKE });

    const stored = layer === "firestore"
      ? (store.get("fosters/foster-1") ?? {})
      : (readLocalFoster() as unknown as Doc);
    expect(stored.intake).not.toHaveProperty("time_availability");
  });

  it("leaves keys the patch never mentions alone", async () => {
    // mergeFields replaces what it lists and only what it lists — a swipe must not wipe intake.
    await patchFoster({ intake: FIRST_PASS, phase: "discovery", matchedDogId: "d1" });
    await patchFoster({ likedDogIds: ["d2"] });

    const stored = store.get("fosters/foster-1")!;
    expect(stored.intake).toEqual(FIRST_PASS);
    expect(stored.phase).toBe("discovery");
    expect(stored.matchedDogId).toBe("d1");
    expect(stored.likedDogIds).toEqual(["d2"]);
  });

  it("replaces a whole map written whole, so pickup: null still clears it", async () => {
    await patchFoster({ pickup: { date: "2026-10-01", time: "10:00", location: "Mission" } });
    await patchFoster({ pickup: null });

    expect(store.get("fosters/foster-1")!.pickup).toBeNull();
  });

  it("writes nothing at all for an empty patch", async () => {
    const { setDoc } = await import("firebase/firestore");
    vi.mocked(setDoc).mockClear();

    await patchFoster({});

    expect(setDoc).not.toHaveBeenCalled();
    expect(store.has("fosters/foster-1")).toBe(false);
  });
});
