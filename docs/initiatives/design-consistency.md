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
- **The mobile-first phone frame — still what's built, no longer the
  destination.** `.shell > .phone` with a bottom tab bar (`Layout.tsx`),
  centered and hard-capped at `max-width:430px`, becoming a rounded floating
  phone over a gradient at `min-width:640px`. Screens that own their full
  height hide the tab bar (`FULL_BLEED` in `Layout.tsx`). It was built narrow
  on purpose and the composition is good — but see the decision directly
  below: it is no longer true that every new screen should be designed at
  phone width first.
- **Both sides are device-agnostic (Sharang, 2026-08-26).** Pawthway should be
  a genuinely good phone app *and* a genuinely good web app, on both sides of
  the product. This unparks the `.shell`/`.phone` restructure that the "what's
  parked" section below had reserved for exactly this decision. Two
  consequences, deliberately split so neither blocks the other:
  - The **shelter side** is built responsive from the start and does not live
    inside the phone frame at all — it's desk-shaped work. Specified in
    `real-data-and-shelters.md`'s RS-2/RS-5/RS-6.
  - The **foster side** stays as-is until DC-5 below. Letting it breathe on a
    wide screen means the narrow composition earns more room, not that it
    gets redesigned desktop-first — the phone layout is the one that works
    today and the one most fosters will use.
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

- **DC-2 — do this as a RIDER, not as a run (2026-08-24; re-verified open a
  *fourth* time on 2026-08-31 — `grep -rn sidekickTheme web/src/` still returns
  exactly one line, `brand.ts:24`, its own `export`).** Confirming this a fifth
  time would be the treadmill the README's re-rank exists to stop. It is the
  oldest open item across all three docs and a one-line change, and the reason it
  never ships is structural: execute works queues top-down and takes whole runs,
  so a one-line item either eats a run it doesn't deserve or loses forever. So the
  instruction changes rather than the item: **fold DC-2 into the first PR that
  touches `web/src/brand.ts` or any DC item**, in the same commit, with its own
  ledger row. Do not open a PR for it alone. Remove `sidekickTheme` from `brand.ts`, or if
  there's a reason to keep it (a rollback reference, a second-brand plan
  nobody's written down) turn it into a one-line comment explaining why an
  unused theme object is still there, so it stops looking like a
  live option. Trivial, but it's the exact shape of thing that causes a
  PR-#11-style mistake: two theme objects, one wired in, no marker saying
  which.
- **DC-3 — CLOSED 2026-08-28. The guard is inert, and worry (1) is what did
  it.** Not a queue item any more; the fix is DC-6 below. The observation
  DC-3 was waiting for arrived on 2026-08-27, when PRs #27, #28 and #29 all
  touched non-exempt files under `web/src/**` (`auth.ts`,
  `components/AccountSheet.tsx`). Read back from the actual run logs
  (`gh run view <id> --log`), **every CI run since DC-1 landed** — 33040837634
  (#27), 33041013850 (#28), 33041226312 (#29), 33041904930 (#30) — prints:

  ```
  frontend  fatal: origin/main...HEAD: no merge base
  ```

  …and the `frontend` job reports **success** anyway. So the guard has never
  once evaluated a diff. Two causes, and both need fixing:
  1. **No merge base.** `actions/checkout@v4` defaults to `fetch-depth: 1`,
     and the guard's own `git fetch origin main --depth=1` is equally
     shallow — neither side has any history, so the triple-dot diff has no
     common ancestor to compute. Exactly the failure mode DC-3 flagged as
     unverified. Deepening is the fix, as DC-3 predicted; switching to a
     two-dot diff is still not.
  2. **It fails open, silently.** The `|| true` in the guard is attached to
     the *whole* pipeline, not just the trailing `grep`, so `git diff`'s
     non-zero exit is swallowed, `hits` comes back empty, and the step exits
     0 regardless. This is the more dangerous half: even after (1) is fixed,
     any future git failure would go on reporting a clean palette. `set -euo
     pipefail` doesn't help — the `|| true` is precisely what neutralises it.

  The still-unverified half of DC-3 (that a PR editing `theme.css` alone
  passes) is untestable until the guard runs at all, so it moves into DC-6's
  verification.
- **DC-6 — shipped 2026-08-28.** See Ledger for the full account.
- **DC-4 (2026-08-26; no longer gated — DC-6 shipped 2026-08-28).** Close
  the gap DC-1 left open: **a wholesale repaint
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
  **Ungated 2026-08-28:** this item says to reuse "the same
  `origin/main...HEAD` diff" — DC-6 shipped the fix that makes that diff
  actually resolve (fetch-depth 0, verified from a real Actions run per its
  ledger row), so this is now buildable against a working diff.
- **DC-5 `[large]` (2026-08-26; marked large 2026-08-31) — let the foster side
  breathe on a wide screen. A complete execute run.** It touches CSS across several
  files and three breakpoints, which is exactly the shape that kept losing to
  single-file items under the old ordering. The
  direct consequence of the device-agnostic decision recorded above. Today
  `.phone` is `max-width:430px` at every viewport, so a 1440px browser shows
  a 430px column on a gradient. Make the foster journey responsive **without
  redesigning it phone-second**: the narrow composition is the one that
  works and the one most fosters will use, so this is about the frame and
  the screens that visibly suffer from the cap, not a rebuild.
  - Scope the frame first: `.shell`/`.phone` in `theme.css`, and the
    `min-width:640px` block that currently makes it a floating phone.
    Keep the phone presentation as the small/medium case.
  - Then only the screens where the cap actually costs something — the
    discovery grid and `SavedView` are the obvious two (a list of dog cards
    in a 430px column on a 27" monitor). `MatchChatView` should be checked
    but is probably fine narrow; a chat column that stretches to 1400px is
    worse, not better.
  - The bottom `.tabbar` is a phone pattern. Decide deliberately whether it
    becomes a side rail above some breakpoint or simply stays — either is
    defensible, but say which in the ledger row and do it once, not
    per-screen.
  - This will touch CSS across several files. It used to be described here as
    the "real test of DC-1's guard" — **it isn't, and must not be treated as
    one** (updated 2026-08-28): the guard doesn't run at all until DC-6 lands,
    so a green CI on this item proves nothing about color literals. Use
    tokens because it's the rule, not because CI will catch you.
  - Verify at 390px, 768px, 1440px: no horizontal scroll, no orphaned
    controls, the tab bar (or its replacement) reachable at all three, and
    `npm run build`/`test`/`lint` green.

## What's parked

No new color palette, no new font pairing, no dark mode — none of these are
rejected forever, they're just not queue items until someone (Sharang, in a
review of this doc, or a design pass explicitly commissioned as its own
initiative) decides one is worth doing on purpose. `plan` should not propose
them from its own judgment about what looks nicer.

**No longer parked:** restructuring `.shell`/`.phone`/`.tabbar`. Sharang made
that call on 2026-08-26 — see the device-agnostic decision above; DC-5 is the
queued work.

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
- 2026-08-28 — DC-6 — PR #32 — `actions/checkout@v4` in the `frontend` job
  now takes `fetch-depth: 0` instead of the default depth-1, so the guard's
  `git diff origin/main...HEAD` has a merge base to compute against; the
  standalone "Fetch main for the design-token diff" step is now a plain
  `git fetch origin main` (kept, not removed, since the guard still needs
  `origin/main` as a ref even with full history checked out). The guard's
  diff is now computed into its own `diff=$(...)` statement so `set -e`
  catches a real git failure; `|| true` moved to sit only on the final
  `grep`, which is expected to exit 1 on a clean diff. Verified from real
  Actions runs, not a local throwaway (that's what missed the original
  bug): pushed a commit adding a hardcoded hex to `web/src/App.css` on this
  same branch and confirmed the `frontend` job **failed** with the guard's
  `::error::` message (run 33223963302); then reverted it and confirmed the
  job **passed** with no `fatal: ... no merge base` line in the log (run
  33224005057).
