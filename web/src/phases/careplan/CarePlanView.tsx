import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  daysSincePickup,
  emergencyContacts,
  marty,
  medicalSummary,
  scheduleBlocks as seedSchedule,
  seedJournal,
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
  ExperienceLevel,
  JournalEntry,
  ScheduleBlock,
  Tip,
} from "./types";
import "./carePlan.css";

type View = "hub" | "timeline" | "journal" | "tips" | "emergency";

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
  const [view, setView] = useState<View>("hub");
  const [dayInFoster, setDayInFoster] = useState(() => daysSincePickup(marty.pickupDate));
  const [experience, setExperience] = useState<ExperienceLevel>("beginner");
  const [journal, setJournal] = useState<JournalEntry[]>(seedJournal);
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
        profile: marty,
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

  return (
    <div className="cp-stage">
      <aside className="cp-demo-panel" aria-label="Demo controls">
        <p className="cp-eyebrow">Demo controls</p>
        <label className="cp-select">
          <span className="cp-mini-meta">Day in foster · {dateLabelForDay(dayInFoster, marty.pickupDate)}</span>
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
          Try typing <em>"Marty was nipping"</em> in the Journal tab, then swing back to Hub — a triggered card appears.
        </p>
      </aside>

      <div className="cp-demo" role="application">
        <header className="cp-topbar">
          <div className="cp-avatar" aria-hidden="true">🐾</div>
          <div>
            <p className="cp-eyebrow">Pawthway · Care Plan</p>
            <h1 className="cp-topbar__title">{marty.name} · {marty.breed} · {marty.ageMonths} mo</h1>
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
              dog={marty}
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
            <Timeline milestones={seedMilestones} dayInFoster={dayInFoster} />
          )}
          {view === "journal" && (
            <Journal
              entries={journal}
              dayInFoster={dayInFoster}
              onAdd={addJournalEntry}
              onToggleStar={toggleStar}
            />
          )}
          {view === "tips" && (
            <Tips tips={tips} pinnedTipId={phase.pinnedTipId} dogName={marty.name} />
          )}
          {view === "emergency" && (
            <Emergency dog={marty} summary={medicalSummary} contacts={emergencyContacts} />
          )}
        </main>
      </div>
    </div>
  );
}
