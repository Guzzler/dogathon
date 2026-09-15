# Archived from `docs/initiatives/README.md` on 2026-09-14

The `PR #__` placeholder convention's full backfill log, verbatim — every run from 2026-08-26
to 2026-09-14 that resolved one, with which items and which numbers. It is a chronological log,
which is the growth shape the doc-size section says ages out first: the convention it records
has held without exception for eleven runs, so the log is no longer the part anyone reads. The
convention itself, and the two things the log actually established, are four lines in the
working doc.

**On `PR #__` placeholders.** execute writes its ledger row in the same
commit as the code, before the PR exists, so it cannot know its own number
and has been writing `PR #__`. All three docs had one as of 2026-08-26
(PH-3, RS-3, DC-1 — backfilled to #23, #24, #25 in that run). This is a
real ordering constraint, not sloppiness, so the convention is: **execute
leaves `PR #__` and plan backfills it on the next run** from
`gh pr list --state merged`. If execute can cheaply amend the row after
opening the PR, better — but don't block a merge on it. The convention is
working as designed: PH-5 was the only outstanding placeholder on 2026-08-28
and was backfilled to #29 that run; on 2026-08-29 all three of that week's
shipped items carried one and were backfilled together — DC-6 → #32,
PH-7 → #33, RS-2 → #34. Later the same day a second execute run added four more,
backfilled on the following plan run — PH-9 → #36, PH-8 → #37, RS-7 → #38, and
RS-7's follow-up → #39. Four placeholders from one run is the most so far and
still cost one `gh pr list` to resolve, so the convention is holding; if it ever
stops being cheap, the fix is execute amending its own row after opening the PR,
not plan guessing. *(2026-08-30: three more — PH-10 → #43, PH-11 → #44,
PH-12 → #45 — backfilled at the same moment those rows were moved into the
ledger archive, which is the cheapest time to do it: the rows were being
rewritten anyway.)* *(2026-09-06: DC-5 and its rider DC-2 both carried one and
both resolve to the same **#65**, since the rider convention puts two items in one PR —
which is the first time a single number has filled two placeholders.)* *(2026-09-07: DC-7's
queue entry and ledger row both backfilled to **#67**.)* *(2026-09-08: DC-8 and DC-9 both
resolve to **#69** — the rider convention filling two placeholders with one number for the
second time, and three placeholders across two sections resolved by one `gh pr list`.)*
*(2026-09-10: RS-4's three placeholders — its queue entry, the M4 section and its ledger row —
all resolve to **#72**. Three in one doc from one shipped item, still one `gh pr list`.)* *(2026-09-11: PH-17's two — its queue entry and its ledger row — both resolve to **#75**,
backfilled in the same run that compressed the row, which is again the cheapest moment: the row
was being rewritten anyway.)* *(2026-09-13: PH-20's two — its queue entry and its
ledger row — resolve to **#79**, backfilled in the run that merged the queue entry into a
four-line shipped-items bullet. Three runs running, the placeholder has been resolved while the
row was being rewritten for length anyway, which is now the rule rather than the coincidence.)*
*(2026-09-14: PH-21's two — its queue entry and its ledger row — resolve to **#81**, again
backfilled in the run that rewrote the surrounding section. Four runs running; the convention is
no longer worth narrating each time, only the number.)*

