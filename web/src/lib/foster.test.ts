import { afterEach, describe, expect, it, vi } from "vitest";
import { activeApplication, fosterWindow } from "./foster";
import type { Foster } from "../types";

/**
 * fosterWindow() is the one function whose answer changes on its own overnight, which is
 * exactly why it can rot without anyone touching it. Pinning "today" is the only way the
 * boundaries a foster actually reads -- last day, first day over, the days-to-weeks switch
 * -- get checked before they're wrong on someone's Hub.
 */

/** Mid-morning, so a bug that compares against `now` rather than local midnight still shows. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 30, 0);

function windowOn(today: Date, pickup: string | null | undefined) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(today);
  return fosterWindow(6, "6 weeks", pickup);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("fosterWindow", () => {
  it("shows the commitment instead of a countdown while there is no pickup date", () => {
    expect(windowOn(at(2026, 3, 15), null)).toMatchObject({
      started: false,
      daysLeft: 42,
      leftLabel: "6 weeks commitment",
      endDate: null,
    });
  });

  it("falls back to that same state when the stored pickup date is unparseable", () => {
    expect(windowOn(at(2026, 3, 15), "next tuesday")).toMatchObject({ started: false, endDate: null });
  });

  it("counts down to the pickup itself while it is still ahead", () => {
    expect(windowOn(at(2026, 3, 15), "2026-03-20").leftLabel).toBe("Pickup in 5 days");
    expect(windowOn(at(2026, 3, 15), "2026-03-16").leftLabel).toBe("Pickup tomorrow");
  });

  // Pickup 2026-03-15 + 6 weeks lands on 2026-04-26.
  it("names the last day, then counts days over", () => {
    expect(windowOn(at(2026, 4, 26), "2026-03-15").leftLabel).toBe("Last day");
    expect(windowOn(at(2026, 4, 27), "2026-03-15").leftLabel).toBe("1 day over");
    expect(windowOn(at(2026, 4, 29), "2026-03-15").leftLabel).toBe("3 days over");
  });

  it("switches from days to weeks at the fortnight mark", () => {
    expect(windowOn(at(2026, 4, 13), "2026-03-15").leftLabel).toBe("13 days left");
    expect(windowOn(at(2026, 4, 12), "2026-03-15").leftLabel).toBe("2 weeks left");
  });

  it("keeps progress inside 0–1 once the window is overrun", () => {
    expect(windowOn(at(2026, 3, 15), "2026-03-15").progress).toBe(0);
    expect(windowOn(at(2026, 5, 20), "2026-03-15").progress).toBe(1);
  });
});

/**
 * The one-foster-at-a-time block, now that the shelter can end an application without the
 * foster touching anything. The point of the whole RS-11 change is the last case: a declined
 * foster is free to apply elsewhere *and* still has `matchedDogId`, because moving them off
 * the screen they were on is not the app's decision to make.
 */
describe("activeApplication", () => {
  const matched = { matchedDogId: "dog-1", phase: "match" } as Foster;

  it("blocks while the application is live, whatever the shelter has it marked as", () => {
    expect(activeApplication(matched, "submitted")).toEqual({ dogId: "dog-1", phase: "match" });
    expect(activeApplication(matched, "in_review")).toEqual({ dogId: "dog-1", phase: "match" });
    expect(activeApplication(matched, "approved")).toEqual({ dogId: "dog-1", phase: "match" });
  });

  it("blocks when there is no application document at all", () => {
    // A guest, LOCAL_MODE, or a record predating the collection. Absence is not a decision.
    expect(activeApplication(matched, null)).toEqual({ dogId: "dog-1", phase: "match" });
    expect(activeApplication(matched, undefined)).toEqual({ dogId: "dog-1", phase: "match" });
  });

  it("releases the block on a declined application without moving the foster", () => {
    expect(activeApplication(matched, "declined")).toBe(null);
    // The record itself is untouched: still matched, still in the match phase, so the
    // Applications tab can say what happened instead of silently emptying.
    expect(matched.matchedDogId).toBe("dog-1");
    expect(matched.phase).toBe("match");
  });

  it("releases the block on a withdrawn application", () => {
    expect(activeApplication(matched, "withdrawn")).toBe(null);
  });

  it("still returns nothing when there is no match or the journey is finished", () => {
    expect(activeApplication(null, "submitted")).toBe(null);
    expect(activeApplication({ matchedDogId: null, phase: "match" } as Foster, "submitted")).toBe(null);
    expect(activeApplication({ matchedDogId: "dog-1", phase: "complete" } as Foster, "approved")).toBe(null);
  });
});
