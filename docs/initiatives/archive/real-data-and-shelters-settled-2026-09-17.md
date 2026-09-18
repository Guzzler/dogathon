# `real-data-and-shelters.md` — two settled sections, verbatim as they stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17 to keep the working doc under the README's ceiling in
the same PR that queued RS-13. Both are the longer of two tellings, per the 2026-09-02 rule:
the three dated "where this stands" bullets for RS-10/RS-11, RS-5b and RS-12 each restate a
Ledger row, and the "notify the shelter" section restates RS-12's row plus its own design
archive. Read this one before changing what `notified_shelter` means.

## The 2026-09-03 / 09-04 / 09-05 bullets from "Where this actually stands" (verbatim)

- **2026-09-03 — the application round trip is closed in both directions, and the design
  sections that specified it are now descriptions of shipped code.** RS-10 joined the two
  checklist halves by `owner`; RS-11 threaded `application.status` into the foster side under
  the `declined` > `withdrawn` > `approved` > checklist precedence and made withdrawing write
  `withdrawn` back. Both are compressed into the settled-design block below. What is *not*
  closed is that no human has driven it end to end.
- **2026-09-04 — `applications` is no longer empty, and the read rule is proven.** Three
  `fixture-` rows written with Sharang present; the inbox renders them signed in as staff, and
  both staff writes (a checklist tick, `Mark approved`) succeed. RS-5b is discharged; the
  README's "zero documents in the `applications` collection" line is now stale.
- **2026-09-05 — both halves of that gap are closed (RS-12).** The paragraph the agent writes
  at the end of a journey now renders in full in a **Back from foster** group at the top of
  `ShelterRosterView`, and a returned dog is offered **List for adoption** / **Mark adopted**
  instead of the wrong verb. `rosterActions()` (plural) and `groupRoster()` decide both in
  `web/src/lib/shelterDog.ts`, unit tested across all six `DogStatus` values. No rules change was
  needed — RS-6's `update` rule already permits a status-only write on your own shelter's dog.
  `send_adoption_profile_to_shelter`'s `notified_shelter` is now `True` because that write landed,
  with Arcade reported separately as `arcade_messaging_available`. Nothing signed-in was verified:
  see RS-12b.

## "Settled — \"notify the shelter\" means the dashboard" (verbatim)

## Settled — "notify the shelter" means the dashboard (2026-09-04, shipped 2026-09-05)

PH-1 had said since 2026-08-24 that a real notification path was *downstream of M3*; M3
finished while nobody re-read that sentence. The answer, once someone did: **the
notification is a surface, not a message.** Not email and not Arcade — wiring either would
mean choosing an address for an organization Pawthway has no relationship with, which is
the conversation this doc keeps saying is Sharang's to have. A shelter that signs in to
`/shelter` has already told us where it reads. So the dog comes back **on the shelter's own
roster, with the agent's profile rendered in full**, `ready_for_adoption` is an arrival that
sits above `available` rather than a resting state, and the offered action is **List for
adoption** / **Mark adopted** rather than the untruthful `retire`. `notified_shelter` is
then true because a write landed somewhere a shelter demonstrably reads (RS-5b), not
because a capability exists. Shipped as RS-12 (PR #63), which discharges PH-1. Full text of
the specification, verbatim, in the
[2026-09-05 design archive](archive/real-data-and-shelters-2026-09-05.md); what the build
found that the spec hadn't is RS-12's ledger row.

