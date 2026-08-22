import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { ENERGY_WORD } from "../../lib/dog";
import { prefs } from "../../lib/matching";
import type { FosterIntake, FosterPhase } from "../../types";

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

      <LookingForCard intake={foster.intake} />

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

const TAG_LABEL: Record<string, string> = {
  groomLow: "Low grooming", groomHigh: "Happy to groom", kidsGood: "Good with kids",
  adultsOnly: "Adults only", coatShort: "Short coat", coatLong: "Long coat",
  withDogs: "Dog-friendly", withCats: "Cat-friendly",
};
const HOME_LABEL: Record<string, string> = {
  apartment: "Apartment-friendly", townhouse: "Townhouse-friendly", houseYard: "Yard to run in",
};

/** What the questionnaire concluded, with a way to start it over. */
function LookingForCard({ intake }: { intake: FosterIntake }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const p = prefs(intake);

  const chips = [
    p.size < 33 ? "Small" : p.size < 67 ? "Medium" : "Large",
    `${ENERGY_WORD[p.energy]} energy`,
    p.home ? HOME_LABEL[p.home] : null,
    p.experience === "first" ? "First-time foster" : p.experience ? "Experienced foster" : null,
    ...p.tags.map((t) => TAG_LABEL[t]),
  ].filter(Boolean) as string[];

  async function reset() {
    // Clearing intake sends them back through the front door.
    await patchFoster({ intake: {}, phase: "onboarding", likedDogIds: [], passedDogIds: [], matchedDogId: null });
    navigate("/welcome");
  }

  return (
    <div className="hub-card">
      <p className="hub-card__eyebrow">What you're looking for</p>
      <div className="looking-chips">
        {chips.map((c, n) => (
          <span key={c} className={`chip ${["coral", "sage", "butter"][n % 3]}`}>{c}</span>
        ))}
      </div>
      {intake.restrictions && <p className="pw-muted looking-note">Note: {intake.restrictions}</p>}

      {confirming ? (
        <div className="looking-actions">
          <button className="btn btn--ghost" onClick={() => setConfirming(false)}>Keep it</button>
          <button className="btn btn--primary" onClick={reset}>Reset and start over</button>
        </div>
      ) : (
        <div className="looking-actions">
          <Link className="btn btn--primary" to="/discovery">Browse matches</Link>
          <button className="btn btn--ghost" onClick={() => setConfirming(true)}>Change answers</button>
        </div>
      )}
    </div>
  );
}
