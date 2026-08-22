import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { patchFoster } from "../../hooks/useFoster";
import type { FosterIntake } from "../../types";

interface Step {
  key: keyof FosterIntake;
  question: string;
  options: string[];
}

const STEPS: Step[] = [
  {
    key: "living_arrangement",
    question: "What's your living arrangement?",
    options: ["Apartment", "House with yard"],
  },
  {
    key: "experience_level",
    question: "Have you fostered before?",
    options: ["First-time foster", "Experienced foster"],
  },
  {
    key: "time_availability",
    question: "How much daily time can you give a dog?",
    options: ["A little (WFH some days)", "A lot (home most of the day)"],
  },
  {
    key: "size_preference",
    question: "What size dog are you looking for?",
    options: ["Small", "Medium", "Large"],
  },
  {
    key: "energy_preference",
    question: "What energy level fits your life?",
    options: ["Low-key couch companion", "Medium", "High-energy adventure buddy"],
  },
];

export function OnboardingView() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<FosterIntake>({});
  const [restrictions, setRestrictions] = useState("");
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];
  const done = stepIndex >= STEPS.length;

  function choose(value: string) {
    setAnswers((prev) => ({ ...prev, [step.key]: value }));
    setStepIndex((i) => i + 1);
  }

  async function finish() {
    setSaving(true);
    try {
      await patchFoster({
        name: "Annie",
        intake: { ...answers, restrictions },
        phase: "discovery",
      });
      navigate("/discovery");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pw-page pw-page--narrow">
      <h1>Tell us about you</h1>
      <p className="pw-subtitle">Quick swipe-easy questions -- this takes about a minute.</p>

      <div className="onboarding-progress">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`onboarding-progress__dot ${i < stepIndex ? "onboarding-progress__dot--done" : ""}`} />
        ))}
      </div>

      {!done ? (
        <div className="swipe-card swipe-card--question">
          <h2>{step.question}</h2>
          <div className="onboarding-options">
            {step.options.map((opt) => (
              <button key={opt} className="btn btn--primary onboarding-option" onClick={() => choose(opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="swipe-card swipe-card--question">
          <h2>Anything we should know?</h2>
          <p className="pw-muted">Any hard restrictions -- allergies, other pets, HOA rules, etc. Optional.</p>
          <textarea
            className="pw-textarea"
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder="e.g. no cats in the home"
            rows={3}
          />
          <button className="btn btn--primary" disabled={saving} onClick={finish}>
            {saving ? "Saving…" : "See my matches"}
          </button>
        </div>
      )}
    </div>
  );
}
