# PH-32 `[large]` — spec as queued, with plan's 2026-10-09 amendment (archived verbatim 2026-10-09, the day it shipped)

Archived from `production-hardening.md`'s Task queue by execute in the same PR as the code. The Ledger row there is what shipped, including where it departed from this.

- [ ] **PH-32 `[large]` — the shared adoption link shows what the foster published (confirmed and
  specified by plan 2026-10-08, re-read at `306e2d6`).** Execute's audit found it on the deployed
  app; every line re-read against `main`:
  - `PublicAdoptionView.tsx:19-25` reads journal, schedule, `adoptionNote` and `adoptionHighlights`
    through `useFoster()` — the **viewer's** document — and uses them only when
    `foster?.matchedDogId === id`. `firestore.rules:32-33` scopes `fosters/{uid}` to its owner, so
    no recipient could read it even if the view asked. Every person the share sheet reaches sees the
    shelter's record plus empty states that read as *nothing happened*.
  - **One more than the audit named:** `PublicAdoptionView.tsx:31` passes `[]` for `careLog`
    entries even for the sender, while `PostFosterView.tsx:30` passes them — so weigh-ins and vet
    visits never reach the shared page for anyone, the sender included. The two views already
    disagree about what the page is.
  - The sender previewing their own link sees their own data, so the one person who could notice
    cannot. The empty-state copy at `AdoptionProfile.tsx:62, :128, :197` is foster-addressed, and
    :62 says *starred* notes are summarised, against the rule that the summary reads every entry.

  **Design answer: a shared page shows what its foster *published*, and the sender sees exactly
  what the reader sees.** The content moves to a place a stranger may read — `adoptionProfiles/{dogId}`
  — by an explicit **Publish**, never by syncing on every change: a journal is written for oneself
  (an address, a neighbour's name, a bad night), and nothing in it should become public because it
  was typed. The write is pinned to the **shelter's** act, not the foster's claim: `matchedDogId` is
  foster-writable, so a rule keyed on it lets anyone publish a page for any dog; a live application
  carrying `pickupConfirmedAt` is a stamp only staff can set (RS-14/RS-15 rules). A new, scoped
  branch — `fosters/{uid}` stays exactly as it is.

  **Amended by plan 2026-10-09, before execute started it (citations re-read at `8e0e0ab`, all
  hold).** The write was pinned to the shelter's act and the read was `if true`, so a page would
  outlive the act that authorized it: staff **Undo confirmation** or a decline leaves a stranger's
  notes public on a dog they never took home, and staff can't delete a foster's document. **A
  published page is visible exactly as long as the act that authorized it holds** — the read
  is gated on the same predicate as the write, evaluated by rules at read time (a rules `get()`
  is not subject to the target's own read rule), so no staff-side cleanup path is needed. And
  the predicate is *stamped and not `declined`/`withdrawn`*, not *live*: RS-22 adds `completed`,
  and a finished foster's page must stay up exactly when the dog is relisted for adoption.

  **Spec.**
  1. `firestore.rules`: `match /adoptionProfiles/{dogId}`, with one function `authorized(appId,
     fosterId)` — the application `get()`-ed at `appId` has that `fosterId`, `dogId == dogId`,
     a non-null `pickupConfirmedAt`, and `!(status in ["declined","withdrawn"])`. `get: if
     authorized(resource.data.applicationId, resource.data.fosterId)` — for everyone, owner
     included; `list: if` signed in and `resource.data.fosterId == request.auth.uid` (only
     `deleteAccount`'s query needs it; strangers may not enumerate). `create`/`update` when signed
     in, `request.resource.data.fosterId == request.auth.uid` and `authorized(request.resource.data
     .applicationId, request.auth.uid)`; `update` additionally needs `resource.data.fosterId ==
     request.auth.uid`; `delete` only by `resource.data.fosterId`. Comment the derivation, as the
     `applications` branch does.
  2. `lib/adoption.ts`: `publishedPart(profile, tags, summary)` → the foster-sourced fields only
     (`journalNotes`, journal-sourced `photos`, `careDone`, `careOutstanding`, `milestones`,
     `medical`, `weight` when its source is `"care plan"`, `fosterNote`, `tags`, `summary`) — never
     the shelter's fields, which the public view keeps reading live off `dogs/{id}`.
     `withPublished(profile, snapshot | null)` overlays it onto `buildAdoptionProfile(dog, null, …)`;
     `null` returns the shelter-only profile unchanged.
  3. `lib/adoptionProfiles.ts` (new): `publishAdoptionProfile(dogId, applicationId, part)` (`setDoc`
     with `fosterId`, `publishedAt`), `unpublishAdoptionProfile(dogId)`, and a
     `usePublishedProfile(dogId)` hook whose `onSnapshot` error callback degrades to `null`.
     `LOCAL_MODE`: no-op publish, `null` read — the local page keeps today's own-data behaviour.
  4. `PostFosterView.tsx`: a **Publish** button (first time) / **Publish changes** (when
     `publishedPart(live)` differs from the snapshot) with *Published {date}* beside it. Before a
     first publish the share actions say *Until you publish, this link shows only {shelter}'s
     record* rather than sharing silently. The application id comes from `useApplication`.
     *(2026-10-09)* Where that application fails item 1's predicate, render *{shelter} hasn't
     confirmed your pickup, so this link shows only {shelter}'s record* in place of the button —
     the sender reads the snapshot through the same gated `get`, so they see what readers see.
  5. `PublicAdoptionView.tsx`: render `withPublished(buildAdoptionProfile(dog, null, [], [], []),
     usePublishedProfile(id))` — for everyone, the sender included. Drop the `useFoster` /
     `useJournal*` reads.
  6. `AdoptionProfile.tsx`: `AdoptionProfileBody` gains `audience: "foster" | "reader"` (default
     `"foster"`). Reader copy at the three sites: *No journal notes have been published for {dog}.*,
     *The foster hasn't written a note for adopters.*, *No care has been published yet.* Fix :62's
     foster copy to say every note is summarised, not starred ones.
  7. `web/src/auth.ts`: `deleteAccount()` deletes `adoptionProfiles` where `fosterId == uid` before
     the foster document goes; `exportAccountData()` includes them. The foster's withdraw
     (`setApplicationStatus(…, "withdrawn")` from the foster side) calls `unpublishAdoptionProfile`
     — a withdrawn foster's notes come down with the application.

  **Not in scope:** photo upload (journal entries still carry `imageColor` only, `careplan/types.ts:77`);
  the agent's `dogs/{id}.adoption_profile` paragraph (already public and attributed, PH-21);
  showing the snapshot shelter-side. **Verify:** vitest — `publishedPart` drops every shelter
  field and keeps a weight only from the care plan; `withPublished(p, null)` equals `p`; a
  `PublicAdoptionView.test.tsx` rendering with a snapshot (notes shown) and without (reader empty
  states, none of the foster-addressed strings); `PostFosterView` shows **Publish** with no
  snapshot and **Publish changes** after a journal edit. `tsc -b`, build, lint at `main`'s 8. The
  rules branch can't be verified unattended (no emulator in CI) — its live check is **PH-32b**
  under "Needs a human": as the confirmed test foster, publish; as a second account, `setDoc`
  `adoptionProfiles/{that dog}` and expect `permission-denied`; signed out, open the link and see
  the notes.
