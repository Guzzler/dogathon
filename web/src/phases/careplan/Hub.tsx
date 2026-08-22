import type {
  DogProfile,
  ExperienceLevel,
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
  onToggleScheduled: (blockId: string, itemId: string) => void;
  pinnedTip: Tip;
  firedRules: TriggerRule[];
  tipsById: Record<string, Tip>;
  experience: ExperienceLevel;
  onOpen: (view: "timeline" | "journal" | "emergency") => void;
}

const KIND_LABEL: Record<ScheduleBlock["items"][number]["kind"], string> = {
  vaccine: "Vaccine",
  wellness: "Wellness",
  grooming: "Grooming",
  medication: "Med",
  training: "Training",
  checkup: "Check",
};

export function Hub({
  dog,
  dayInFoster,
  phase,
  blocks,
  onToggleScheduled,
  pinnedTip,
  firedRules,
  tipsById,
  experience,
  onOpen,
}: HubProps) {
  const showTipBody = experience === "beginner";
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

      <section className="cp-schedule">
        <div className="cp-schedule__head">
          <h3>Care plan timeline</h3>
          <p className="cp-mini-meta">Composed for {dog.name} — {dog.breed}, {dog.ageMonths} mo.</p>
        </div>

        <ol className="cp-schedule-list">
          {blocks.map((block) => {
            const passed = dayInFoster >= block.startDay;
            const current = phase.eyebrow.includes(block.label);
            return (
              <li
                key={block.id}
                className={`cp-schedule-block ${passed ? "cp-schedule-block--passed" : ""} ${current ? "cp-schedule-block--current" : ""}`}
              >
                <div className="cp-schedule-block__marker">
                  <span className="cp-schedule-block__dot" />
                  <span className="cp-schedule-block__label">{block.label}</span>
                </div>
                <ul className="cp-schedule-items">
                  {block.items.map((item) => (
                    <li key={item.id} className={`cp-schedule-item ${item.done ? "cp-schedule-item--done" : ""}`}>
                      <button
                        className="cp-check cp-check--sm"
                        aria-pressed={item.done}
                        onClick={() => onToggleScheduled(block.id, item.id)}
                      >
                        {item.done ? "✓" : ""}
                      </button>
                      <span className="cp-schedule-item__label">{item.label}</span>
                      <span className={`cp-schedule-item__chip cp-schedule-item__chip--${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                    </li>
                  ))}
                </ul>
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
        <button className="cp-quick" onClick={() => onOpen("timeline")}>
          <span className="cp-quick__label">Timeline</span>
          <span className="cp-quick__meta">Milestones & weight</span>
        </button>
        <button className="cp-quick" onClick={() => onOpen("journal")}>
          <span className="cp-quick__label">Journal</span>
          <span className="cp-quick__meta">Photos & notes</span>
        </button>
        <button className="cp-quick cp-quick--danger" onClick={() => onOpen("emergency")}>
          <span className="cp-quick__label">Emergency</span>
          <span className="cp-quick__meta">24h vet & poison</span>
        </button>
      </div>
    </div>
  );
}
