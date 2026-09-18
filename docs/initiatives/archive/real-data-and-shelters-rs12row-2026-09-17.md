# `real-data-and-shelters.md` — RS-12's Ledger row, verbatim as it stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17 to keep the working doc under the README's ceiling in
the same PR that queued RS-13. RS-12 is long settled, its specification is archived separately in
[`real-data-and-shelters-2026-09-05.md`](real-data-and-shelters-2026-09-05.md), and its own row
already pointed at a fuller version in
[`real-data-and-shelters-ledger-2026-09-06.md`](real-data-and-shelters-ledger-2026-09-06.md) —
a compression of a compression, which the README names as the cheapest thing to cut.

- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it — which
  is what "notify the shelter" now means.** `adoption_profile` had been written by the agent
  since the first Post Foster turn and read by **nothing** — the app's most expensive turn
  produced a paragraph that reached no human but the foster who watched it stream. It now lands
  in a **Back from foster** group at the *top* of `ShelterRosterView`, rendered in full with no
  clamp. `rosterAction` (singular) became **`rosterActions` (plural)**, because
  `ready_for_adoption` is the one status wanting two moves — the shape change the item implied
  and didn't name. **No rules change**, confirmed before writing one: both actions are
  status-only writes on a dog the shelter already owns. `notified_shelter` is now `True`
  *because the write landed on a surface RS-5b proved staff read*, with `notified_via:
  "shelter_roster"` and Arcade demoted to `arcade_messaging_available` — two claims, two fields.
  `server.py`'s system prompt moved with it. This discharges **PH-1**. Nothing signed-in was
  verified; that half is RS-12b. Full 35-line row verbatim in the
  [2026-09-06 ledger archive](archive/real-data-and-shelters-ledger-2026-09-06.md).
