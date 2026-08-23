/**
 * Builds an .ics file for a confirmed pickup so the date lands in the foster's
 * real calendar instead of only living in this app. Everything is generated in
 * the browser -- there's no calendar integration to configure.
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
      `Foster pickup for ${ev.dogName} at ${ev.shelterName}. Bring a carrier or leash and collar, a towel, and proof of address. Allow about 30 minutes for paperwork.`,
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
