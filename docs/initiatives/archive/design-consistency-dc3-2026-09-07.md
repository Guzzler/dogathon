# Archive — design-consistency.md, DC-3's closed entry (snapshot 2026-09-07)

Verbatim snapshot of the DC-3 queue entry — the diagnosis of why the design-token guard was
inert (a shallow checkout with no merge base, plus a `|| true` on the whole pipeline). DC-6
shipped the fix on 2026-08-28 and its Ledger row in the working doc records the verification
from real Actions runs. Compressed to one line in the working doc on 2026-09-07 to bring that
doc back under the README's ~400-line threshold. Archives are append-only.

---

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
