import { afterEach, describe, expect, it, vi } from "vitest";
import { fosterWindow } from "./foster";

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
