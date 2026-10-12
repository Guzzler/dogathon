# production-hardening Ledger rows PH-31 and PH-32 — archived verbatim 2026-10-11

Moved to make room for PH-36's spec; compressed in the working doc to one row.

- 2026-09-27 — PH-31 — PR #106 — **a dog that isn't listed can't be applied to, and a failed
  application no longer strands the foster on Match.** Both apply sites' `canApply` is now
  `isListable()` — the same test Discovery uses — so a saved or deep-linked dog that is `retired`,
  `adopted`, `ready_for_adoption`, `foster` or `medical_hold` shows *Not taking applications*
  (PH-28 had already put the status half into `isListable()`; the sites weren't calling it). Both
  `apply()`s write `createApplication()` **before** `patchFoster()`, RS-14's order; a throw shows
  "That didn't reach {shelter}, so you haven't applied yet" (MatchView's `pickupFailed` wording and
  style) and writes nothing else. `createApplication()`'s silent return on a missing `shelterId`
  is a throw. `LOCAL_MODE` (no uid) still commits the foster record alone. Verified: 198 vitest (8
  new — every non-`available` status and a null-shelter dog in `isListable`, and a new
  `SavedView.test.tsx` rendering a liked dog in each status plus `petsun`), `tsc -b`, build, lint
  at `main`'s 8. **Not verified in a browser:** the committed roster is all `available`, so no
  local walk reaches the disabled state, and the failure branch needs a Firestore write to fail.
- 2026-10-09 — PH-32 `[large]` — PR #122 — **the shared adoption link shows what the foster
  published, to everyone, the sender included — for exactly as long as the shelter's confirmation
  holds.** New `adoptionProfiles/{dogId}`; `firestore.rules` runs one `publishAuthorized()`
  (application has this `fosterId` and `dogId`, a non-null `pickupConfirmedAt`, status not
  `declined`/`withdrawn` — so RS-22's `completed` is admitted with no rules edit) on `get`,
  `create` and `update`; `list` is owner-only; update/delete only by the stored author.
  `lib/adoption.ts` gains `publishedPart` / `withPublished` / `samePublished` (key-order-proof, so
  **Publish changes** means a change); `applicationView.ts` gains `authorizesPublishing`, the
  client twin of the rules predicate; new `lib/adoptionProfiles.ts`. `PublicAdoptionView` renders
  the shelter-only profile with the snapshot over it and no longer reads the viewer's foster
  document; `AdoptionProfileBody` takes `audience` with the three reader empty states, and the
  foster copy no longer says *starred* notes are summarised. Post Foster: **Publish** / **Publish
  changes** card, and the plan-amended *{shelter} hasn't confirmed your pickup, so this link shows
  only {shelter}'s record* in its place where the predicate fails; the share sheet says the same
  before a first publish. Deletion takes published pages down first; export includes them; Saved's
  withdraw unpublishes. **Surprises / departures:** plan amended the gate *while this was being
  built* (PR #121 merged under the open branch) — the first cut had `read: if true` and had noted the
  undo-leaves-it-public gap as unfixed; the amendment closed it and the rebased PR implements it.
  Because a withdrawn application now hides its page from `get`, `unpublishAdoptionProfile` finds
  the page through the owner's `list` query (`fosterId` + `dogId`, no index) rather than reading it.
  `get` also admits `resource == null`, so an unpublished link degrades to the shelter's record
  without a permission error — it exposes nothing. `publishAdoptionProfile` takes `fosterId`
  explicitly. `LOCAL_MODE` keeps the own-data page as its own component and now passes the careLog
  entries the old view dropped. Verified: 281 vitest (15 new — 5 helpers, 3 `authorizesPublishing`,
  2 `PublicAdoptionView.test.tsx` incl. a `useFoster` mock that throws if the page reads it, 5
  `PostFosterView.test.tsx`), `tsc -b`, build, lint at `main`'s 8, and `firestore.rules` compiled by
  `firebase deploy --only firestore:rules --dry-run` (nothing released). **Not verified in a
  browser** — the unattended run's dev-server start was declined — **nor against live rules**:
  that is PH-32b.
