/**
 * Pawthway mark: a paw whose main pad is split by a winding path — the "pathway".
 * Drawn as SVG so it stays crisp at any size and picks up the theme colours.
 */
export function PawMark({ size = 100, color = "var(--coral)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      {/* toes */}
      <ellipse cx="40" cy="29" rx="9.2" ry="13.4" fill={color} transform="rotate(-7 40 29)" />
      <ellipse cx="61" cy="28" rx="9.2" ry="13.4" fill={color} transform="rotate(8 61 28)" />
      <ellipse cx="22.5" cy="44" rx="8.6" ry="12.4" fill={color} transform="rotate(-32 22.5 44)" />
      <ellipse cx="78.5" cy="43" rx="8.6" ry="12.4" fill={color} transform="rotate(32 78.5 43)" />

      {/* pad, with the path carved out of it */}
      <g>
        <mask id="pw-pad-mask">
          <rect width="100" height="100" fill="#000" />
          <path
            d="M50 50c12 0 20.5 7 24 16 3.5 9 0 19-10 21-6 1.2-11-.6-14-.6s-8 1.8-14 .6c-10-2-13.5-12-10-21C29.5 57 38 50 50 50Z"
            fill="#fff"
          />
          {/* the winding pathway, punched through the pad */}
          <path
            d="M61 43c-8 8-20 10-18.5 18.5C44 70 58 70.5 58 78.5 58 86 50.5 89.5 44 92"
            stroke="#000" strokeWidth="6.4" strokeLinecap="round" fill="none"
          />
        </mask>
        <rect width="100" height="100" fill={color} mask="url(#pw-pad-mask)" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 22, color = "var(--ink)" }: { size?: number; color?: string }) {
  return (
    <span style={{
      fontFamily: "var(--font)", fontWeight: 800, fontSize: size,
      letterSpacing: "-.02em", color, lineHeight: 1,
    }}>
      Pawthway
    </span>
  );
}

/** Mark stacked over the wordmark, for the landing screen. */
export function LogoLockup({ size = 120 }: { size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.1 }}>
      <PawMark size={size} />
      <Wordmark size={size * 0.29} />
    </div>
  );
}

/** Older name kept so existing imports keep working. */
export const PawLogo = PawMark;
