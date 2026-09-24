# Archived verbatim 2026-09-23 — RS-14's queue entry and design answer

Snapshot from `docs/initiatives/real-data-and-shelters.md` at the moment RS-14 shipped, per the
README's doc-size rule (a shipped `[large]` item's spec and its ledger row are two tellings of one
story; the working doc keeps the shorter). Nothing below was edited.

- **RS-14 `[large]` — the pickup request reaches the shelter, only the shelter confirms it, and the
  chat stops speaking as the shelter. Queued 2026-09-22; the first `[large]` item in this doc since
  RS-12 (2026-09-05).** Grounded against `main` at `e08c684` — design answer directly below. Five
  parts, one PR, because any subset leaves a promise nobody answers:
  1. **Schema + rules.** `Application` (`types.ts:172`) gains `pickupConfirmedAt: {toMillis():
     number} | null`; `createApplication()` (`lib/applications.ts:23`) writes it `null` beside the
     `pickup: null` it already writes. `firestore.rules`' `applications` update gains a **third
     branch**, the foster's pickup request: `fosterId == auth.uid`; `status` unchanged and one of
     `submitted`/`in_review`/`approved`; `fosterId`, `fosterName`, `shelterId`, `dogId`,
     `createdAt`, `checklist` pinned; and `pickupConfirmedAt` either unchanged *with* `pickup`
     unchanged, or `null` — **a foster can un-confirm by changing the slot and can never confirm**.
     Leave the withdraw branch and its `fosterName` comment exactly as they are.
  2. **Foster write.** `requestPickup(applicationId, pickup | null)` in `lib/applications.ts`
     writes `pickup`, `pickupConfirmedAt: null`, `updatedAt`. `MatchView`'s `confirmPickup` and
     **Change request** (`MatchView.tsx:86`, `:180`) write the application **first** when
     `useApplication` returns one, then `patchFoster({ pickup })` as today — `fosters/{uid}.pickup`
     stays, because LOCAL_MODE has no application and five read sites (`fosterWindow`, Hub, Saved,
     Care Plan, the chat) read it. If the application write throws, surface it and skip the
     `patchFoster`, so the foster never sees a request the shelter can't.
  3. **Composition, fail-safe.** `pickupState(fosterPickup, application)` in `applicationView.ts`
     → `"none" | "requested" | "confirmed"`. **`confirmed` only when `application.pickupConfirmedAt`
     is set *and* `application.pickup` equals `foster.pickup` on date, time and location**; absent
     application → at most `requested`. `activeStage()` takes this state: stage 3 stays "Pickup
     requested" until confirmed, then a fifth stage **"Pickup confirmed"** — both callers
     (`MatchView.tsx:64`, `SavedView.tsx:171`) switch together, which is why `APPLICATION_STAGES`
     is shared.
  4. **Shelter inbox.** `ApplicationDetail` (`ShelterApplicationsView.tsx:175`) renders the
     requested slot or "No pickup requested yet", and a **Confirm pickup** button (the staff branch
     already allows the write) setting `pickupConfirmedAt: serverTimestamp()`, with **Undo** to
     `null`; hidden when `!isActionable(status)`. `ApplicationList` rows show a "Pickup requested"
     pill while requested-and-unconfirmed — the one state staff must act on. Pure helpers beside
     `staffTransitions()`.
  5. **The chat stops impersonating the shelter.** `PAWTHWAY_SYSTEM`'s pickup paragraph
     (`server.py:76-78`) loses "foster coordinator" and "first-person plural for the shelter"; the
     agent speaks as **Pawthway's assistant**, never as the shelter, says it cannot see whether the
     shelter confirmed (the Match screen shows that), and says this chat does not reach the shelter
     if the foster tries to tell them something. `MatchChatView.tsx:61-63` titles the chat as the
     assistant (the shelter's name may appear in the sub-line as the topic, not the speaker);
     **`:74`'s "You're confirmed for …" goes** — PH-23's census missed it — and `:29`'s "message
     the shelter here" with it. `MatchView`'s card drops "message them below to agree the day"
     (`:158`) and the chat entry stops being titled "Message {shelter}" / "Confirm the day".
  **Verify:** vitest for `pickupState` (all three states, the mismatch case, the absent
  application), the shelter-side helpers, and new `MatchView.test.tsx` rendered cases for
  requested/confirmed; `grep -rn "confirmed for\|first-person plural\|foster coordinator" web/src src`
  empty; a pytest asserting the prompt no longer claims the shelter's voice;
  `./node_modules/.bin/tsc -b`, build, lint at `main`'s 8 warnings, `uv run pytest`. There is no
  rules-unit-test harness in this repo — don't add one for this; the rules change is checked by
  reading and by **RS-14b**. **Not in scope, named so nobody rediscovers them:** the countdown
  (`fosterWindow`) still anchors on a *requested* date; "Start care plan" still unlocks on a
  request (gating it would strand LOCAL_MODE, which has no one to confirm); staff have no way to
  propose a different time; `get_foster` doesn't report confirmation. `CLAUDE.md`'s "Once a slot
  is confirmed, an `AgentChatPanel` appears for coordinating with the shelter" goes stale with
  this PR — not this loop's file; say so in the PR body.

### Who answers a pickup request, and who may speak for the shelter (2026-09-22)

PH-23 changed the verb from *Book* to *Request* and was right to. But a request is a promise that
someone will answer, and reading the whole path on `main` found that **nobody can**: the slot is
written only to `fosters/{uid}.pickup` (`MatchView.tsx:87`), which no shelter can read;
`applications/{id}.pickup` has been written `null` by every application ever created and read by
nothing; and the foster branch of the update rule admits only `withdrawn`. The screen already knows
— a comment at `MatchView.tsx:156` says *"no shelter can see it yet"*. What it tells the foster
instead is to "message them below to agree the day", and below is an agent **instructed to answer
as the shelter's foster coordinator, in the shelter's first-person plural, under the shelter's real
name**. So a foster can agree a day with SF SPCA, in writing, and SF SPCA never learns of it.

> **A request must land somewhere its addressee reads, and only its addressee may answer it.** And
> the corollary the chat needs: **a model may help a person talk *about* an organisation; it may
> never talk *as* one.** PH-23's prompt told the agent not to confirm on the shelter's behalf while
> leaving it speaking in the shelter's voice — a ban on one sentence inside an impersonation.

Two decisions follow, both in the spec above. **The request is written twice by one writer, and
disagreement reads as unconfirmed.** RS-10 banned mirroring because two *writers* race; here there
is one writer and the hazard is drift, so `pickupState` requires the two copies to agree before
anything says *confirmed* — the failure direction is "asks again", never "shows up unexpected".
**The item lives here, not in production-hardening**, because its load-bearing half is the shelter
seeing and answering something, which is M3's surface; the chat copy rides along because it is the
same promise told a second way. Per "the part that's a conversation" below, it ships to test
accounts only, like every M3 surface.
