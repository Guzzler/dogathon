import { useEffect, useState } from "react";
import { buildPlanTimeline } from "./plan";
import { WeightChart } from "./Timeline";
import type {
  DogProfile,
  ExperienceLevel,
  Milestone,
  ScheduleBlock,
  Tip,
  TriggerRule,
  WeekPhase,
} from "./types";

interface HubProps {
  dog: DogProfile;
  dayInFoster: number;
  phase: WeekPhase;
  blocks: ScheduleBlock[];
  milestones: Milestone[];
  onToggleScheduled: (blockId: string, itemId: string) => void;
  pinnedTip: Tip;
  firedRules: TriggerRule[];
  tipsById: Record<string, Tip>;
  experience: ExperienceLevel;
  onOpen: (view: "journal" | "emergency") => void;
}

export function Hub({
  dog,
  dayInFoster,
  phase,
  blocks,
  milestones,
  onToggleScheduled,
  pinnedTip,
  firedRules,
  tipsById,
  experience,
  onOpen,
}: HubProps) {
  const showTipBody = experience === "beginner";

  const weeks = buildPlanTimeline(blocks, milestones, dayInFoster);

  // The week you're in should be the first thing you see. Weeks already behind you fold into a
  // single line — still reachable, but not something to scroll past every time you open the app.
  const currentIdx = weeks.findIndex((w) => w.current);
  const earlier = currentIdx > 0 ? weeks.slice(0, currentIdx) : [];
  const fromNow = currentIdx > 0 ? weeks.slice(currentIdx) : weeks;

  const [showEarlier, setShowEarlier] = useState(false);
  // Jumping the demo to another week re-folds them.
  useEffect(() => setShowEarlier(false), [currentIdx]);

  const earlierRows = earlier.flatMap((w) => w.rows);
  const earlierOpen = earlierRows.filter(
    (r) => r.status === "todo" || r.status === "planned",
  ).length;
  const earlierLabel =
    earlier.length === 1 ? earlier[0].label : `${earlier[0]?.label} – ${earlier[earlier.length - 1]?.label}`;

  const weightPoints = milestones
    .filter((m) => m.weightLbs != null && m.dayInFoster <= dayInFoster)
    .map((m) => ({ day: m.dayInFoster, lbs: m.weightLbs! }))
    .sort((a, b) => a.day - b.day);

  return (
    <div className="cp-hub">
      <section className="cp-phase-banner">
        <div>
          <p className="cp-eyebrow">{phase.eyebrow} · Day {dayInFoster} with {dog.name}</p>
          <h2 className="cp-phase-name">{phase.name}</h2>
        </div>
      </section>

      {firedRules.length > 0 && (
        <section className="cp-triggers">
          {firedRules.map((rule) => {
            const tip = tipsById[rule.tipId];
            if (!tip) return null;
            return (
              <article key={rule.id} className={`cp-trigger-card cp-trigger-card--${rule.urgency}`}>
                <p className="cp-trigger-label">Triggered · {rule.label}</p>
                <h3 className="cp-trigger-title">{tip.title}</h3>
                <p className="cp-trigger-body">{tip.body}</p>
                {rule.cta && <p className="cp-trigger-cta">→ {rule.cta}</p>}
              </article>
            );
          })}
        </section>
      )}

      {weightPoints.length >= 2 && <WeightChart points={weightPoints} />}

      <section className="cp-plan">
        <div className="cp-plan__head">
          <h3>Care plan timeline</h3>
          <p className="cp-mini-meta">Composed for {dog.name} — {dog.breed}, {dog.ageMonths} mo.</p>
        </div>

        {earlier.length > 0 && (
          <button
            type="button"
            className={`cp-earlier ${showEarlier ? "cp-earlier--open" : ""}`}
            onClick={() => setShowEarlier((v) => !v)}
            aria-expanded={showEarlier}
          >
            <span className="cp-earlier__caret" aria-hidden="true">{showEarlier ? "▾" : "▸"}</span>
            <span className="cp-earlier__label">{earlierLabel}</span>
            <span className="cp-earlier__meta">
              {earlierRows.length - earlierOpen} done
              {earlierOpen > 0 && ` · ${earlierOpen} still open`}
            </span>
          </button>
        )}

        <ol className="cp-plan__weeks">
          {(showEarlier ? weeks : fromNow).map((week) => (
            <li
              key={week.id}
              className={`cp-week ${week.passed ? "cp-week--passed" : ""} ${week.current ? "cp-week--current" : ""} ${
                showEarlier && !week.current && week.passed ? "cp-week--dim" : ""
              }`}
            >
              <div className="cp-week__head">
                <span className="cp-week__dot" />
                <div className="cp-week__label">
                  <span className="cp-week__name">{week.label}</span>
                  <span className="cp-mini-meta">
                    {week.dayRange}{week.current ? " · you are here" : ""}
                  </span>
                </div>
              </div>

              {week.rows.length > 0 && (
                <ol className="cp-rows">
                  {week.rows.map((row) => {
                    const Tag = row.toggle ? "button" : "div";
                    return (
                      <li key={row.key}>
                        <Tag
                          {...(row.toggle
                            ? {
                                type: "button" as const,
                                onClick: () => onToggleScheduled(row.toggle!.blockId, row.toggle!.itemId),
                                "aria-pressed": row.status === "done",
                              }
                            : {})}
                          className={`cp-row cp-row--${row.status} ${row.toggle ? "cp-row--tappable" : ""}`}
                        >
                          <span className="cp-row__mark" aria-hidden="true">
                            {row.status === "done" || row.status === "logged" ? "✓" : ""}
                          </span>
                          <span className="cp-row__body">
                            <span className="cp-row__top">
                              <span className="cp-row__title">{row.title}</span>
                              <span className={`cp-plan-chip__kind cp-plan-chip__kind--${row.kind}`}>
                                {row.kindLabel}
                              </span>
                            </span>
                            <span className="cp-row__meta">
                              {row.day != null ? `Day ${row.day}` : "Scheduled this week"}
                              {row.recordedDay != null && " · logged"}
                              {row.status === "upcoming" &&
                                ` · in ${row.day! - dayInFoster} day${row.day! - dayInFoster === 1 ? "" : "s"}`}
                            </span>
                            {row.note && <span className="cp-row__note">{row.note}</span>}
                          </span>
                        </Tag>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="cp-card cp-card--pinned">
        <p className="cp-eyebrow">This week · {pinnedTip.category}</p>
        <h3 className="cp-pinned-title">{pinnedTip.title}</h3>
        {showTipBody && <p className="cp-pinned-body">{pinnedTip.body}</p>}
        <button className="cp-link" onClick={() => onOpen("journal")}>
          {showTipBody ? "More tips →" : "Show body →"}
        </button>
      </section>

      <div className="cp-quick-row">
        <button className="cp-quick" onClick={() => onOpen("journal")}>
          <span className="cp-quick__label">Journal & Tips</span>
          <span className="cp-quick__meta">Photos, notes, ask anything</span>
        </button>
        <button className="cp-quick cp-quick--danger" onClick={() => onOpen("emergency")}>
          <span className="cp-quick__label">Emergency</span>
          <span className="cp-quick__meta">24h vet & poison</span>
        </button>
      </div>
    </div>
  );
}
