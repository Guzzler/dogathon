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

const SCHED_KIND_LABEL: Record<ScheduleBlock["items"][number]["kind"], string> = {
  vaccine: "Vaccine",
  wellness: "Wellness",
  grooming: "Grooming",
  medication: "Med",
  training: "Training",
  checkup: "Check",
};

const MILE_KIND_LABEL: Record<Milestone["kind"], string> = {
  vet: "Vet",
  vaccine: "Vaccine",
  weigh: "Weigh-in",
  training: "Training",
  behavior: "Behavior",
};

function chipKind(k: Milestone["kind"]): ScheduleBlock["items"][number]["kind"] {
  if (k === "vaccine") return "vaccine";
  if (k === "training") return "training";
  if (k === "weigh") return "checkup";
  if (k === "vet") return "checkup";
  return "wellness";
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

  const sortedBlocks = [...blocks].sort((a, b) => a.startDay - b.startDay);
  const bucketed = sortedBlocks.map((block, i) => {
    const nextStart = sortedBlocks[i + 1]?.startDay ?? Infinity;
    const ms = milestones
      .filter((m) => m.dayInFoster >= block.startDay && m.dayInFoster < nextStart)
      .sort((a, b) => a.dayInFoster - b.dayInFoster);
    return { block, nextStart, milestones: ms };
  });

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

        <ol className="cp-plan__weeks">
          {bucketed.map(({ block, nextStart, milestones: blockMilestones }) => {
            const passed = dayInFoster >= block.startDay;
            const current = dayInFoster >= block.startDay && dayInFoster < nextStart;
            const dayRange = Number.isFinite(nextStart)
              ? `Day ${block.startDay}–${nextStart - 1}`
              : `Day ${block.startDay}+`;

            return (
              <li
                key={block.id}
                className={`cp-week ${passed ? "cp-week--passed" : ""} ${current ? "cp-week--current" : ""}`}
              >
                <div className="cp-week__head">
                  <span className="cp-week__dot" />
                  <div className="cp-week__label">
                    <span className="cp-week__name">{block.label}</span>
                    <span className="cp-mini-meta">{dayRange}{current ? " · you are here" : ""}</span>
                  </div>
                </div>

                {block.items.length > 0 && (
                  <div className="cp-plan-chips" aria-label="Scheduled care for this week">
                    {block.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cp-plan-chip cp-plan-chip--${item.kind} ${item.done ? "cp-plan-chip--done" : ""}`}
                        onClick={() => onToggleScheduled(block.id, item.id)}
                        aria-pressed={item.done}
                      >
                        <span className="cp-plan-chip__box">{item.done ? "✓" : ""}</span>
                        <span className="cp-plan-chip__label">{item.label}</span>
                        <span className="cp-plan-chip__kind">{SCHED_KIND_LABEL[item.kind]}</span>
                      </button>
                    ))}
                  </div>
                )}

                {blockMilestones.length > 0 && (
                  <ol className="cp-events">
                    {blockMilestones.map((m) => {
                      const upcoming = m.dayInFoster > dayInFoster;
                      return (
                        <li
                          key={m.id}
                          className={`cp-event cp-event--${m.kind} ${upcoming ? "cp-event--upcoming" : ""}`}
                        >
                          <span className="cp-event__day">Day {m.dayInFoster}</span>
                          <div className="cp-event__body">
                            <div className="cp-event__row">
                              <p className="cp-event__title">{m.title}</p>
                              <span className={`cp-plan-chip__kind cp-plan-chip__kind--${chipKind(m.kind)}`}>
                                {MILE_KIND_LABEL[m.kind]}
                              </span>
                            </div>
                            {m.note && !upcoming && <p className="cp-event__note">{m.note}</p>}
                            {upcoming && (
                              <p className="cp-event__note">
                                in {m.dayInFoster - dayInFoster} day{m.dayInFoster - dayInFoster === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
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
