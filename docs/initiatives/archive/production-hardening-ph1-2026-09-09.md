# Archive — production-hardening.md, the PH-1 section (verbatim, 2026-09-09)

Snapshotted the run after RS-12 discharged it, per the README's 2026-09-02 rule: a
discharged section and the ledger row of the item that discharged it are two tellings
of one story, and the working doc keeps the shorter. RS-12's row lives in
`real-data-and-shelters.md`. Archives are append-only — if anything below turns out to
be wrong, correct the working doc and say so there.

---

## The notification that doesn't notify — DISCHARGED 2026-09-05 by RS-12 (PH-1)

`src/agent/builtin/adoption.py:66` returns
`"notified_shelter": arcade_tools.available()` instead of a hardcoded `True`
(PR #19), and the system prompt tells the model to say plainly when nobody was
notified. The fix made the tool honest, not capable. Background in the
[archive](archive/production-hardening-2026-08-29.md).

**2026-09-04 — the gate this was parked behind is open, and the work has moved.** This
section has said since 2026-08-24 that a real notification path is downstream of M3 —
"a shelter with an account and an application list is the thing worth notifying." M3's
three surfaces have all shipped (RS-2, RS-5, RS-6) and RS-5b proved on 2026-09-04 that a
real staff account reads the inbox and writes back to it. M3 finished while nobody
re-read this paragraph.

Reading `adoption.py` against the shipped dashboard this run turned up the concrete gap:
the tool writes `status: "ready_for_adoption"` **and** `adoption_profile` onto the dog,
and `grep -rn adoption_profile web/` finds **no reader in the frontend at all** — the
paragraph the app's most expensive turn writes reaches no human but the foster who
watched it stream. The answer is that the notification is the shelter's own roster, not
email: `real-data-and-shelters.md`'s **"notify the shelter" means the dashboard** section
settles it, and **RS-12 `[large]`** builds it, including making `notified_shelter` true
because the write landed somewhere a shelter demonstrably reads.

**PH-1 stays open here and is discharged by RS-12, not by anything queued in this doc.**
That is deliberate: the fix is a shelter surface, it belongs in the doc that owns the
shelter side, and duplicating it here would refill the queue the 2026-08-31 re-rank
exists to keep empty.

**2026-09-05 — RS-12 shipped, and this is closed.** `adoption_profile` renders in full in
`ShelterRosterView`'s new **Back from foster** group, and `notified_shelter` is `True`
because that Firestore write landed on a surface RS-5b proved a staff account reads —
with `notified_via: "shelter_roster"` naming which surface and Arcade demoted to
`arcade_messaging_available` under its own name, so no single field conflates a capability
with a delivery. `server.py`'s system prompt moved with it: the branch telling the model to
say "no one was notified automatically" would never have fired again, and would have been
the wrong thing to say if it had. **Nothing signed-in was verified** — that half is RS-12b
in `real-data-and-shelters.md`. This section is kept rather than deleted because the
2026-08-24 → 2026-09-05 arc (hardcoded `True` → honest capability probe → true for a stated
reason) is the whole point of the item. Full account in RS-12's ledger row there.

