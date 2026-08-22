import { motion } from "motion/react";

/**
 * Side-profile pup that grows with the size slider.
 * `t` runs 0 (small) → 1 (large): the whole dog scales up from the ground, and
 * legs/snout/ears stretch a little so the proportions change too.
 *
 * Only the outer group is animated. motion writes SVG geometry attributes (rx, cy, d, …)
 * as undefined on first paint, so those stay plain attributes — the slider drags
 * continuously, so recomputing them per frame already looks smooth.
 */
export default function DogGrow({ t }: { t: number }) {
  const scale = 0.52 + t * 0.48;
  const leg = 26 + t * 14;      // taller dogs stand higher
  const snout = 12 + t * 6;     // longer muzzle
  const earDrop = 22 - t * 6;   // small dogs get floppier ears

  return (
    <svg viewBox="0 0 210 150" width="100%" height="150" aria-hidden style={{ overflow: "visible" }}>
      <ellipse cx="97" cy="136" rx={46 * scale + 10} ry={6 * scale + 1.5} fill="rgba(87,62,48,.10)" />

      <motion.g
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
        style={{ originX: "97px", originY: "134px" }}
      >
        <g transform="translate(97 134)">
          {/* tail */}
          <path d={`M-46,-62 q-16,-6 -13,-${20 + t * 8}`}
            stroke="var(--coral)" strokeWidth="9" strokeLinecap="round" fill="none" />

          {/* back legs */}
          <rect x="-46" y={-leg} width="15" height={leg} rx="7.5" fill="var(--coral-dk)" opacity=".55" />
          <rect x="12"  y={-leg} width="15" height={leg} rx="7.5" fill="var(--coral-dk)" opacity=".55" />

          {/* front legs */}
          <rect x="-32" y={-leg} width="16" height={leg} rx="8" fill="var(--coral)" />
          <rect x="26"  y={-leg} width="16" height={leg} rx="8" fill="var(--coral)" />

          {/* body */}
          <ellipse cx="0" cy={-leg - 20} rx="46" ry="27" fill="var(--coral)" />

          {/* head */}
          <g transform={`translate(0 ${-leg - 46})`}>
            <circle cx="52" cy="-8" r="25" fill="var(--coral)" />
            <ellipse cx="34" cy="-8" rx="9.5" ry={earDrop} fill="var(--coral-dk)" transform="rotate(-14 34 -8)" />
            <ellipse cx={52 + snout * 0.9} cy="2" rx={snout + 3} ry="11" fill="#FFD9CB" />
            <circle cx={52 + snout * 1.6} cy="-2" r="5" fill="var(--ink)" />
            <circle cx="55" cy="-14" r="3.4" fill="var(--ink)" />
            <circle cx="56.2" cy="-15.2" r="1.2" fill="#fff" />
            <rect x="30" y="10" width="16" height="7" rx="3.5" fill="var(--sage)" />
          </g>
        </g>
      </motion.g>
    </svg>
  );
}
