export function PawLogo({ size = 92 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="var(--coral-soft)" />
      <ellipse cx="35" cy="36" rx="8.5" ry="11" fill="var(--coral)" />
      <ellipse cx="65" cy="36" rx="8.5" ry="11" fill="var(--coral)" />
      <ellipse cx="21" cy="53" rx="7.5" ry="9.5" fill="var(--coral)" transform="rotate(-18 21 53)" />
      <ellipse cx="79" cy="53" rx="7.5" ry="9.5" fill="var(--coral)" transform="rotate(18 79 53)" />
      <path d="M50 52c11 0 19 8.4 19 17.2C69 77 62.4 81 50 81s-19-4-19-11.8C31 60.4 39 52 50 52Z" fill="var(--coral)" />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: size, letterSpacing: "-.02em" }}>
      Paw<span style={{ color: "var(--coral)" }}>thway</span>
    </span>
  );
}
