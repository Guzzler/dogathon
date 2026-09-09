/* The weight sparkline the Care Plan hub draws. DC-10 removed this file's second
   export, `Timeline` — nothing imported it, and the milestone-list classes it was
   the only renderer of went with it. Kept under this name because `Hub.tsx`
   imports `WeightChart` from here. */
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
