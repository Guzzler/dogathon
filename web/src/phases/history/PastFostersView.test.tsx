import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dog, Foster } from "../../types";

/**
 * PH-37, the guest path end to end: `leaveJourney` files a journey to localStorage, and Past
 * fosters reads it back -- with no Firestore anywhere (`firestore` is `null` here, as in
 * `LOCAL_MODE`), which is the path an unguarded read would throw on.
 */

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal("window", { location: { origin: "https://pawthway.test" } });

vi.mock("../../firebase", () => ({ firebaseApp: null, firestore: null }));
vi.mock("../../hooks/useDogs", () => ({ useDogs: () => ({ dogs: DOGS, loading: false }) }));
vi.mock("../../hooks/useCareLog", async () => {
  const local = await import("../../lib/localMode");
  return { useAllCareLog: () => ({ entries: local.readLocalCareLog(), loading: false }) };
});

const { leaveJourney } = await import("../../lib/journey");
const { appendLocalCareLog, BLANK_FOSTER } = await import("../../lib/localMode");
const { PastFostersView, PastFosterDetailView } = await import("./PastFostersView");

const DOGS = [
  { id: "arlo", name: "Arlo", breed: "Mix", age_years: 3, shelter_id: "sfspca", status: "available" },
] as unknown as Dog[];

const FOSTER: Foster = {
  ...BLANK_FOSTER,
  matchedDogId: "arlo",
  phase: "care_plan",
  journal: [{ id: "n1", createdAt: "2026-09-01T10:00:00Z", dayInFoster: 2, kind: "note", text: "Slept through the night.", starred: false }],
};

const render = (path: string) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/history" element={<PastFostersView />} />
      <Route path="/history/:journeyId" element={<PastFosterDetailView />} />
    </Routes>
  </MemoryRouter>,
);

describe("Past fosters, guest path", () => {
  beforeEach(() => store.clear());

  it("says there is nothing filed yet", () => {
    expect(render("/history")).toContain("what you wrote about them is kept here");
  });

  it("lists a journey filed by leaveJourney, and its detail shows the journal and strict care log", async () => {
    appendLocalCareLog({ type: "weigh_in", note: "", value: "21", photo_url: "", dogId: "arlo" });
    appendLocalCareLog({ type: "weigh_in", note: "", value: "99", photo_url: "", dogId: "someone-else" });
    await leaveJourney(FOSTER);

    const list = render("/history");
    expect(list).toContain("Arlo");
    expect(list).toContain("1 journal entry");
    expect(list).toContain('href="/history/local-0"');
    // No application on the guest path, so no outcome line -- never inferred.
    expect(list).not.toMatch(/Fostered|withdrew|declined/);

    const detail = render("/history/local-0");
    expect(detail).toContain("Slept through the night.");
    expect(detail).toContain("Weigh-in · 21 lb");
    expect(detail).not.toContain("99 lb");
    // Nothing published on a guest path, so no take-down control.
    expect(detail).not.toContain("Take it down");
  });

  it("names no dog it cannot find", async () => {
    await leaveJourney({ ...FOSTER, matchedDogId: "vanished" });
    expect(render("/history")).toContain("This dog&#x27;s listing is no longer on file");
  });
});
