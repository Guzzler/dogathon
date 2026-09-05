# Archive — real-data-and-shelters, 2026-09-04

Verbatim snapshot, taken by the `dogathon-plan` run of 2026-09-04 because that run's own
edits (a new design answer plus RS-12) would have carried the working doc past the README's
~400-line threshold. Two kinds of thing are here, both by the rules the README records:

- **Three settled design sections** (RS-6's photo source, RS-10's checklist join, RS-11's
  round trip and its approval precedence). All three describe code that has shipped, so per
  the 2026-09-02 rule they are the longer of two tellings; the shorter one is the ledger row.
- **RS-11's two ledger rows**, which are the other telling and stay in the working doc in
  compressed form.

Archives are append-only. If something here turns out to be wrong, correct the working doc
and say so there.

---

## Settled design sections, as they stood

## Settled 2026-08-31, built 2026-09-02 — RS-10: the two approval checklists join by `owner`

**One writer per field.** Shelter-owned items live on `applications/{id}.checklist`, foster-owned
ones stay on `fosters/{uid}.approvalChecklist`, and each view composes the displayed list out of
both — not a mirror (PH-16 pinned `checklist` on the foster branch precisely to stop that, and a
mirror is last-write-wins by construction) and not the full migration to the application as sole
source of truth, which is M2's deferred work. The `owner` split is that migration's first half.
Shipped as `composeApprovalChecklist()`; the full original spec, its two rejected alternatives
and its three hazards are in the
[RS-10 archive](archive/real-data-and-shelters-rs10-2026-09-02.md).

## Where a hand-entered dog's photo comes from — settled 2026-08-31, built 2026-09-01 (RS-6)

**The form takes a photo URL, written into the same `photo_urls` the scraper writes. No
uploads.** Firebase Storage is not in this stack, and every dog on the site is already a
hotlinked third-party image, so a pasted link introduces no practice the app isn't doing. The
consequence that mattered is built and unit-tested: `dogPhotoOrNull()` keys off `source`, so
**the placedog fallback never fires for a hand-entered dog** — a stock photo of some other
animal on a real adoptable record is indistinguishable from one the staff member believes they
supplied. Uploads, if ever wanted, are their own item (a `storage` block, rules scoped by
`isStaff`, a size cap, a deletion path), not a widening of RS-6. Full original reasoning in the
[2026-09-02 archive](archive/real-data-and-shelters-2026-09-02.md).

## Settled 2026-09-02 — the application document is written by both sides and read by only one each

`applications/{id}` is a two-owner record whose round trip is missing in both directions:
`setApplicationStatus()` has exactly one caller (the shelter inbox, `ShelterApplicationsView.tsx:260`
— re-verified 2026-09-03) and no foster surface reads `status`, so a declined foster goes on seeing
*"⏳ Waiting for approval"* indefinitely; and `SavedView`'s `withdraw` clears the foster document
without ever writing `status: "withdrawn"`, so the row stays live in the inbox forever. **This is one
flow and it is RS-11**, gated behind RS-10 rather than merged into it, because both halves need
`useApplication.ts` and bundling them produces the single PR that leaves the repo half-working if it
stalls. Two rules the build must not reopen — `declined` is not a phase change (release
`activeApplication()`, don't move anyone), and the withdraw write is best-effort and must not block
the local clear — are restated in full in RS-11's queue item, which is why the reasoning behind them
now lives in the [2026-09-03 archive](archive/real-data-and-shelters-2026-09-03.md).

## Settled 2026-09-03 — three things now mean "approved", and only one of them is the decision

RS-11 will trip over this on its first screen, so it is answered here rather than left to whoever
builds it. Read off `MatchView.tsx:62-65` and `SavedView.tsx:161-164` this run, the foster side is
about to have **three** independent signals called approval:

1. `shelterApproved` — every *shelter-owned* checklist item done. Drives the Match badge.
2. `approved` — every item, both owners, done. Drives the pickup scheduler and `activeIdx` on both
   timelines.
3. `application.status === "approved"` — a staff member clicked Approve in the inbox. Read nowhere
   on the foster side today.

They are not three views of one fact. **The checklist answers "is the paperwork finished"; `status`
answers "did the shelter say yes."** A shelter can decide before the boxes are ticked, and the boxes
can be ticked by a foster whose application was never accepted. So:

- **`declined` overrides everything**, at any checklist state. The case that makes this
  non-negotiable already renders wrong today: a fully-ticked checklist on a declined application
  shows *"✓ Approved — schedule pickup"*, which is the app inviting someone to book a pickup for a
  dog they were refused.
- **`approved` does not unlock pickup and does not tick anyone's boxes.** Scheduling stays gated on
  the full composed checklist. Approving early means the decision is made and the paperwork isn't;
  a scheduler at that moment books a slot for a home visit that hasn't happened.
- **`approved` does replace the badge**, because the badge is the outcome and the outcome is now
  known. `shelterApproved` stays the badge's source only while `status` is undecided.
- **Precedence is `declined` > `withdrawn` > `approved` > checklist-derived**, and **no application
  document falls all the way through to today's behaviour.** A guest, a `LOCAL_MODE` foster and
  every pre-RS-5 record have no row at all; absence must never render as a decline.

---

## RS-11's ledger rows, as they stood

- 2026-09-03 — RS-11 `[large]` — PR #__ — **The application round trip closes in both directions.**
  The foster now reads `application.status`: `approvalDecision()` collapses five statuses to the
  three that are news plus `null`, and `approvalBadge()` layers that over each surface's own
  checklist-derived badge (Match tracks shelter-owned steps, Saved tracks the whole list — they
  keep disagreeing on purpose, and the decision wins on both). A declined application replaces the
  checklist and the scheduler on both surfaces with what happened and one way forward. Withdrawing
  from `SavedView` now calls `setApplicationStatus(id, "withdrawn")` before the local clear,
  best-effort inside a `catch` — **no rules change**; PH-16's foster branch already permitted
  exactly that field.
  **The load-bearing edit was the signature**, as the queue item predicted: `activeApplication()`
  is now `(foster, status)` with the second argument **required**, not optional. An optional one
  would have let `DogDetailView` and `SavedView` disagree about whether a declined foster is still
  blocked, which is the one bug this item exists to prevent — so both call sites gained a
  `useApplication(foster?.matchedDogId)` keyed to the *matched* dog rather than the dog on screen.
  Two things the spec didn't specify, decided here: `withdrawn` releases the block as well as
  `declined` (an application the foster ended is no more live than one the shelter ended), and a
  declined foster gets **no** button that clears `matchedDogId` — applying elsewhere overwrites it,
  and the design section forbids moving them, so "Browse other dogs" just navigates.
  13 new unit tests over the four statuses, absence, and the declined-with-matchedDogId-intact case.
  **Unverified, honestly:** exactly what RS-10's row said, for the same reason — the two-party
  signed-in path needs a real shelter account and a real `applications` row, and neither exists
  (RS-5b). Nothing here was exercised against a live document; the pure layer and the call-site
  wiring are what the tests cover.
- 2026-09-03 — RS-11 (follow-up) — PR #__ — **The two RS-11 screens a walkthrough can't reach are
  now rendered in a test.** Driving the app end to end (guest → onboarding → apply → shelter ticks →
  pickup → Care Plan, in `LOCAL_MODE` against the committed roster) exercises exactly **one** of the
  four statuses — absence — because `status` only ever arrives from Firestore and a guest journey has
  no application document. It did confirm two things off the queue item: absence renders as
  "⏳ Waiting on shelter review" rather than a decline, and withdraw still works with no application
  row (`matchedDogId` cleared, no console error). `MatchView.test.tsx` covers the rest with
  `renderToStaticMarkup` and three mocked hooks — **no jsdom, no new dependency**, following
  `lib/markdown.test.tsx`. Six cases; the two that matter are a declined application removing the
  scheduler and the Care Plan hand-off, and an `approved` status leaving `🔒 Schedule pickup` locked.
  **Both were negative-controlled** — neutering `approvalDecision`'s declined branch fails exactly
  the two declined cases, and letting `approved` unlock the scheduler fails exactly that one — so
  they are not passing vacuously. Still unverified: the two-party signed-in path (RS-5b).

---

## RS-5b and RS-6b's "Needs a human" entries, as they stood after the 2026-09-04 sitting

- **RS-5b — DONE 2026-09-04, with Sharang present. The `||` rule serves the staff list query.**
  Sharang ran `gcloud auth application-default login` and signed in to the deployed app; the
  session then wrote the three fixtures with `scripts/seed_test_applications.py` and opened
  `https://pawthway-hackathon.web.app/shelter` as the uid in `shelters/sfspca-mission`.
  **All three rows rendered** — no `permission-denied` — so the staff branch of `applications`'s
  read rule does serve `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the
  RS-7/RS-9 index. The `(deleted account)` fixture renders as an ordinary withdrawn row, which
  is the PH-15 redaction state the inbox was built to handle and had never actually been shown.
  Ticking a shelter-owned item and pressing **Mark approved** both wrote successfully, so the
  staff *update* branch works too. `applications` now holds three `fixture-`-prefixed documents
  in production; they have fixed ids, so re-running the seeder resets them rather than
  duplicating, and nothing but a manual delete removes them.
  *The old text of this item, for reference:*

- **RS-5b (original) — Seed the fixtures and settle the `||`-rule question.**
  Two commands and one sign-in, and it retires the last open question under RS-5:
  `GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_test_applications.py`
  (committed, `--dry-run` first if you want to see the three rows), then open
  `https://pawthway-hackathon.web.app/shelter` signed in as the uid in
  `shelters/sfspca-mission`. Either the rows render — the staff branch of `applications`'s read
  rule serves the list query — or it comes back `permission-denied`, which the inbox now has
  its own copy for. **Write down which happened.** If it is denied, that is a finding to queue,
  **not** licence to widen `firestore.rules`. The unattended run could script this but not run
  it: writing to production Firestore is blocked for a session with nobody present to approve it.

- **RS-6b — PARTIALLY DONE 2026-09-04; the write half is still open.** In the same signed-in
  sitting as RS-5b: `/shelter/dogs` loaded and listed all **19** SF SPCA dogs for the staff
  account, and the add-a-dog form renders and accepts input — so the staff *read* path over
  `dogs` works. **Not exercised, and still needing a human:** actually submitting the form
  (a real write to the live `dogs` collection that fosters would see in Discovery), retiring a
  dog, and the console `updateDoc` test that a different `shelter_id` is refused. The session
  deliberately filled the form and stopped rather than write a real animal into the production
  roster without being asked to. The three checks below are what remains.

- **RS-6b (remaining) — the `dogs` write rule, signed in.**
  Do it in the same sitting as RS-5b and RS-8; it is the same sign-in. Open
  `https://pawthway-hackathon.web.app/shelter/dogs` as the uid in `shelters/sfspca-mission` and
  (1) add a dog with the photo field blank — it should appear in foster-side Discovery with the
  SF SPCA card and a paw tile, not a placedog photo; (2) retire it — it should leave Discovery
  and stay readable by id; (3) from the console, try `updateDoc` on that dog with a different
  `shelter_id` and confirm `permission-denied`. **Write down what happened.** A denial anywhere
  in (1) or (2) is a finding to queue, never licence to widen `firestore.rules`.

