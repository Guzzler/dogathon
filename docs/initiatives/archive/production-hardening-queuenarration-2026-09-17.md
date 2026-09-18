# `production-hardening.md` — the queue narration and three shipped-item bullets, as they stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17, in the same PR that queued PH-23, per the
README's doc-size rule. Two layers came out together: the run-by-run narration of how the
`[large]` slot was found and emptied over the 2026-09-15 and 2026-09-16 runs (which the
README's own fallback chain already tells in full), and three bullets that each pointed at a
Ledger row that points at an archive — the "cut the layer that points at a layer" rule.
Nothing below is lost: every item named in it has a Ledger row in the working doc.

## The 2026-09-15 / 2026-09-16 queue narration (verbatim)

**2026-09-15 — PH-22 shipped the day it was queued (PR #83), the fifth such run running, and
the slot is now filled by a *label*: PH-18 is marked `[large]` below.** It was always screen-
sized — a hand-drawn map to delete, a headline card to make conditional, and two invented
phone numbers to remove — and it has been the only open item in the repo since 2026-09-09
while five runs went looking elsewhere for something big. How PH-22's slot was found is in
`README.md`'s fallback chain; what it found is its Ledger row and
[`archive/production-hardening-ph22-2026-09-14.md`](archive/production-hardening-ph22-2026-09-14.md).

**PH-18 then shipped the same day it was re-labelled**, the sixth such run running, and **this
queue is now empty** — no open item, gated or otherwise, outside "Needs a human". The label ran
out at the same moment the queue did, so the next run's `[large]` slot has nothing to re-read
here; the two leads PH-18's Ledger row names (a dead keyframe, a button that has never done
anything) are notes for plan, not queue items, and neither is big. **2026-09-16 — both are
closed, and one was closed before it was written down.** The "What to do now · Triage guide"
`<button>` is already gone: PR #85's own diff deletes it when the quick-action row became
`poison.map(...)`, so the row's "neither taken" is wrong about its own PR (left as written, per
the ledger convention, and corrected here). `@keyframes cp-pulse-dot` — referenced by nothing
under `web/`, dead since the map went — was deleted in the follow-up PR with no other change.
## The three shipped-item bullets (verbatim)

- **PH-22 `[large]` — shipped 2026-09-14 (PR #83); the Ledger row is the full account.** The
  queue entry, with its coverage counts and its read-site census, is archived verbatim in
  [`archive/production-hardening-ph22-2026-09-14.md`](archive/production-hardening-ph22-2026-09-14.md),
  along with the two things re-verification found it had missed. The design section above stays
  in this doc, because it holds the rule rather than the build instructions.

- **PH-14/15/16, PH-17, PH-19, PH-20 and PH-21 — all shipped** (PRs #47, #48, #49, #75, #77,
  #79, #81). Each Ledger row below is the full account and each spec is archived verbatim; these
  bullets had become a third layer pointing at the second, so they are one line now. Two things
  they carried that are not in the rows: PH-15's live rules check is **PH-15b under "Needs a
  human"**, so don't read PH-15 as verified end to end; and the habit of re-verifying a spec
  against `main` before building is **eight runs old** — nothing wrong on PH-19, PH-20 or
  PH-21's own re-check, something materially wrong on PH-17, on PH-22's read-site census, and on
  PH-18 three times.

- **PH-18 `[large]` — shipped 2026-09-15 (PR #85); the Ledger row is the full account.** The
  queue entry, with nine runs of re-verification on it, is archived verbatim in
  [`archive/production-hardening-ph18-2026-09-15.md`](archive/production-hardening-ph18-2026-09-15.md).
  Read it before adding any local row back to `emergencyContacts` — it is the record of what a
  distance, an opening state and a coordinator's phone number cost when nothing sources them.

