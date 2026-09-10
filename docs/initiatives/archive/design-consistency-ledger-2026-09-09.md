# Archive — design-consistency.md, DC-7's Ledger row (verbatim, 2026-09-09)

Snapshotted the run after DC-10 deleted most of the CSS this row describes, and because
this run's own edits carried the working doc past ~400. The row is 35 lines and every one
earned its place when written; what the working doc keeps is the decision, the two traps
that are still live constraints, and a pointer here. Archives are append-only — if
anything below turns out to be wrong, correct the working doc and say so there.

---

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
