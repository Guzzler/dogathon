import demoDogs from "../../../data/dogs.json";
import type { CareLogEntry, Dog, Foster } from "../types";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_CARE_CHECKLIST, DEFAULT_PREP_CHECKLIST } from "../checklists";

/**
 * Firebase config lives in `web/.env`, which isn't committed. Without it the app would
 * throw on the first Firestore call, so it falls back to the seed roster plus a
 * localStorage-backed foster. Same UI, same shapes — just no shared backend.
 *
 * This is also the guest path: a signed-out foster keeps their journey here rather than in
 * Firestore, so the whole product works before anyone creates an account.
 */
export const LOCAL_MODE = !import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const LOCAL_DOGS = demoDogs as Dog[];

const KEY = "pawthway.localFoster.v1";

export const BLANK_FOSTER: Foster = {
  id: "guest",
  name: "",
  phase: "onboarding",
  intake: {},
  likedDogIds: [],
  passedDogIds: [],
  matchedDogId: null,
  approvalChecklist: DEFAULT_APPROVAL_CHECKLIST,
  prepChecklist: DEFAULT_PREP_CHECKLIST,
  careChecklist: DEFAULT_CARE_CHECKLIST,
  pickup: null,
  readyForAdoption: false,
};

const listeners = new Set<(f: Foster) => void>();

export function readLocalFoster(): Foster {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...BLANK_FOSTER, ...JSON.parse(raw) };
  } catch { /* ignore corrupt state */ }
  return BLANK_FOSTER;
}

export function writeLocalFoster(patch: Record<string, unknown>) {
  const next = { ...readLocalFoster(), ...patch } as Foster;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach(fn => fn(next));
}

export function subscribeLocalFoster(fn: (f: Foster) => void) {
  listeners.add(fn);
  fn(readLocalFoster());
  return () => { listeners.delete(fn); };
}

export function resetLocalFoster() {
  localStorage.removeItem(KEY);
  listeners.forEach(fn => fn(BLANK_FOSTER));
}

/**
 * Wipe everything this device's guest has done.
 *
 * A browser can't tell two people apart, so on a shared or demo machine the next guest
 * inherits the previous one's journey. This is the one-tap way to hand it over clean.
 */
export function clearGuestData() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LOG_KEY);
  listeners.forEach(fn => fn(BLANK_FOSTER));
  logListeners.forEach(fn => fn([]));
}

/* ---------- care log (local mode) ---------- */
const LOG_KEY = "pawthway.localCareLog.v1";
const logListeners = new Set<(e: CareLogEntry[]) => void>();

export function readLocalCareLog(): CareLogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
}

export function appendLocalCareLog(entry: Omit<CareLogEntry, "id" | "created_at">) {
  const next = [...readLocalCareLog(), {
    ...entry,
    id: `local-${Date.now()}`,
    created_at: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
  }];
  localStorage.setItem(LOG_KEY, JSON.stringify(next));
  logListeners.forEach(fn => fn(next));
}

export function subscribeLocalCareLog(fn: (e: CareLogEntry[]) => void) {
  logListeners.add(fn);
  fn(readLocalCareLog());
  return () => { logListeners.delete(fn); };
}
