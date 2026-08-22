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
