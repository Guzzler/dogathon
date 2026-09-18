# `real-data-and-shelters.md` — RS-4's Ledger row, verbatim as it stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17, in the same PR that queued RS-13. Read it before
touching `import-dogs.yml`: it is the record of which argument strings each of the three event
types resolves to, why the scheduled branch re-scrapes by construction, and why the drift report
reuses one issue instead of filing a new one weekly. Its closing sentence — *"the first real
proof arrives the Monday after merge"* — is what RS-13 went and checked, and the answer was a
403 from the runner's IP range.

- 2026-09-09 — RS-4 — PR #72 — **the roster now tells us when it goes stale, weekly, without
  ever being able to write.** A `schedule: "0 9 * * 1"` trigger joins the existing
  `workflow_dispatch` on `import-dogs.yml`. The one detail M4 said decides whether the task is
  worth doing at all is enforced structurally, not by default: the scheduled branch builds
  `ARGS="--plan"` from `github.event_name` and never appends `--from-cache`, so it always
  re-scrapes (a cached replay diffs the committed data against itself and reports "no drift"
  forever) and there is **no input it can set and no branch it can take that writes to
  Firestore**. Both manual paths resolve to exactly the argument strings they did before —
  checked by replaying the shell for all three events, not by reading it. **Chose the issue
  over the `::error::` fallback** the item offered, and reused rather than reopened: one
  `roster-drift` label (created with `--force`, so a missing label can't fail the run), one
  open issue, a *comment* on it if a later week still drifts — a weekly check that files an
  identical ticket every Monday until someone re-bakes is a backlog, not a signal. Quiet when
  the diff is empty: one line to the step summary and nothing else. `permissions:` gains
  `issues: write`; `concurrency: import-dogs` is untouched, as asked, and already prevents a
  scheduled run overlapping a manual one. Two things the spec hadn't named. The report needed
  a body richer than a diff stat, so the import output is `tee`'d and the `firestore plan`
  block is `sed`'d out of it — a reader wants to know how many docs *would* change, not only
  which files did. And the existing "Check for uncommitted roster changes" step was pinned to
  `github.event_name == 'workflow_dispatch'`: `inputs.rescrape` is empty on a schedule event
  so it was already inert there, but relying on that is relying on a falsy empty string.
  **Verified by dispatching the branch's own workflow** (`--ref feat/roster-drift-check`,
  defaults untouched: plan-only, cached) — see the row's PR for the run. The scheduled branch
  itself cannot be dispatched, so what is proven about it is the argument replay plus the
  file parsing, not a live green run; the first real proof arrives the Monday after merge.
