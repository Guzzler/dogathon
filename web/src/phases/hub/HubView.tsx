import { Link } from "react-router-dom";
import { useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import type { FosterPhase } from "../../types";

const PHASE_COPY: Record<FosterPhase, { title: string; body: string; cta: string; to: string }> = {
  onboarding: {
    title: "Let's get to know you",
    body: "Answer a few quick questions so we can match you with the right dog.",
    cta: "Start onboarding",
    to: "/onboarding",
  },
  discovery: {
    title: "Find your match",
    body: "Swipe through dogs from nearby shelters that fit what you're looking for.",
    cta: "Browse dogs",
    to: "/discovery",
  },
  match: {
    title: "Get ready for pickup",
    body: "Finish the approval checklist, prep your home, and schedule pickup.",
    cta: "Go to Match",
    to: "/match",
  },
  care_plan: {
    title: "Caring for your foster",
    body: "Log weigh-ins, vet visits, and notes -- and ask the AI anything.",
    cta: "Open Care Plan",
    to: "/care-plan",
  },
  complete: {
    title: "Journey complete",
    body: "Your foster's adoption profile is with the shelter. Thank you for fostering!",
    cta: "View Post Foster Plan",
    to: "/post-foster",
  },
};

export function HubView() {
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  if (loading) return <p className="pw-loading">Loading your hub…</p>;
  if (!foster) return <p className="pw-loading">No foster profile found yet.</p>;

  const matchedDog = dogs.find((d) => d.id === foster.matchedDogId);
  const step = PHASE_COPY[foster.phase] ?? PHASE_COPY.onboarding;

  return (
    <div className="pw-page">
      <h1>Hi {foster.name || "there"} 👋</h1>
      <p className="pw-subtitle">Here's where you are on your foster journey.</p>

      <div className="hub-card">
        <p className="hub-card__eyebrow">Next up</p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <Link className="btn btn--primary" to={step.to}>
          {step.cta}
        </Link>
      </div>

      {matchedDog && (
        <div className="hub-card hub-card--dog">
          <p className="hub-card__eyebrow">Your match</p>
          <h2>{matchedDog.name}</h2>
          <p>
            {matchedDog.breed} · {matchedDog.age_years} yrs · {matchedDog.weight_lbs} lbs
          </p>
          <p className="pw-muted">{matchedDog.notes}</p>
        </div>
      )}

      <div className="hub-steps">
        {(Object.entries(PHASE_COPY) as [FosterPhase, (typeof PHASE_COPY)[FosterPhase]][]).map(([key, s]) => (
          <Link key={key} to={s.to} className={`hub-step ${foster.phase === key ? "hub-step--active" : ""}`}>
            {s.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
