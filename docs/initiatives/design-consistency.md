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

- **DC-2 (2026-08-24, re-verified open 2026-08-25).** Remove `sidekickTheme` from `brand.ts`, or if
  there's a reason to keep it (a rollback reference, a second-brand plan
  nobody's written down) turn it into a one-line comment explaining why an
  unused theme object is still there, so it stops looking like a
  live option. Trivial, but it's the exact shape of thing that causes a
  PR-#11-style mistake: two theme objects, one wired in, no marker saying
  which.
- **DC-3 (gated — still not observable as of 2026-08-26).** Once DC-1
  is merged, deliberately exercise it: the next PR that touches any
  `.css`/`brand.ts` file should be watched to confirm the guard actually
  fires or actually stays quiet as appropriate, rather than trusting the
  throwaway-diff test from DC-1 alone. Not a queue item to build — a note
  for `plan` to check off once it's observed, then delete this line.
  **Checked 2026-08-26: no qualifying PR yet.** DC-1 (PR #25) touched only
  `.github/workflows/ci.yml`, so its own run exercised nothing, and PR #24 —
  the one PR that did touch `web/src/**` — merged at 05:10Z, seven minutes
  *before* the guard landed at 05:17Z. The next `web/src` PR is the first
  real test. Two specific things to watch for when it comes, both unverified
  rather than known-broken: (1) the step does
  `git fetch origin main --depth=1` and then `git diff origin/main...HEAD`,
  and a triple-dot diff needs a common ancestor — on a shallow fetch that
  merge base may not exist, which would make the guard error or silently
  diff nothing; (2) confirm a PR that legitimately edits `theme.css` alone
  still passes. If (1) bites, deepening the fetch is the fix, not switching
  to a two-dot diff.
- **DC-4 (2026-08-26).** Close the gap DC-1 left open: **a wholesale repaint
  of the canonical files still passes CI silently.** The guard excludes
  `web/src/theme.css` and `web/src/brand.ts` — correctly, since that's where
  color literals are supposed to live — but the consequence is that PR #11,
  the exact incident this whole doc exists for, would sail through the guard
  today. #11's damage was spread across five files, so the stray-literal
  check would have caught *part* of it; the `:root` token rewrite and the
  `pawthwayTheme.palette` rewrite, which were the actual repaint, would not
  have been flagged at all. Fix the reporting half, not the failing half:
  when a PR's diff touches either exempt file, emit a **non-failing**
  notice — a `::warning::` plus a short block appended to
  `$GITHUB_STEP_SUMMARY` naming the files and showing the changed token
  lines. It must not `exit 1`: editing the palette on purpose is allowed and
  this doc's stated goal is that a repaint be *visible in review*, not
  blocked. Implement it as a second step in `ci.yml`'s `frontend` job next
  to "Design token guard", reusing the same `origin/main...HEAD` diff (and
  inheriting whatever DC-3 concludes about the shallow-fetch merge base — if
  DC-3 lands first and deepens the fetch, don't duplicate that work).
  Verify on two throwaway commits the way DC-1 was verified: a `theme.css`
  `:root` edit produces the warning and a **green** job; a PR touching
  neither exempt file produces no warning at all.

## What's parked

No new color palette, no new font pairing, no restructuring of
`.shell`/`.phone`/`.tabbar`, no dark mode — none of these are rejected
forever, they're just not queue items until someone (Sharang, in a review
of this doc, or a design pass explicitly commissioned as its own initiative)
decides one is worth doing on purpose. `plan` should not propose them from
its own judgment about what looks nicer.

## Ledger

- 2026-08-25 — DC-1 — PR #25 — added a "Design token guard" step to
  `.github/workflows/ci.yml`'s `frontend` job: fetches `origin/main`, diffs
  it against HEAD over `web/src/**/*.css|*.ts|*.tsx` excluding `theme.css`
  and `brand.ts` (git pathspec `:(glob)`/`:(exclude)` magic — a bare
  `**` glob without `:(glob)` silently matches nothing under this git
  version), and fails if an added line matches a hex color or
  `rgb(`/`rgba(`. Went with the inline-bash option over a separate Python
  script, per the task's own "either" framing. Verified locally on two
  throwaway commits (not yet observed on a real GitHub Actions run): a
  hardcoded hex added to `App.css` fails the check; a `theme.css`-only
  edit passes. DC-3 is the note to watch the first real PR that exercises
  this for real.
