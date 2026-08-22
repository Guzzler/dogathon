import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDogs } from "../../hooks/useDogs";
import { useFoster } from "../../hooks/useFoster";
import { useJournal } from "../../hooks/useJournal";
import { normalizeDog } from "../../lib/dog";
import type { Dog } from "../../types";
import {
  daysSincePickup,
  emergencyContacts,
  medicalSummary,
  scheduleBlocks as seedSchedule,
  seedMilestones,
  tips,
  weekPhases,
} from "./data";
import { Emergency } from "./Emergency";
import { Hub } from "./Hub";
import { Journal } from "./Journal";
import { Timeline } from "./Timeline";
import { Tips } from "./Tips";
import { firedRules } from "./triggers";
import type {
  DogProfile,
  ExperienceLevel,
  JournalEntry,
  ScheduleBlock,
  Tip,
} from "./types";
import "./carePlan.css";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDogProfile(dog: Dog, pickupDate: string): DogProfile {
  const d = normalizeDog(dog);
  return {
    id: d.id,
    name: d.name,
    breed: d.breed,
    ageMonths: Math.max(1, Math.round(d.age_years * 12)),
    weightLbs: d.weight_lbs,
    pickupDate,
    medicalFlags: d.needs ?? [],
    backstory: d.notes,
  };
}

type View = "hub" | "timeline" | "journal" | "tips" | "emergency";

const SHOW_DEMO_CONTROLS = false;

function dateLabelForDay(day: number, pickupIso: string): string {
  const [y, m, d] = pickupIso.split("-").map(Number);
  const target = new Date(y, m - 1, d + (day - 1));
  return target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const DAY_OPTIONS = [
  { day: 1, label: "Week 1 · Day 1 (today)" },
  { day: 8, label: "Week 2 · Day 8" },
  { day: 15, label: "Week 3 · Day 15" },
  { day: 22, label: "Week 4 · Day 22" },
  { day: 42, label: "Week 6 · Day 42" },
];

function phaseForDay(day: number) {
  const weekIndex = Math.min(Math.max(Math.ceil(day / 7), 1), 6);
  return (
    weekPhases.find((p) => p.index === weekIndex) ??
    weekPhases[weekPhases.length - 1]
  );
}

export function CarePlanView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  const matchedDog = useMemo(
    () => (foster?.matchedDogId ? dogs.find((d) => d.id === foster.matchedDogId) : undefined),
    [foster?.matchedDogId, dogs],
  );

  const pickupIso = foster?.pickup?.date || todayIso();
  const dog: DogProfile | null = matchedDog ? toDogProfile(matchedDog, pickupIso) : null;

  const [view, setView] = useState<View>("hub");
  const [dayInFoster, setDayInFoster] = useState(() => daysSincePickup(pickupIso));
  const [experience, setExperience] = useState<ExperienceLevel>("beginner");
  const [journal, setJournal] = useJournal();   // persisted, so the adoption page sees it too
  const [schedule, setSchedule] = useState<ScheduleBlock[]>(seedSchedule);

  const phase = phaseForDay(dayInFoster);

  const tipsById = useMemo(() => {
    const m: Record<string, Tip> = {};
    tips.forEach((t) => (m[t.id] = t));
    return m;
  }, []);

  const fired = useMemo(
    () =>
      firedRules({
        entries: journal,
        tasks: [],
        profile: dog ?? { id: "", name: "", breed: "", ageMonths: 0, weightLbs: 0, pickupDate: pickupIso, medicalFlags: [], backstory: "" },
        dayInFoster,
      }),
    [journal, dayInFoster],
  );

  function toggleScheduled(blockId: string, itemId: string) {
    setSchedule((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              items: b.items.map((it) =>
                it.id === itemId ? { ...it, done: !it.done } : it,
              ),
            }
          : b,
      ),
    );
  }

  function addJournalEntry(
    entry: Omit<JournalEntry, "id" | "createdAt" | "dayInFoster">,
  ) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setJournal((prev) => [
      {
        ...entry,
        id: `j-${Date.now()}`,
        createdAt: `Day ${dayInFoster} · ${time}`,
        dayInFoster,
      },
      ...prev,
    ]);
  }

  function toggleStar(id: string) {
    setJournal((prev) => prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));
  }

  if (loading) {
    return <div className="cp-stage cp-stage--empty"><p className="cp-mini-meta">Loading Care Plan…</p></div>;
  }

  if (!dog) {
    return (
      <div className="cp-stage cp-stage--empty">
        <div className="cp-empty-card">
          <p className="cp-eyebrow">No foster yet</p>
          <h2>Finish the Match phase first</h2>
          <p className="cp-mini-meta">
            Your Care Plan unlocks once you've been matched with a dog. Head to Match to
            confirm approval and schedule pickup.
          </p>
          <button className="cp-btn cp-btn--primary" onClick={() => navigate("/match")}>
            Open Match →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cp-stage ${SHOW_DEMO_CONTROLS ? "" : "cp-stage--solo"}`}>
      {SHOW_DEMO_CONTROLS && (
        <aside className="cp-demo-panel" aria-label="Demo controls">
          <p className="cp-eyebrow">Demo controls</p>
          <label className="cp-select">
            <span className="cp-mini-meta">Day in foster · {dateLabelForDay(dayInFoster, pickupIso)}</span>
            <select value={dayInFoster} onChange={(e) => setDayInFoster(Number(e.target.value))}>
              {DAY_OPTIONS.map((o) => (
                <option key={o.day} value={o.day}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="cp-select">
            <span className="cp-mini-meta">Experience</span>
            <select value={experience} onChange={(e) => setExperience(e.target.value as ExperienceLevel)}>
              <option value="beginner">Beginner</option>
              <option value="experienced">Experienced</option>
            </select>
          </label>
          <button className="cp-btn cp-btn--ghost cp-btn--full" onClick={() => navigate("/")}>
            ← Back to Hub
          </button>
          <p className="cp-demo-hint">
            Try typing <em>"{dog.name} was nipping"</em> in the Journal tab, then swing back to Home — a triggered card appears.
          </p>
        </aside>
      )}

      <div className="cp-demo" role="application">
        <header className="cp-topbar">
          <div className="cp-avatar" aria-hidden="true">🐾</div>
          <div>
            <p className="cp-eyebrow">Pawthway · Care Plan</p>
            <h1 className="cp-topbar__title">{dog.name} · {dog.breed} · {dog.ageMonths} mo</h1>
          </div>
        </header>

        <nav className="cp-tabs" role="tablist">
          {[
            { id: "hub", label: "Home" },
            { id: "timeline", label: "Timeline" },
            { id: "journal", label: "Journal" },
            { id: "tips", label: "Tips" },
            { id: "emergency", label: "Emergency" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              className={`cp-tab ${view === t.id ? "cp-tab--active" : ""} ${t.id === "emergency" ? "cp-tab--danger" : ""}`}
              onClick={() => setView(t.id as View)}
            >
              {t.label}
              {t.id === "hub" && fired.length > 0 && (
                <span className="cp-tab__badge">{fired.length}</span>
              )}
            </button>
          ))}
        </nav>

        <main className="cp-main">
          {view === "hub" && (
            <Hub
              dog={dog}
              dayInFoster={dayInFoster}
              phase={phase}
              blocks={schedule}
              onToggleScheduled={toggleScheduled}
              pinnedTip={tipsById[phase.pinnedTipId]}
              firedRules={fired}
              tipsById={tipsById}
              experience={experience}
              onOpen={(v) => setView(v)}
            />
          )}
          {view === "timeline" && (
            <Timeline milestones={seedMilestones} dayInFoster={dayInFoster} dogName={dog.name} />
          )}
          {view === "journal" && (
            <Journal
              entries={journal}
              dayInFoster={dayInFoster}
              dogName={dog.name}
              onAdd={addJournalEntry}
              onToggleStar={toggleStar}
            />
          )}
          {view === "tips" && (
            <Tips tips={tips} pinnedTipId={phase.pinnedTipId} dogName={dog.name} />
          )}
          {view === "emergency" && (
            <Emergency dog={dog} summary={medicalSummary} contacts={emergencyContacts} />
          )}
        </main>
      </div>
    </div>
  );
}
