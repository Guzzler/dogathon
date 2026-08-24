# Design consistency

This doc exists because of a specific incident, not a hypothetical one.

## The precedent

PR #11 (2026-08-23, `eesha-color-scheme` → `main`) repainted the entire
palette — `theme.css`'s `:root` tokens, `brand.ts`'s `pawthwayTheme.palette`,
plus every place a color had been hardcoded as a literal instead of a
`var()` reference (`App.css`, `pawthway.css`, `carePlan.css`, one chip class
that "ignored the palette entirely") — from cream/coral to a charcoal-blue
/verdigris/tuscan-sun scheme, bundled into the same PR as an unrelated
feature (the demo-mode intro screen). The very next commit,
`90f2449 Revert color scheme changes`, undid all five files' worth of it and
kept only the intro screen. Nobody's fault — the author caught it herself —
but nothing in CI or the repo would have caught it if she hadn't, because
there is no automated signal that a PR touched the token files at all, let
alone changed what they resolve to. CI (PR #8) checks build/typecheck/lint/
tests; none of those know what a "correct" color is.

**The goal here is not zero visual changes.** It's that a repaint is a
decision someone made on purpose and can see in the diff, not a side effect
of one PR that also happened to be doing something else — and that a
contributor mid-feature gets told *before* merge, not after, that they've
touched the token surface.

## What's actually canonical right now

- **`web/src/theme.css`** `:root` — cream/coral/sage/butter palette,
  Fraunces + Nunito. Loads after `App.css`/`pawthway.css`, so its tokens
  win (`CLAUDE.md`, "Mobile shell and design system").
- **`web/src/brand.ts`** `pawthwayTheme` — the only theme object actually
  wired in (`Layout.tsx` calls `themeVars(pawthwayTheme)`). `brand.ts` also
  exports a second theme, `sidekickTheme` (leftover from the project's name
  before it was Pawthway) — **unused, and a trap**: it's the kind of thing
  a "let's try a new look" pass could get pointed at by mistake since it's
  sitting right next to the real one with a full matching shape.
- **The mobile-first phone frame.** `.shell > .phone` with a bottom tab
  bar (`Layout.tsx`), centered and capped at 430px on desktop. Screens that
  own their full height hide the tab bar (`FULL_BLEED` in `Layout.tsx`).
  Not a responsive-desktop-first layout that happens to look okay narrow —
  built narrow, and any new screen should be designed at phone width first.
- **The chat system** (`AgentChatPanel.tsx` + `theme.css`'s `.chat*`/`.msg*`
  /`.activity*`/`.approve*` rules) is the newest and most complete
  sub-system: instant-not-smooth auto-scroll with position-based pin
  detection, a hand-rolled markdown renderer instead of a library, typed
  error states with retry, per-surface activity verbosity. Any future
  chat-like or streaming UI should extend this pattern rather than invent
  a parallel one — it already solved the scroll-pinning and error-taxonomy
  problems once.
- **No dark mode anywhere.** Zero `prefers-color-scheme` references in any
  CSS file. Not an oversight to silently fix — just worth knowing before
  proposing token changes that assume one exists.

## Task queue

- **DC-1 (2026-08-24).** A CI guard against PR #11 recurring silently.
  Add a script (`scripts/check-design-tokens.py` or a short bash step
  inline in `.github/workflows/ci.yml`'s `frontend` job) that runs
  `git diff origin/main...HEAD -- 'web/src/**/*.css' 'web/src/**/*.ts' 'web/src/**/*.tsx'`
  and fails if any **added** line contains a hex color (`#[0-9a-fA-F]{3,8}`)
  or an `rgb(`/`rgba(` literal, in any file **other than**
  `web/src/theme.css` and `web/src/brand.ts`. Deliberately diff-only, not
  whole-file: `App.css`/`pawthway.css`/`carePlan.css` already contain
  legacy literals today (that's exactly what PR #11's revert diff shows),
  and a whole-file scan would fail on the first PR anyone opens. This
  catches new drift without demanding an immediate cleanup of old drift.
  Failure message should point at `theme.css`'s token list, not just say
  "color literal found." Verify: construct a throwaway diff that adds a
  hardcoded hex to `App.css` and confirm the check fails; confirm it passes
  on a PR that only edits `theme.css`.
- **DC-2 (2026-08-24).** Remove `sidekickTheme` from `brand.ts`, or if
  there's a reason to keep it (a rollback reference, a second-brand plan
  nobody's written down) turn it into a one-line comment explaining why an
  unused theme object is still there, so it stops looking like a
  live option. Trivial, but it's the exact shape of thing that causes a
  PR-#11-style mistake: two theme objects, one wired in, no marker saying
  which.
- **DC-3 (gated — needs one more real UI PR to test against).** Once DC-1
  is merged, deliberately exercise it: the next PR that touches any
  `.css`/`brand.ts` file should be watched to confirm the guard actually
  fires or actually stays quiet as appropriate, rather than trusting the
  throwaway-diff test from DC-1 alone. Not a queue item to build — a note
  for `plan` to check off once it's observed, then delete this line.

## What's parked

No new color palette, no new font pairing, no restructuring of
`.shell`/`.phone`/`.tabbar`, no dark mode — none of these are rejected
forever, they're just not queue items until someone (Sharang, in a review
of this doc, or a design pass explicitly commissioned as its own initiative)
decides one is worth doing on purpose. `plan` should not propose them from
its own judgment about what looks nicer.

## Ledger

<!-- - 2026-08-24 — DC-1 — PR #__ — outcome -->
