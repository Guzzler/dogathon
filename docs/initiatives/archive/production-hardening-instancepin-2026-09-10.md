# Archive — production-hardening: "What lifting the instance pin actually costs"

Snapshot taken 2026-09-10, verbatim, from `docs/initiatives/production-hardening.md`.
Archived because the section was discharged on 2026-08-30 and everything still live in
it is restated word for word by **PH-13** under "Needs a human" — the 2026-09-02 rule
("two tellings of one story") applied to a *discharged design answer* and its parked
verification rather than to a shipped item and its ledger row. Archives are append-only;
if something here turns out to be wrong, correct the working doc and say so there.

## What lifting the instance pin actually costs — answered 2026-08-29, discharged 2026-08-30

PH-8 left `--min-instances=1 --max-instances=1` removable and gated its removal on "once
this has been watched working in production", which no run of this loop can evaluate.
Reading `server.py` for what was still genuinely per-process replaced that with a concrete
exit condition. Both blockers shipped: the in-memory rate limiter, which silently became a
20N spend ceiling at N instances (PH-11, next section), and a live transcript nothing ever
trimmed, so the 40-message cap only bit across a restart (PH-10). The residual race — two
concurrent turns for one foster on different instances, last-write-wins — needs two devices
and is accepted. **What remains:** `--max-instances` goes to **2** in one small PR, and a
human confirms the two things that only exist multi-instance — `/health`'s `active_sessions`
differing across two hits, and an approval issued in one browser resuming a turn parked in
another. That second one is PH-8's actual claim and has never been observed. It is PH-13
under "Needs a human", and it is the only thing between here and lifting the pin.
