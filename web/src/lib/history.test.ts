import { describe, expect, it } from "vitest";
import type { Application, CareLogEntry, Dog } from "../types";
import { formatDay, journeyCareLog, outcomeLabel, pastFosters, type FiledJourney } from "./history";

const DOGS = [
  { id: "a", name: "Arlo", breed: "Mix", age_years: 3, shelter_id: "sfspca", status: "available" },
  { id: "b", name: "Bea", breed: "Terrier", age_years: 2, shelter_id: "sfspca", status: "available" },
] as unknown as Dog[];

const journey = (id: string, dogId: string, at: string, extra: Partial<FiledJourney> = {}): FiledJourney => ({
  id, dogId, archivedAt: at,
  pickup: null, prepChecklist: [], careChecklist: [], approvalChecklist: [], readyForAdoption: false,
  ...extra,
});

const ts = (ms: number) => ({ toMillis: () => ms });
const app = (dogId: string, status: Application["status"], extra: Partial<Application> = {}): Application => ({
  id: `${dogId}-${status}`, fosterId: "u", fosterName: "", dogId, shelterId: "sfspca",
  status, checklist: [], pickup: null, createdAt: ts(1), ...extra,
});

describe("pastFosters", () => {
  it("is one card per journey, newest filed first, even for the same dog twice", () => {
    const cards = pastFosters(
      [journey("j1", "a", "2026-01-01T00:00:00Z"), journey("j2", "a", "2026-06-01T00:00:00Z")],
      DOGS, [], [],
    );
    expect(cards.map((c) => c.journey.id)).toEqual(["j2", "j1"]);
    expect(cards.every((c) => c.dog?.name === "Arlo")).toBe(true);
  });

  it("never guesses a name for a dog whose document is gone", () => {
    const [card] = pastFosters([journey("j1", "gone", "2026-01-01")], DOGS, [], []);
    expect(card.dog).toBeNull();
  });

  it("reads the outcome only from the application", () => {
    const pickup = { date: "2026-03-02", time: "11:00", location: "x" };
    const completedAt = ts(new Date(2026, 4, 9).getTime());
    const [done] = pastFosters([journey("j", "a", "2026-05-10", { pickup })], DOGS,
      [app("a", "completed", { completedAt })], []);
    expect(done.outcome).toEqual({ kind: "fostered", from: formatDay("2026-03-02"), to: formatDay(completedAt.toMillis()) });
    expect(outcomeLabel(done.outcome!)).toBe(`Fostered ${formatDay("2026-03-02")} → ${formatDay(completedAt.toMillis())}`);

    const [withdrew] = pastFosters([journey("j", "a", "x")], DOGS, [app("a", "withdrawn")], []);
    expect(outcomeLabel(withdrew.outcome!)).toBe("You withdrew");

    const [declined] = pastFosters([journey("j", "a", "x")], DOGS, [app("a", "declined")], []);
    expect(declined.outcome?.kind).toBe("declined");
    expect(outcomeLabel(declined.outcome!)).toMatch(/ declined$/);
  });

  it("gives no outcome line without an application, or with a live one -- never from readyForAdoption", () => {
    const [none] = pastFosters([journey("j", "a", "x", { readyForAdoption: true })], DOGS, [], []);
    expect(none.outcome).toBeNull();
    const [live] = pastFosters([journey("j", "a", "x")], DOGS, [app("a", "approved")], []);
    expect(live.outcome).toBeNull();
  });

  it("uses the latest application per dog", () => {
    const [card] = pastFosters([journey("j", "a", "x")], DOGS,
      [app("a", "completed", { createdAt: ts(1) }), app("a", "withdrawn", { createdAt: ts(5) })], []);
    expect(card.outcome?.kind).toBe("withdrew");
  });

  it("marks a journey whose dog still has this foster's page published", () => {
    const cards = pastFosters([journey("j1", "a", "2026-01-01"), journey("j2", "b", "2026-02-01")], DOGS, [], ["a"]);
    expect(Object.fromEntries(cards.map((c) => [c.journey.dogId, c.published]))).toEqual({ a: true, b: false });
  });
});

describe("journeyCareLog", () => {
  const entry = (id: string, dogId?: string): CareLogEntry => ({
    id, type: "weigh_in", note: "", value: "20", photo_url: "", created_at: null, ...(dogId ? { dogId } : {}),
  });

  it("matches strictly by dog -- an untagged entry belongs to the current journey, not a filed one", () => {
    const got = journeyCareLog([entry("1", "a"), entry("2", "b"), entry("3")], { dogId: "a" });
    expect(got.map((e) => e.id)).toEqual(["1"]);
  });
});
