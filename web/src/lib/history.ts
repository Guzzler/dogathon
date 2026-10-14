import type { Application, CareLogEntry, Dog, JourneyArchive } from "../types";
import { normalizeDog, type RichDog } from "./dog";
import { shelterName } from "./shelters";

/**
 * Past fosters (PH-37): the read path for what `leaveJourney` files.
 *
 * *A foster's records outlive the pointer, and so does their authorship.* Every journey filed at
 * `fosters/{uid}/journeys` is readable by its foster, and every page they published is reachable
 * by the one person who can take it down -- even after `matchedDogId` has moved to another dog,
 * which is the moment every other screen stops seeing it.
 *
 * Pure assembly; `useJourneys` does the reading.
 */

/** A filed journey with the id `/history/:journeyId` routes by. Local journeys get `local-<n>`. */
export interface FiledJourney extends JourneyArchive {
  id: string;
}

/**
 * How the foster period ended -- only ever from the foster's own application, never inferred
 * (`readyForAdoption` says what the foster marked, not what the shelter did).
 */
export type JourneyOutcome =
  | { kind: "fostered"; from: string | null; to: string | null }
  | { kind: "withdrew" }
  | { kind: "declined"; shelter: string };

export interface PastFoster {
  journey: FiledJourney;
  /** `null` when the dog's document is gone -- the card says so, it never guesses a name. */
  dog: RichDog | null;
  outcome: JourneyOutcome | null;
  /** Whether this foster still has a page up at `/adoption/{dogId}`. */
  published: boolean;
}

/** Millis for a Firestore `Timestamp`, an ISO string (guest journeys), or nothing. */
export function millisOf(at: unknown): number {
  if (!at) return 0;
  if (typeof at === "string") return Date.parse(at) || 0;
  if (typeof at === "object") {
    const t = at as { toMillis?: () => number; seconds?: number };
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
  }
  return 0;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** "3 Oct 2026" from a `YYYY-MM-DD` pickup date (read as a local calendar day) or millis. */
export function formatDay(value: string | number | null | undefined): string | null {
  if (value == null || value === "" || value === 0) return null;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined, DATE_FMT);
  }
  return new Date(value).toLocaleDateString(undefined, DATE_FMT);
}

/** The newest application per dog, by `createdAt`. */
function latestByDog(applications: Application[]): Map<string, Application> {
  const out = new Map<string, Application>();
  for (const a of applications) {
    const prev = out.get(a.dogId);
    if (!prev || millisOf(a.createdAt) >= millisOf(prev.createdAt)) out.set(a.dogId, a);
  }
  return out;
}

/**
 * The outcome line, from the application alone. A live status (submitted, in review, approved)
 * on a filed journey -- the foster left via **Change answers** -- and no application at all
 * (guest journeys, records older than `applications`) both get no line: there is nothing the
 * shelter decided to report.
 */
export function outcomeOf(journey: FiledJourney, dog: RichDog | null, application: Application | undefined): JourneyOutcome | null {
  switch (application?.status) {
    case "completed":
      return {
        kind: "fostered",
        from: formatDay(journey.pickup?.date),
        to: formatDay(millisOf(application.completedAt)),
      };
    case "withdrawn":
      return { kind: "withdrew" };
    case "declined":
      return { kind: "declined", shelter: dog ? shelterName(dog, "short", { start: true }) : "The shelter" };
    default:
      return null;
  }
}

/** The outcome as the one line the card and the detail page both print. */
export function outcomeLabel(outcome: JourneyOutcome): string {
  switch (outcome.kind) {
    case "fostered":
      return outcome.from && outcome.to ? `Fostered ${outcome.from} → ${outcome.to}`
        : outcome.to ? `Fostered · returned ${outcome.to}`
        : "Fostered";
    case "withdrew":
      return "You withdrew";
    case "declined":
      return `${outcome.shelter} declined`;
  }
}

/**
 * One card per journey, not per dog: a dog can be fostered twice, and each stay is its own
 * record. Newest filed first.
 */
export function pastFosters(
  journeys: FiledJourney[],
  dogs: Dog[],
  applications: Application[],
  published: string[],
): PastFoster[] {
  const byDog = latestByDog(applications);
  const pages = new Set(published);
  return [...journeys]
    .sort((a, b) => millisOf(b.archivedAt) - millisOf(a.archivedAt))
    .map((journey) => {
      const raw = dogs.find((d) => d.id === journey.dogId);
      const dog = raw ? normalizeDog(raw) : null;
      return {
        journey,
        dog,
        outcome: outcomeOf(journey, dog, byDog.get(journey.dogId)),
        published: pages.has(journey.dogId),
      };
    });
}

/**
 * The care-log entries written about this journey's dog. **Strict** -- not `belongsToDog`, which
 * deliberately counts an untagged entry as the *current* journey's. By the time a journey is
 * filed, `leaveJourney` has stamped every untagged entry, so an untagged one is never this one's.
 */
export function journeyCareLog(entries: CareLogEntry[], journey: Pick<JourneyArchive, "dogId">): CareLogEntry[] {
  return entries.filter((e) => e.dogId === journey.dogId);
}
