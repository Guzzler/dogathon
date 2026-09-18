/**
 * Builds an .ics file for a *requested* pickup so the date lands in the foster's real calendar
 * instead of only living in this app. Everything is generated in the browser -- there's no
 * calendar integration to configure.
 *
 * This file leaves the app and survives anything corrected later, which is why PH-23 treated it
 * as the worst of the six places the app spoke for the shelter: the DESCRIPTION used to tell the
 * foster what to bring and how long the handoff takes, and no shelter had told us either.
 */
const SLOT = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

/** "1:30 PM" -> {hour: 13, minute: 30}. Returns null for anything unrecognised. */
function parseSlot(time: string): { hour: number; minute: number } | null {
  const m = SLOT.exec(time.trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return { hour, minute: Number(m[2]) };
}

function stamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

/** Folds per RFC 5545 and escapes the characters that would break a line. */
function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface PickupEvent {
  dogName: string;
  shelterName: string;
  date: string; // YYYY-MM-DD
  time: string; // "1:30 PM"
  location: string;
  durationMinutes?: number;
}

export function pickupIcs(ev: PickupEvent): string | null {
  const slot = parseSlot(ev.time);
  if (!slot) return null;

  const [y, m, d] = ev.date.split("-").map(Number);
  if (!y || !m || !d) return null;

  const start = new Date(y, m - 1, d, slot.hour, slot.minute);
  // 45 minutes is geometry, not a claim: an .ics needs a DTEND, and a calendar entry with no
  // width is unreadable. It is deliberately not printed anywhere as "how long this takes" --
  // the DESCRIPTION used to say "about 30 minutes for paperwork", which nobody had measured
  // at any shelter, and the two numbers disagreeing was the tell (PH-23).
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 45) * 60_000);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pawthway//Foster pickup//EN",
    "BEGIN:VEVENT",
    `UID:pickup-${ev.date}-${Date.now()}@pawthway`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`Pick up ${ev.dogName}`)}`,
    `LOCATION:${escape(ev.location)}`,
    `DESCRIPTION:${escape(
      `Foster pickup for ${ev.dogName} at ${ev.shelterName}. This is the time you requested in Pawthway -- ${ev.shelterName} still has to confirm it. Message them in the app to agree the day and what to bring.`,
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(ev: PickupEvent) {
  const ics = pickupIcs(ev);
  if (!ics) return false;

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `pickup-${ev.dogName.toLowerCase()}-${ev.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
