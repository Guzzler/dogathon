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
- **No dark mode anywhere.** Zero `prefers-color-scheme` references in any
  CSS file. Not an oversight to silently fix — just worth knowing before
  proposing token changes that assume one exists.

## Settled — what `App.css` actually is, and what may leave (2026-09-06)

The open question this run answered is one the doc had never asked: **there are three
stylesheets, they are loaded in a fixed order, and nothing says which of them is live.**
`App.tsx:25-27` imports `App.css`, `pawthway.css`, `theme.css` in that order and
`main.tsx` imports `index.css` (29 lines of `html`/`body`/`#root` reset — not in scope
below). `CLAUDE.md` records the order as load-bearing for `.btn`; PR #60's ledger row
records a second case (`.shelter .btn` beats `.screen .btn` only by sitting lower in
`theme.css`). Two hazards of the same shape, both discovered by being bitten.

It was measured rather than guessed — every `className` literal and template string in
`web/src/**/*.tsx` against every selector in each file:

- **`App.css` is 627 lines and three classes of it are live.** `.btn`, `.btn--primary`
  and `.btn--ghost` — 67, 11 and 16 uses. They are the *base* layer that `theme.css`'s
  `.screen .btn`, `.phone-body .btn--ghost`, `.sharesheet .btn` and `.shelter .btn` all
  override, so they are load-bearing and stay.
- **Everything else in it is the pre-Pawthway scaffold's desktop agent UI**, reachable
  only through `components/Sidebar.tsx` — which **nothing imports** (`grep -rn "from
  .*Sidebar"` → zero hits). That covers `.sidebar*`, `.tool-list*`, `.badge*`,
  `.banner*`, `.brand-lockup*`, `.app`, and the whole dead chat stack (`.bubble*`,
  `.turn*`, `.tool-card*`, `.chat-header*`, `.modal*`, `.composer*`, `.status-pill*`,
  `.thinking-block`, `.empty-state*`, `.btn--approve`, `.btn--deny`). The live agent UI
  uses `theme.css` exclusively: `TurnView` is `.msg*`, `ToolCallCard` is `.activity*`,
  `ApprovalModal` is `.approve*`.
- **`components/Checklist.tsx` is dead too** — `MatchView` renders its own local
  `ChecklistSection`.
- **Two dead selectors leak into a live surface by name.** `.chat` and `.chat__scroll`
  are the *only* selectors defined in two files (`App.css:137,233` and
  `theme.css:281,320`), at identical specificity. `MatchView`/`MatchChatView` render
  `.chat`, so the live chat screen is currently resolved by import order — and it
  inherits `min-width:0` from `App.css`, which `theme.css`'s `.chat` does not set. That
  is the PR #11 failure mode with the two halves reversed: not a repaint nobody reviewed,
  but a *deletion* that would silently change a live screen.

**The decision: one stylesheet, and the order stops mattering.** Not a repaint — no token,
no font and no color value changes, which is what keeps this inside the parked list below
rather than in violation of it. DC-7 builds it.

## Task queue

- **DC-7 `[large]` (2026-09-06) — the app is one stylesheet, and reordering it stops being
  dangerous.** Grounded in the section directly above; read it first, and re-measure rather
  than trust it. Ship as one PR — the deletions and the guard against them coming back are
  the same change.
  - **Delete `web/src/components/Sidebar.tsx` and `web/src/components/Checklist.tsx`.**
    Confirm nothing imports either (`grep -rn "Sidebar\|components/Checklist" web/src`)
    *before* deleting, not after; `Checklist.tsx`'s `ChecklistItem` import is a type import
    from `../types` and is not a reverse dependency.
  - **Fold the three surviving rules — `.btn`, `.btn--primary`, `.btn--ghost` (plus
    `.btn:hover:not(:disabled)`, `.btn:disabled`, and the `.btn` block inside `App.css`'s
    media query at `:624`) — into the top of `web/src/pawthway.css`**, with a comment saying
    they are the base layer that `theme.css` overrides and must therefore load before it.
    Then delete `web/src/App.css` entirely and drop its import from `App.tsx:25`. Do **not**
    move them into `theme.css`: `.screen .btn` and the bare `.btn` in the same file, in that
    order, is the collision PR #60 already paid for once.
  - **`min-width:0` is the one property that must survive the deletion.** `App.css`'s `.chat`
    sets it and `theme.css`'s does not, and the live Match chat screen currently gets it by
    import order. Add it to `theme.css`'s `.chat` **in the same commit** as the deletion, with
    a comment naming where it came from. Everything else on `App.css`'s `.chat`/`.chat__scroll`
    is already overridden or dead — verify that claim by diffing the computed rules, don't
    assume it.
  - **Then make the ordering visible instead of tribal.** Add a short header comment to
    `pawthway.css` and `theme.css` saying which loads first and what depends on it (the `.btn`
    base layer, and `.shelter .btn` needing to sit below `.screen .btn` *within* `theme.css`),
    and add a **non-failing** CI notice in `ci.yml`'s `frontend` job, next to the existing
    Design token guard, that flags a PR reordering the `import "./*.css"` lines in `App.tsx`.
    If DC-4 has already landed its `$GITHUB_STEP_SUMMARY` step, extend that step rather than
    adding a third; say which you did in the ledger row.
  - **Out of scope, deliberately:** `pawthway.css`'s own dead rules, `index.css`, any token
    or color change, and merging `pawthway.css` into `theme.css`. The `.pw-page` views are
    still live (Hub, Post Foster, the public adoption page) — this item removes a dead
    stylesheet, it does not migrate a live one.
  - **Verify:** `npm run build`, `npm test` (98 green today), `npm run lint` (9 pre-existing
    warnings — compare against `main` by stashing, as DC-5's row did, and report the number).
    Then re-run the measurement in the section above against the built CSS and record in the
    ledger row **how many lines left the repo** and that no `className` in `web/src` now
    matches zero selectors. Confirm by eye or by computed-box measurement that the Match chat
    screen, the approval modal and any `.btn--ghost` on a `.pw-page` are unchanged.

- **DC-2 — shipped 2026-09-05 (PR #65), as a rider on DC-5 exactly as this entry
  instructed.** `sidekickTheme` is gone from `web/src/brand.ts`, replaced by a four-line
  comment saying there is one theme and naming the trap, so the file still records why an
  unused theme object was ever there. The rider convention worked on its first use: a
  one-line item that had lost five runs in a row shipped without costing one.

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
- **DC-5 `[large]` — shipped 2026-09-05 (PR #65); the Ledger row is the full account.**
  The frame widens, the tab bar stays a bottom bar and caps its inner row, and the two
  screens that suffered from the cap use the room. The spec's own scope note was wrong
  about one thing and the ledger row says how.
  **Consequence for plan, recorded rather than acted on:** this was the repo's only
  `[large]` item, so there is now none in any of the three docs. DC-4 (below) is the only
  thing left open here, and it is small. The README's 2026-09-05 note still reads as if
  DC-5 were pending — it needs re-dating, not re-deciding.

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
