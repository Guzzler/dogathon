# Archive — README: the Doc size archive log (2026-09-01 → 2026-09-09)

Snapshot taken 2026-09-10, verbatim, of `docs/initiatives/README.md`'s "Doc size" section.

Archived for the reason that section's own newest entry had just discovered about a
*different* part of this file: **a chronological log is the same growth shape as a ledger,
and the oldest entries are the ones that stopped being read.** On 2026-09-09 that lesson was
applied to the `[large]` slot log and not to the archive-count log sitting twenty lines
below it — an every-run narration of which doc was how many lines on which date, eleven
entries deep, of which only the last two were ever consulted. The working doc keeps the
*rules* the log established (they are the part that gets read) plus the current count, and
this file keeps the narration. Archives are append-only.

## Doc size

Keep each initiative doc's **working core** — context plus the Task
queue — under roughly 250 lines. If it grows past that, the excess is
almost always closed queue items that belong in the Ledger instead of the
prose above it, or a design decision that's settled and can compress to one
line with a date. There's no archive directory yet because nothing here has
run long enough to need one; when a doc first crosses ~400 total lines,
start one (`docs/initiatives/archive/<doc>-<date>.md`, dated verbatim
snapshot) rather than let it grow unbounded. **Twenty-five archives exist as of 2026-09-09.** That run archived four times across three docs — the widest spread so far, and every one because its own edits pushed a doc over: `production-hardening.md` took PH-17's design answer, so PH-1's discharged section and PH-11's rate-limit reasoning went out and it came back to **399**; `design-consistency.md` gained a correction and gave up DC-7's 35-line ledger row, landing at **390**; and `README.md` itself archived for the first time — the `[large]` slot log for 2026-09-01 → 2026-09-07, seven chronological entries compressed to the fallback chain they established plus one dated line each, which held this file at **406** while it gained a full new entry. The lesson the README had only been applying to the other docs: **a chronological log is the same growth shape as a ledger**, and the oldest entries are the ones that stopped being read. Previously **twenty-one as of 2026-09-08** — the newest, `design-consistency-dc10-2026-09-08.md`, took DC-10's design answer and its original spec in DC-10's own PR; the same run also appended DC-8's Ledger row to that day's earlier ledger archive, because DC-10 deleted most of the code that row described. Those edits would have left `design-consistency.md` at 437 and it came back to **393**. The doc has now archived on three consecutive runs, which is the trigger working rather than a doc that is too long. Previously **twenty as of 2026-09-08** — that run archived twice from `design-consistency.md` again (DC-8's settled section, restated by its own ledger row, and three settled Ledger rows plus DC-5's, which is where the growth was); its own edits would have carried the doc past 470 and it came back to **399**, under the line for the first time in three runs. Previously **eighteen as of 2026-09-07** — that run archived twice from `design-consistency.md` in one PR (DC-7's settled section, restated by its own ledger row per the 2026-09-02 rule, and DC-3's closed diagnosis) because its own edits carried the doc to 404; it came back to 385. Previously **sixteen as of 2026-09-06** — the newest,
`real-data-and-shelters-ledger-2026-09-06.md`, took RS-12's 35-line ledger row on the standing
instruction below, bringing that doc from 394 to 373 before this run's own additions took it to
382. Previously **fifteen as of 2026-09-05** (the newest, `real-data-and-shelters-2026-09-05.md`, took RS-12's design section
the run after it shipped — the 2026-09-02 rule applied on schedule for once, and it brought the
doc from 394 back to 374 before that run's own additions). Previously **thirteen as of
2026-09-04** — that run archived from *two* docs in one PR, which is a first.
`production-hardening-ledger-2026-09-04.md` took PH-14/15/16's three rows, 55 lines of entirely
load-bearing text, after this run's own PH-1 edits carried that doc to 410; it came back to 372.
`real-data-and-shelters-2026-09-04.md` took three settled design sections at once
plus RS-11's two ledger rows and RS-5b's superseded original — and the doc still landed at
**412**, over the threshold, which is recorded here rather than hidden, as 2026-08-31's 421 was.
The reason is the same both times: a run that archives *and* adds a `[large]` item plus a design
answer is net-positive on lines even after cutting 100. The next run to touch this doc should
archive the Ledger, which is again where the growth is.) Previously **eleven as of
2026-09-03** (counted off `docs/initiatives/archive/`, not carried over). The six that
established the convention: `real-data-and-shelters-2026-08-29.md` (that
doc's settled M1/M2/M4 narrative) and `production-hardening-2026-08-29.md` (its
settled PH-1..PH-6 narrative and rows), then
`production-hardening-ledger-2026-08-30.md` (PH-7..PH-12's rows) and
`real-data-and-shelters-ledger-2026-08-30.md` (M1 through RS-9's rows), then
`production-hardening-deletion-2026-08-30.md` (the account-deletion finding that
produced PH-14/15/16, archived by execute in PH-16's own PR the moment its edits
crossed the line — which is the trigger working as written).
The pattern that worked all three times, and is
now the convention: snapshot verbatim into the archive so nothing
is lost, then compress the settled sections in the working doc to one dated line
each that points at the archive for the reasoning. Archives are append-only — if
something in one turns out to be wrong, correct the working doc and say so there.

**The 2026-08-30 pair narrows the pattern usefully, so it's worth recording.** The
first two archived *narrative* — settled prose that had stopped being read. The
second two archived only **ledger rows**, because that is where the growth
actually was: both docs went back over 400 within a day or two of their first
archive, and almost none of the regrowth was stale prose. execute writes long,
genuinely valuable rows (PH-8's is 40 lines and every one of them earns its
place), so the ledger is now the first place to look when a doc is over, not the
last. Compress a row to its decision, its surprises, and what was verified versus
reasoned about; the archive keeps the rest.

**2026-08-31 — the sixth, and the first where compressing was not enough.**
`real-data-and-shelters.md` was at 397 before that run, which then added a whole new
design answer plus RS-10; archiving RS-9's narrative and compressing four settled
sections bought back roughly 60 lines and the doc still landed at **421**. It was
recorded rather than hidden, with the instruction that the next run to touch it should
archive the Ledger.

**2026-09-02 — the eighth**
(`archive/real-data-and-shelters-2026-09-02.md`) narrows the rule one more notch. That run's own
edits would have taken the doc to roughly 490, so it archived in the same PR, and what it took
was RS-6's photo-source design answer *and* RS-6's 26-line ledger row — both of which had been
restated by the thing they produced (the shipped code, and each other). The generalisation:
**after a `[large]` item ships, its design answer and its ledger row are two tellings of one
story**, and the working doc only needs the shorter one.

**2026-09-03 — the eleventh, and it took both kinds at once.** RS-10 shipped, so its
design section *and* its 22-line ledger row were the two tellings the 2026-09-02 rule names —
except the design section had already been compressed, so what was actually redundant was the
**round-trip section for RS-11, an item that has not shipped yet**. Its two "must not do" rules
were quoted word for word inside RS-11's own queue entry, which is the 2026-09-01 trigger
("a design answer stops earning its length the moment its queue item restates it") firing
*before* the build rather than after. The generalisation: the restating thing can be the queue
item, not only the shipped code, so check the queue entry against the design section the run you
write it, not the run it ships.

**2026-09-01 — that instruction was followed, and it worked.** The seventh archive
(`archive/real-data-and-shelters-2026-09-01.md`) took both the Ledger through RS-5 and
the 2026-08-31 checklist-join design answer, which had become RS-10's duplicated spec
rather than live reasoning. The doc went 390 → 356 *while* gaining a new design section
and a new queue bullet. Two things generalise. **The ledger really was the growth**, as
the 2026-08-30 pair predicted: RS-5's row alone was 24 lines. And **a design answer stops
earning its length the moment its queue item restates it** — compress it to the decision
plus a pointer at exactly that point, not later.

The trigger is worth applying at the moment a run's own edits push a doc past
~400, not on the next run. production-hardening crossed it *because of* the
2026-08-29 queue refill, and archiving in the same PR is what kept the working
doc at 347 lines instead of letting a 420-line version merge and get noticed
later.
