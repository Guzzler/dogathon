import type { Foster } from "../types";

/**
 * A foster who has never answered the questionnaire has no intake. Older records were
 * written before the pref_* fields existed, so "any intake at all" is the test, with the
 * phase as a second signal.
 */
export function hasOnboarded(foster: Foster | null): boolean {
  if (!foster) return false;
  if (Object.keys(foster.intake ?? {}).length > 0) return true;
  return foster.phase !== "onboarding";
}

/** Only the two phases where a dog is actually spoken for. */
export type ActiveApplication = { dogId: string; phase: "match" | "care_plan" };

/**
 * One foster dog at a time: while an application is in review, or a dog is actually in
 * their care, applying for another is blocked. A finished journey frees them up again.
 */
export function activeApplication(foster: Foster | null): ActiveApplication | null {
  if (!foster?.matchedDogId) return null;
  if (foster.phase === "complete") return null;
  if (foster.phase !== "match" && foster.phase !== "care_plan") return null;
  return { dogId: foster.matchedDogId, phase: foster.phase };
}

/** Where that dog currently sits, for the "you're already…" copy. */
export function applicationStage(a: ActiveApplication): { verb: string; to: string; cta: string } {
  return a.phase === "care_plan"
    ? { verb: "currently fostering", to: "/care-plan", cta: "Open Care Plan" }
    : { verb: "already applied to foster", to: "/match", cta: "Open Match checklist" };
}

/* ---------- how long the foster runs, and how much is left ---------- */

const DAY = 86_400_000;

export interface FosterWindow {
  /** Total commitment, e.g. "6 weeks" / "3 months". */
  total: string;
  /** Set once a pickup date exists — until then there's nothing to count down from. */
  started: boolean;
  daysLeft: number;
  /** "5 weeks left", "3 days left", "Last day", "2 days over". */
  leftLabel: string;
  /** 0–1, for progress bars. */
  progress: number;
  endDate: Date | null;
}

/**
 * The countdown is anchored to `pickup.date` from the Match phase — that's when the dog
 * actually arrives, so it's the only honest start. Before pickup we only show the total.
 */
export function fosterWindow(
  totalWeeks: number,
  totalLabel: string,
  pickupDate: string | null | undefined,
): FosterWindow {
  const base: FosterWindow = {
    total: totalLabel, started: false, daysLeft: totalWeeks * 7,
    leftLabel: `${totalLabel} commitment`, progress: 0, endDate: null,
  };
  if (!pickupDate) return base;

  const start = new Date(`${pickupDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return base;

  const end = new Date(start.getTime() + totalWeeks * 7 * DAY);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (today < start) {
    const until = Math.round((start.getTime() - today.getTime()) / DAY);
    return { ...base, endDate: end, leftLabel: until === 1 ? "Pickup tomorrow" : `Pickup in ${until} days` };
  }

  const daysLeft = Math.round((end.getTime() - today.getTime()) / DAY);
  const elapsed = totalWeeks * 7 - daysLeft;
  const progress = Math.max(0, Math.min(1, elapsed / (totalWeeks * 7)));

  let leftLabel: string;
  if (daysLeft < 0) leftLabel = `${-daysLeft} day${daysLeft === -1 ? "" : "s"} over`;
  else if (daysLeft === 0) leftLabel = "Last day";
  else if (daysLeft < 14) leftLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  else if (daysLeft < 56) leftLabel = `${Math.round(daysLeft / 7)} weeks left`;
  else leftLabel = `${Math.round(daysLeft / 30.4)} months left`;

  return { total: totalLabel, started: true, daysLeft, leftLabel, progress, endDate: end };
}
