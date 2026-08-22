import type { Milestone } from "./types";

interface TimelineProps {
  milestones: Milestone[];
  dayInFoster: number;
  dogName: string;
}

const KIND_LABEL: Record<Milestone["kind"], string> = {
  vet: "Vet",
  vaccine: "Vaccine",
  weigh: "Weigh-in",
  training: "Training",
  behavior: "Behavior",
};

export function WeightChart({ points }: { points: { day: number; lbs: number }[] }) {
  if (points.length < 2) return null;
  const width = 280;
  const height = 60;
  const pad = 6;
  const days = points.map((p) => p.day);
  const lbs = points.map((p) => p.lbs);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const minLbs = Math.min(...lbs) - 1;
  const maxLbs = Math.max(...lbs) + 1;
  const xFor = (d: number) =>
    pad + ((d - minDay) / Math.max(1, maxDay - minDay)) * (width - pad * 2);
  const yFor = (l: number) =>
    height - pad - ((l - minLbs) / Math.max(0.1, maxLbs - minLbs)) * (height - pad * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.day).toFixed(1)} ${yFor(p.lbs).toFixed(1)}`)
    .join(" ");

  return (
    <div className="cp-weight-chart">
      <p className="cp-eyebrow">Weight trend</p>
      <svg width={width} height={height} role="img" aria-label="Weight chart">
        <path d={path} className="cp-weight-line" />
        {points.map((p) => (
          <circle key={p.day} cx={xFor(p.day)} cy={yFor(p.lbs)} r={3} className="cp-weight-dot" />
        ))}
      </svg>
      <p className="cp-mini-meta">
        {points[0].lbs} lbs → {points[points.length - 1].lbs} lbs over {maxDay - minDay} days
      </p>
    </div>
  );
}

export function Timeline({ milestones, dayInFoster, dogName }: TimelineProps) {
  const sorted = [...milestones].sort((a, b) => b.dayInFoster - a.dayInFoster);
  // Only weigh-ins that have happened as of today are on the chart.
  const weightPoints = milestones
    .filter((m) => m.weightLbs != null && m.dayInFoster <= dayInFoster)
    .map((m) => ({ day: m.dayInFoster, lbs: m.weightLbs! }))
    .sort((a, b) => a.day - b.day);

  const pastCount = milestones.filter((m) => m.dayInFoster <= dayInFoster).length;
  const upcomingCount = milestones.length - pastCount;

  return (
    <div className="cp-timeline">
      <header className="cp-view-header">
        <h2>Timeline</h2>
        <p className="cp-mini-meta">
          Day {dayInFoster} of {dogName}'s foster · {pastCount} logged · {upcomingCount} upcoming.
        </p>
      </header>

      {weightPoints.length >= 2 && <WeightChart points={weightPoints} />}

      <ol className="cp-timeline-list">
        {sorted.map((m) => {
          const upcoming = m.dayInFoster > dayInFoster;
          return (
            <li
              key={m.id}
              className={`cp-milestone cp-milestone--${m.kind} ${upcoming ? "cp-milestone--upcoming" : ""}`}
            >
              <div className="cp-milestone__dot" />
              <div className="cp-milestone__body">
                <div className="cp-milestone__row">
                  <p className="cp-milestone__title">{m.title}</p>
                  <span className="cp-kind-chip">
                    {KIND_LABEL[m.kind]}{upcoming ? " · upcoming" : ""}
                  </span>
                </div>
                <p className="cp-mini-meta">
                  Day {m.dayInFoster}
                  {upcoming ? ` · in ${m.dayInFoster - dayInFoster} day${m.dayInFoster - dayInFoster === 1 ? "" : "s"}` : ""}
                </p>
                {m.note && !upcoming && <p className="cp-milestone__note">{m.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
