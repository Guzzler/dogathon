# DC-4 — the original spec, archived 2026-09-15

Cut from `design-consistency.md` verbatim on 2026-09-15. DC-4 shipped 2026-09-08 (PR #71) as a
rider on DC-10, and the open entry at the top of that doc's queue is the account of what
shipped. This bullet was the third layer: a spec pointing at an entry pointing at a ledger row.
Kept here because its reasoning about *why the reporting half and not the failing half* is the
part nobody restated.

- **DC-4 — the original spec (2026-08-26; ungated 2026-08-28); the open entry is at the top of
  this queue.** PR #11's damage was spread across five files, so DC-1's stray-literal check
  would have caught *part* of it — the `:root` token rewrite and the `pawthwayTheme.palette`
  rewrite, which were the actual repaint, not at all. Fix the **reporting** half, not the
  failing half: when a PR's diff touches `web/src/theme.css` or `web/src/brand.ts`, emit a
  `::warning::` plus a `$GITHUB_STEP_SUMMARY` block naming the files and showing the changed
  token lines. It must **not** `exit 1` — editing the palette on purpose is allowed, and this
  doc's goal is that a repaint be *visible in review*, not blocked. Add it as a step in
  `ci.yml`'s `frontend` job beside "Design token guard", reusing the same `origin/main...HEAD`
  diff, which DC-6 made resolve. Verify on two throwaway commits the way DC-1 was: a
  `theme.css` `:root` edit produces the warning and a **green** job; a PR touching neither
  exempt file produces no warning at all.
