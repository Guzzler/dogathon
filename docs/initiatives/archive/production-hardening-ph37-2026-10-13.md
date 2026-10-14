# PH-37 spec, archived verbatim 2026-10-13 at ship time

From `production-hardening.md`'s Task queue. The Ledger row there is what shipped.

- [ ] **PH-37 `[large]` — queued 2026-10-13: Past fosters, and the page its author can no longer
  reach.** The repo's `[large]` slot (routing note in `real-data-and-shelters.md`). Ship **RS-23**
  in the same PR as its rider: without it this screen names dogs the next import deletes.
  **Grounding, re-read against `main` at `9d153f6`:** `fosters/{uid}/journeys` has no reader but
  account export and deletion (`auth.ts:198`, `:231`; `types.ts:258` says *"Nothing reads these
  yet"*). Worse, the one write that outlives a journey has no surface either: `PostFosterView`
  resolves everything off `foster.matchedDogId` (`:27`-`:47`), Saved's Applications tab counts
  `matched ? 1 : 0` (`SavedView.tsx:48`), and the only `unpublishAdoptionProfile` caller is
  Saved's **Withdraw** on the *live* application (`:236`) — which RS-22 replaced with **Browse other
  dogs** once `completed`. So a foster who published dog A's page and applies for dog B has a
  public page about A, still authorized by A's `completed` application (`publishAuthorized()`),
  that they can neither find nor take down. **Design answer: *a foster's records outlive the
  pointer, and so does their authorship* — every filed journey is readable by its foster, and
  every page they published is reachable by the one person who can take it down.**
  - **Data:** `web/src/hooks/useJourneys.ts` — signed in, `onSnapshot` on `fosters/{uid}/journeys`
    (uid from `fosterDocId()`), newest `archivedAt` first; guest/`LOCAL_MODE`, `readLocalJourneys()`.
    Outcome from the foster's own applications (`where("fosterId", "==", uid)` — the rules'
    `fosterId == auth.uid` branch admits it; `auth.ts` already runs the query), latest per `dogId`;
    published pages from `publishedByFoster(uid)` (`adoptionProfiles.ts:61`). Pure assembly in
    `web/src/lib/history.ts` — `pastFosters(journeys, dogs, applications, published)` → cards.
    *(2026-10-13, second pass)* **Both Firestore reads run only when `fosterDocId()` is non-null**;
    otherwise pass `[]`. In `LOCAL_MODE` `firestore` is `null` (`firebase.ts:16`) and
    `publishedByFoster` has no guard of its own, so an unguarded call throws on the very path the
    verify step drives. `useApplication.ts:31` is the pattern; degrade a refused read to `[]`.
  - **One card per journey, not per dog** (auto-id exists because a dog can be fostered twice).
    Dog via `normalizeDog`; a missing dog document renders *This dog's listing is no longer on
    file* with the journal intact — never a guessed name. Outcome only from the application:
    `completed` → *Fostered* with `pickup.date` → `completedAt`, `withdrawn` → *You withdrew*,
    `declined` → *{shelterName} declined*; **no application → no outcome line** (guest journeys,
    legacy records). Never infer one from `readyForAdoption`.
  - **Detail, `/history/:journeyId`** (in `App.tsx` beside `post-foster`, inside the gate):
    the archived journal oldest first, read-only, and weigh-ins/vet visits from `careLog` matched
    with **strict `entry.dogId === journey.dogId`** — *not* `belongsToDog`, which deliberately
    counts an untagged entry as the *current* journey's. If a page is published for that dog:
    copy-link to `/adoption/{dogId}` and **Take it down** (`unpublishAdoptionProfile(dogId, uid)`,
    confirm first). **Nothing archived is editable, and there is no re-publish from history
    (decided 2026-10-13):** a journey is what was written while the dog was there, and a page is a
    snapshot taken at **Publish**, so editing one never changes the other. Take-down is the one
    control an author needs to stay safe; correcting a page after the pointer moved waits for a
    real foster to ask.
  - **Entry points:** a Hub card *Past fosters (n)* when n > 0, and a line under Saved's
    Applications tab linking to it. Reuse existing `card`/`Unrecorded` classes; no new palette.
  - **Verify:** `history.test.ts` per branch (missing dog, two journeys one dog, each status, no
    application, strict care-log match vs. an untagged entry, published vs. not); vitest, tsc,
    build, lint at `main`'s count. Then in `LOCAL_MODE` (no `web/.env`) via the dev preview: apply
    for a dog, write a journal entry, withdraw, apply for another — expect the Hub card, the first
    dog on `/history`, and the entry on its detail. Signed-in half is **PH-37b**, parked below.

