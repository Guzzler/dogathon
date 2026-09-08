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
- **The frame is a token, not a constant — since DC-5 (2026-09-05, PR #65).**
  `.shell > .phone` with a bottom tab bar (`Layout.tsx`) still centres the
  journey and still becomes a rounded floating phone over a gradient at
  `min-width:640px`, but its width now comes from `:root`'s `--frame-w` /
  `--content-w` / `--gutter` (`theme.css:24-26`), which step to 760/560 at
  1024px and 960/620 at 1440px (`theme.css:874-891`). **Change a width there,
  not in a rule.** The reading column is centred by
  `padding-inline: max(var(--gutter), calc((100% - var(--content-w)) / 2))`, so
  no screen's markup knows it is on a wide viewport. Screens that own their full
  height hide the tab bar (`FULL_BLEED` in `Layout.tsx`). The phone composition
  is still the one that works and the one most fosters will use; it is no longer
  the only one.
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
- **Three authored stylesheets, not two — corrected 2026-09-07.** This bullet said "two"
  from the day DC-7 shipped until it was measured again, and it was wrong on the day it was
  written. `App.tsx` imports `pawthway.css` (544) then `theme.css` (922) and `main.tsx`
  imports `index.css` (29) — but **`web/src/phases/careplan/carePlan.css` is 1850 lines**,
  larger than the other three combined, and is imported from `CarePlanView.tsx:30`. DC-7's
  measurement enumerated *`App.tsx`'s import lines* rather than the import *graph*, so the
  biggest stylesheet in the repo was never in the sample. The load-order half of the bullet is
  still exactly right: the `.btn` base layer sits at the top of `pawthway.css` precisely so
  `theme.css`'s `.screen .btn` / `.phone-body .btn--ghost` / `.sharesheet .btn` /
  `.shelter .btn` can override it at equal-or-higher specificity — putting a bare `.btn` in
  `theme.css` instead is the collision PR #60 paid for. Both files carry a header comment
  saying so, and CI prints a **non-failing** notice when a PR changes the import lines in
  `App.tsx` — **and only in `App.tsx`**, which is the second half of the same blind spot: the
  notice greps one file's diff, so it cannot see a fourth stylesheet arriving the way the
  third one already did.
- **No dark mode anywhere.** Zero `prefers-color-scheme` references in any
  CSS file. Not an oversight to silently fix — just worth knowing before
  proposing token changes that assume one exists.

## Settled — `App.css` is gone (2026-09-06, PR #67); compressed 2026-09-07

DC-7 deleted `web/src/App.css` (627 lines), `components/Sidebar.tsx` and
`components/Checklist.tsx`, moved the `.btn` base layer to the top of `pawthway.css`, and gave
both remaining root stylesheets a header comment naming what depends on the load order. The
measurement that justified it — three live classes out of 627 lines, a dead desktop agent UI
nothing imported, and `.chat`/`.chat__scroll` defined twice at identical specificity resolving
a live screen by import order — is preserved verbatim in
[`archive/design-consistency-dc7-2026-09-07.md`](archive/design-consistency-dc7-2026-09-07.md),
and the Ledger row below is the account of what shipped. **One line of that snapshot is wrong
and is corrected above:** it closes by calling the app "two stylesheets", which it was not,
because the measurement never looked past `App.tsx`.

## Settled — a phase may keep its own stylesheet; what it may not keep is its own geometry (2026-09-07)

The design question this run opened, given the correction above: **`carePlan.css` is a
phase-scoped stylesheet loaded from a component. Should it be folded into `theme.css` the way
`App.css` was folded into `pawthway.css`?**

**No — and the measurement says so unusually clearly.** All 204 classes it defines are
`cp-`-prefixed, and it collides with nothing: the only class selectors defined in more than one
stylesheet anywhere in the repo are `.btn`, `.btn--ghost`, `.btn--primary` (the documented base
layer) and `.pw-page` / `.pw-textarea` (`pawthway.css` ↔ `theme.css`, undocumented but
intra-root). `carePlan.css` contributes **zero** cross-file collisions, and it references
thirteen tokens, all of which resolve. It is the best-namespaced file in the codebase. Folding
1850 lines of one phase into the global sheet would trade that for nothing, and DC-7's own
lesson was that the hazard is *shared names*, not *separate files*.

What it does not do is share the app's geometry, and that is the real finding:

- **Its breakpoints belong to no frame.** `carePlan.css` steps at `min-width:900px`,
  `min-width:720px` and `max-width:520px`. `theme.css` steps the frame at 640 / 1024 / 1440
  (`--frame-w` 430 → 760 → 960 since DC-5). A media query evaluates against the **viewport**,
  not the frame, so at viewport 720–1023px `.cp-hub__row` goes two-up **inside a 430px frame**
  — two ~200px columns — and `.cp-schedule-block` does the same. This is live today on the
  foster's main Care Plan screen at ordinary tablet and small-laptop widths.
- **It uses none of DC-5's frame tokens** — zero references to `--frame-w`, `--content-w` or
  `--gutter`. Care Plan renders `.cp-stage`, not `.pw-page`, so `theme.css:908`'s
  `.phone-body .pw-page{max-width:var(--content-w)}` — the wide-screen reading column DC-5
  exists to provide — **does not apply to Care Plan at all**. It is the one foster surface DC-5
  did not reach.
- **It is on a second token vocabulary.** Its colors come from the `--color-*` set that
  `Layout.tsx` injects at runtime via `themeVars(pawthwayTheme)` (`brand.ts`, 10 keys), while
  the rest of the app reads `theme.css`'s `:root` names (`--ink`, `--line`, `--shadow`, `--r-sm`).
  Both are real and both resolve; nothing is broken. Recorded because a future repaint has to
  know there are two places a color can come from, which is the PR #11 hazard in slow motion.
- **It carries ~115 hardcoded color literals** (42 hex, 73 `rgba(`) against 218 `var()` uses,
  including four near-identical creams (`#fffdf6`, `#fffdf7`, `#fffdf8`, `#fffaf8`) and a
  purple (`#5a3fa0`, `#7f5fbf`) that appears nowhere in the cream/coral/sage/butter palette.
  These **predate DC-1's guard**, which only flags *added* lines, so CI has been correct and
  silent throughout. Not a repaint to schedule — a number to know before anyone proposes one.

**The decision: keep the file, give it the frame.** DC-8 below builds that. Retokenising the
115 literals is explicitly *not* part of it — that is a repaint by volume even if every value
is preserved, and it belongs in the parked list until someone commissions it.

## Task queue

- **DC-8 `[large]` (2026-09-07) — Care Plan joins the frame.** The `[large]` slot, found by
  measuring for a second consecutive run (see the settled section above and the README's
  2026-09-06 note). Care Plan is the one foster surface DC-5 did not reach, and it is
  currently laying out against a viewport it does not occupy. Scope is **geometry only** —
  do not retokenise colors, do not repaint, do not merge `carePlan.css` into `theme.css`.
  1. **Stop the frame-less breakpoints.** `web/src/phases/careplan/carePlan.css` has
     `@media (min-width:900px)` ×6 (lines 22, 77, 131, 169, 207, 267),
     `@media (min-width:720px)` ×2 (281, 492) and `@media (max-width:520px)` (1621). The two
     720px ones are the live defect: `.cp-hub__row` and `.cp-schedule-block` go two-up from
     viewport 720px, while the frame is still `--frame-w:430px` until viewport 1024px. Move
     every Care Plan breakpoint onto the frame's own steps — **1024px and 1440px**, matching
     `theme.css:892,895` — or, better where the rule is about the *container* rather than the
     screen, express it without a media query at all (`grid-template-columns:
     repeat(auto-fit,minmax(240px,1fr))` is container-driven and needs no breakpoint). Say in
     the ledger row which rules got which treatment and why.
  2. **Cap the reading column.** `CarePlanView` renders `.cp-stage`, so it misses
     `theme.css:908`'s `.phone-body .pw-page{max-width:var(--content-w);margin-inline:auto}`.
     Give `.cp-stage` the same cap from the same token — do not hardcode 560/620, and do not
     add `.pw-page` to the markup (that would drag `theme.css`'s padding onto a screen that
     already has its own).
  3. **The 900px grid.** `.cp-stage:not(.cp-stage--solo):not(.cp-stage--empty)` becomes a
     two-column grid at 900px with a `minmax(240px,320px)` sidebar — inside a 430px frame at
     that width. Its comment says it is for the demo panel. Decide and record: either it is
     dead in the shipped app (in which case delete it and say how you confirmed
     `SHOW_DEMO_CONTROLS`) or it is live (in which case it moves to 1024px with the rest).
  4. **Eight dead `cp-` classNames**, measured this run against all four stylesheets:
     `cp-earlier--open`, `cp-feed-item__tag--ask`, `cp-journal`, `cp-timeline`, `cp-tip-group`,
     `cp-tips` (plus non-`cp-` `ask` in `JournalTips.tsx`). **Check each is not composed from a
     template string before deleting** — DC-7's ledger row records that `app` and `badge`
     looked live and were JS identifiers, and the inverse mistake is equally available here.
     Delete the className, not the element.
  - **Verify the way DC-5 verified**, since eyeballing is what missed this for a month: build,
    then read computed boxes for `.cp-stage`, `.cp-hub__row` and `.cp-schedule-block` at
    **390 / 768 / 1024 / 1440**. The claim to prove is that **nothing changes at 390**, that
    768 no longer produces two columns inside a 430px frame, and that 1024/1440 cap at
    `--content-w`. `npm run build && npm test && npm run lint` green with no new warnings.

- **DC-9 (2026-09-07) — the stylesheet notice should watch the import graph, not one file.**
  A rider on DC-8, not its own run. `ci.yml`'s "Stylesheet order notice" (lines 89–108) diffs
  `web/src/App.tsx` alone, so it is blind to exactly how `carePlan.css` entered the app — a
  `.css` import from a component. Widen the diff pathspec to `':(glob)web/src/**/*.tsx'` and
  match any added or removed line importing a local `.css` file, keeping the existing
  `App.tsx`-reorder wording as one branch and adding a second: *a stylesheet import was
  added or removed outside `App.tsx`*. It must stay **non-failing** — phase-scoped stylesheets
  are allowed, and this doc's own conclusion above is that `carePlan.css` should stay. The
  point is that the next one is visible in review rather than found by measurement a month
  later. Verify on a throwaway commit adding an import to any phase component: warning
  present, job **green**.

- **DC-7 `[large]` — shipped 2026-09-06 (PR #67); the Ledger row is the full account.**
  `App.css` is gone, the `.btn` base layer lives at the top of `pawthway.css`, and the two
  header comments plus a non-failing CI notice say what the load order is doing. The spec was
  right about all three of its measured claims and wrong about nothing; what it did not
  anticipate is in the ledger row.

- **DC-2 — shipped 2026-09-05 (PR #65), as a rider on DC-5 exactly as this entry
  instructed.** `sidekickTheme` is gone from `web/src/brand.ts`, replaced by a four-line
  comment saying there is one theme and naming the trap, so the file still records why an
  unused theme object was ever there. The rider convention worked on its first use: a
  one-line item that had lost five runs in a row shipped without costing one.

- **DC-3 — CLOSED 2026-08-28; compressed 2026-09-07.** The design-token guard had never
  once evaluated a diff: `actions/checkout@v4`'s depth-1 checkout left `origin/main...HEAD`
  with no merge base, and a `|| true` on the whole pipeline made it fail open and report
  success anyway. DC-6 fixed both and verified it from real Actions runs (see Ledger). Full
  diagnosis in [`archive/design-consistency-dc3-2026-09-07.md`](archive/design-consistency-dc3-2026-09-07.md).
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
- **DC-5 `[large]` — shipped 2026-09-05 (PR #65); the Ledger row is the full account.**
  The frame widens, the tab bar stays a bottom bar and caps its inner row, and the two
  screens that suffered from the cap use the room. The spec's own scope note was wrong
  about one thing and the ledger row says how.
  *(The "there is now no `[large]` item anywhere" note that sat here is spent: DC-7 refilled
  the slot on 2026-09-06 and DC-8 refilled it again on 2026-09-07, both from this doc.)*

## What's parked

No new color palette, no new font pairing, no dark mode — none of these are
rejected forever, they're just not queue items until someone (Sharang, in a
review of this doc, or a design pass explicitly commissioned as its own
initiative) decides one is worth doing on purpose. `plan` should not propose
them from its own judgment about what looks nicer.

**Added 2026-09-07: retokenising `carePlan.css`'s ~115 color literals is parked too.** The
number is measured and recorded in the settled section above (42 hex, 73 `rgba(`, against 218
`var()` uses, including four near-identical creams and a purple outside the palette), and DC-8
is explicitly scoped to exclude it. Replacing 115 literals is a repaint by volume even when
every resolved value is preserved byte-for-byte — DC-7 needed three new tokens to move *six*
rules and recorded them as a finding rather than a chore. It stops being parked when someone
commissions a palette pass on purpose, which is the same bar as the paragraph above.

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

- 2026-09-04 — DC (shelter side, unqueued — reported by Sharang while reviewing the demo) —
  PR #60 — **The shelter surfaces now read as the same product as the foster journey.** The
  root cause was the collision this doc exists for: `ShelterLayout` renders inside `.screen`,
  so `.screen .btn` — the phone's `width:100%`, 100px-radius, thumb-sized primary action —
  landed on every shelter button. That was not cosmetic. At `width:100%` a Retire button's
  flex basis becomes the entire row, which starved `.shelter__dog-main` to **0px**, so each
  dog's breed and age rendered *underneath* the button and names wrapped mid-word. Measured on
  the deployed page before the fix: Retire 806px, meta column 0px; after: 71px and 275px.
  Beyond the bug, a pass to close the gap with the foster app: a real sticky header (paw +
  wordmark + a `SHELTER` role marker, mirroring `.topbar`) instead of two links floating on
  bare ground; native OS checkboxes replaced with the phone's own rounded sage tick; detail
  section headings demoted from `h3`-weight titles to coral eyebrows; the app's soft `--shadow`
  on cards; the 19-dog roster two-up above 760px with name / breed·age / status on two tight
  lines instead of three; and status actions given hierarchy, since three identical outline
  buttons made *decline* look as routine as *mark in review*.
  **Two traps worth recording.** `.shelter .btn` and `.screen .btn` have equal specificity, so
  the shelter rules only win by sitting *below* them in `theme.css` — don't reorder that file.
  And `align-self:center` on the shared button rule reads fine in a row and silently centres
  "Add a dog" mid-page in a column; it was caught in preview and removed.
  Verified by injecting the exact rules over the live deployed page and measuring, not by eye.

- 2026-09-05 — DC-5 (with DC-2 as its rider) — PR #65 — **The foster journey stops being a
  430px column on a 27" monitor.** Three new `:root` tokens — `--frame-w`, `--content-w`,
  `--gutter` — carry the widths that were hardcoded, so `.phone` and `.sharesheet` both move
  from one place; at `min-width:1024px` the frame goes to 760/560 and at 1440px to 960/620.
  The reading column is centred with **padding, not a wrapper**: `.topbar`, `.pad` and `.tabs`
  take `padding-inline: max(var(--gutter), calc((100% - var(--content-w)) / 2))`, which
  resolves to exactly the old 24px at phone width, so one rule serves both cases and no
  screen's markup learns it is on a wide viewport. `.pw-page` (Hub, Post Foster, the older
  phase views) just stops stretching. `SavedView`'s list is now a `.cardgrid` that goes two-up;
  `SwipeDeck`'s stack caps at 440px and centres, because a swipe card that fills 960px is a
  worse swipe card, while the map behind the same toggle deliberately takes the whole widened
  frame. The tab bar keeps its decided shape — a new `.tabbar__row` wrapper caps and centres so
  five thumb-sized cells don't stretch across 1400px.
  **Three things the spec did not know.**
  (1) There is **no "discovery grid"**; Discovery is a swipe deck and a map, so the second
  column landed in `SavedView` alone — the one list long enough to earn it.
  (2) `.sharesheet` does **not** stay 430 and does not follow the frame either: it is
  `max-width:min(var(--frame-w),480px)`, because a sheet stops reading as a sheet somewhere
  around 500px. The spec offered "move it or say it stays" and the honest answer was neither.
  (3) A real bug, caught by measuring rather than by eye: `margin-inline:auto` on a
  **column**-flex child cancels the cross-axis stretch, so `.deck__stack` collapsed to
  **31px** at 1024px+ with `max-width` alone. `width:100%` is what fixes it and there is a
  comment on the line saying so.
  Verified by serving the built stylesheet against a harness of the real class structure in
  four iframes (a media query evaluates against an iframe's own viewport, which is what made
  this measurable at all in a session that cannot start a dev server) and reading computed
  boxes at **390 / 768 / 1024 / 1440**: frame 390→390, 768→430, 1024→760, 1440→960; `.pad`'s
  left padding 24 / 24 / 99 / 169; the grid one column then `273px 273px` then `303px 303px`;
  the deck stack 302 / 340 / 440 / 440, centred at every width; **no horizontal scroll at any
  of the four**. The narrow half was diffed against a baseline build of `main`: frame, gutter
  and sheet are byte-identical at 390 and 768, which is the claim that mattered — this widens
  the frame, it does not redesign the phone. `build` / `test` (98) / `lint` green, with the
  same 9 pre-existing warnings and no new ones.

- 2026-09-06 — DC-7 — PR #67 — **The app is one stylesheet fewer, and the order that decides
  live screens is written down.** `web/src/App.css` (627 lines), `components/Sidebar.tsx` (51)
  and `components/Checklist.tsx` (31) are deleted — **709 lines out of the repo**, against 78
  added, and the built stylesheet drops from 94.4kB to 86.2kB. The measurement was re-run
  rather than trusted and it held: `App.css` had exactly five live classes, not the seven a
  naive scan reports (`app` and `badge` are JS identifiers inside `className={...}`
  expressions — `app.id`, `badge.tone` — which is worth knowing before anyone re-measures).
  `.btn`, `.btn--primary`, `.btn--ghost`, `.btn:hover:not(:disabled)`, `.btn:disabled` and the
  520px `.btn{width:100%}` rule moved verbatim to the **top of `pawthway.css`**, not into
  `theme.css`, for the reason the spec gave.
  **Proof, not eyeballing.** The built CSS was diffed rule-by-rule against a baseline build of
  `main`: **66 selectors removed, 0 added**, and every removed one is absent from every
  `className` in `web/src`. Four selectors changed and each is accounted for — `.chat` gained
  `min-width:0` (the one property `App.css` was silently supplying to the live Match chat) and
  otherwise resolves to `theme.css`'s rule exactly as it already did; `.chat__scroll` lost a
  copy that was already being overridden, *including* the `padding:18px` inside `App.css`'s
  780px media query, which never won because a media query adds no specificity;
  `.btn--primary`/`.btn--ghost` differ only by `var()` indirection.
  **The one thing the spec did not anticipate: moving the rules would have failed CI.** The
  design-token guard flags an *added* line containing `rgba(` in any file but `theme.css` and
  `brand.ts`, and it cannot tell a move from new drift. Per this doc's standing rule that a
  guard hit means use a token, the three literals became `--btn-primary-shadow`,
  `--btn-ghost-bg` and `--btn-ghost-line` in `theme.css`'s `:root`. Values are byte-identical,
  so this is not the repaint the parked list forbids — but it *is* three new tokens, recorded
  here rather than buried.
  **The notice is a third step, not an extension of DC-4's** — DC-4 has not landed, so there
  was nothing to extend. It greps `App.tsx`'s diff for `import "./*.css"` lines and, on a hit,
  emits a `::warning::` plus a `$GITHUB_STEP_SUMMARY` block; it never exits non-zero. It fires
  on this PR, which is correct — this PR removed an import.
  **What is still dead and deliberately untouched:** `pawthway.css`'s own unused rules, and six
  `className` literals that match no selector anywhere (`cp-journal`, `cp-timeline`, `cp-tips`,
  `cp-tip-group`, `cp-feed-item__tag--ask`, `shelter__home`). All six predate this item and sit
  in files it had no business opening; they are a note for plan, not a bonus fix.
  `build` / `test` (98) / `lint` green, 9 pre-existing warnings on both this branch and `main`.
