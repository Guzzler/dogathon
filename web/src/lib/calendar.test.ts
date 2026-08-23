import { describe, expect, it } from "vitest";
import { pickupIcs, type PickupEvent } from "./calendar";

/**
 * A wrong .ics is worse than no .ics: the foster gets a calendar entry that looks right and
 * sends them to the shelter at the wrong hour. The 12-hour clock is where that goes wrong,
 * so noon and midnight are pinned alongside the ordinary afternoon slot.
 */

const EVENT: PickupEvent = {
  dogName: "Biscuit",
  shelterName: "SF SPCA",
  date: "2026-06-12",
  time: "1:30 PM",
  location: "201 Alabama St, San Francisco",
};

function build(over: Partial<PickupEvent> = {}): string {
  const out = pickupIcs({ ...EVENT, ...over });
  if (!out) throw new Error(`pickupIcs returned null for time=${over.time ?? EVENT.time}`);
  return out;
}

/**
 * Timestamps are stamped in UTC but built from a local-time Date, so read them back as UTC
 * and ask for the local hour. That keeps the assertion honest wherever CI runs.
 */
function localTime(ics: string, field: "DTSTART" | "DTEND"): Date {
  const m = new RegExp(`^${field}:(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z$`, "m").exec(ics);
  if (!m) throw new Error(`${field} missing from the generated ics`);
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

describe("pickupIcs", () => {
  it("reads an afternoon slot onto the 24-hour clock", () => {
    const start = localTime(build(), "DTSTART");
    expect([start.getHours(), start.getMinutes()]).toEqual([13, 30]);
  });

  it("gets the two hours the % 12 rule turns over right", () => {
    expect(localTime(build({ time: "12:15 AM" }), "DTSTART").getHours()).toBe(0);
    expect(localTime(build({ time: "12:15 PM" }), "DTSTART").getHours()).toBe(12);
  });

  it("blocks out 45 minutes unless told otherwise", () => {
    const span = (ics: string) => localTime(ics, "DTEND").getTime() - localTime(ics, "DTSTART").getTime();
    expect(span(build())).toBe(45 * 60_000);
    expect(span(build({ durationMinutes: 90 }))).toBe(90 * 60_000);
  });

  it("returns null rather than a bogus event for a time it can't read", () => {
    expect(pickupIcs({ ...EVENT, time: "13:30" })).toBeNull();
    expect(pickupIcs({ ...EVENT, time: "1:30" })).toBeNull();
    expect(pickupIcs({ ...EVENT, time: "" })).toBeNull();
  });

  it("returns null for a date that isn't YYYY-MM-DD", () => {
    expect(pickupIcs({ ...EVENT, date: "June 12" })).toBeNull();
  });

  it("escapes the punctuation that would otherwise end an ics line early", () => {
    expect(build()).toContain("LOCATION:201 Alabama St\\, San Francisco");
  });
});
