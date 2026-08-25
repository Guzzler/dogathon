# Production hardening

The security hole is closed (PR #9) and spend has a ceiling (PR #7). What's
left here is quieter: places the app tells a foster something that isn't
true, or loses something a real person would mind losing. None of it is
visible in a demo. All of it matters the first time a real dog goes home
with a real foster.

## H1 — Agent sessions are mitigated, not fixed

`src/agent/server.py` keeps one in-memory `Agent` and one approval
`queue.Queue` per foster uid. `deploy-backend.yml` pins
`--min-instances=1 --max-instances=1`, which was a **correctness** fix (a
second instance could swallow an `/approve` that a `/chat` elsewhere was
blocked on — see the comment above the flag in the workflow) not a cost one.
It removes the acute failure. It does not mean sessions survive:

- A redeploy (every merge to `main` that touches `src/**` triggers one)
  drops every in-flight conversation.
- The backend is now a documented single point of failure.

**Real fix:** move `Session.agent`'s message history and the pending-approval
flag into Firestore, keyed by uid, alongside the foster's own document. That
also gives fosters conversation history that survives a deploy, which they
don't have today. Once state is durable, the instance pin can be lifted.

## The notification that doesn't notify

`src/agent/builtin/adoption.py`, `send_adoption_profile_to_shelter`:

```python
return {"dog_id": dog_id, "status": "ready_for_adoption", "notified_shelter": True}
```

It flips `dogs/{id}.status` and returns `notified_shelter: True`. Arcade
isn't configured in production (`GET /health` reports
`"arcade_available": false`), so there is no Gmail/Slack path — nobody is
notified. The tool's own docstring already says the honest thing ("this
status update alone is the notification"); the return value doesn't. The
agent tells a foster their dog's profile went to the shelter. With SF SPCA's
real dogs in the roster (PR #6), that's no longer a white lie about demo
data.

## No account deletion or export

Confirmed absent — nothing in `web/src` or `src/agent` implements it. The app
now stores real names, addresses, and pickup locations behind Google
sign-in. This has a legal dimension (data-subject deletion/export requests),
not just a nice-to-have one, the moment a second real person's data is in
Firestore.

## No error tracking

Cloud Run logs only. Combined with the single-instance pin above: one wedged
instance is the whole backend, and the first signal you'd get is a foster
telling you chat is broken.

## Two smaller ones, deliberately low priority

- **Guest→account migration.** A guest who completes onboarding, saves
  dogs, then applies (which requires signing in) lands in a fresh empty
  account — `web/src/lib/session.ts` has no `linkWithCredential` path.
  Deprioritized by Sharang (2026-08-23) rather than silently dropped; still
  worth a small fix.
- **`tsconfig.app.json` has no `"strict"`.** `tsc -b` in CI (PR #8) catches
  far less than it looks like — `string | null` flows into `string`
  unchallenged. Flipping it will surface real errors across the codebase, so
  it's its own PR, not a drive-by.

## Task queue

- **PH-2 (2026-08-24).** Account deletion. A `DELETE /account` endpoint (or
  a client-side Firestore delete + `auth.currentUser.delete()` if simpler
  given no admin panel exists yet) that removes `fosters/{uid}`, its
  `careLog` subcollection, and the Firebase Auth user. Exposed from
  `AccountSheet.tsx` behind a confirmation, not auto-discoverable enough to
  fire accidentally. Verify: create a throwaway account, delete it, confirm
  the Firestore doc and subcollection are gone and the uid can no longer
  sign in to see old data.
- **PH-3 (gated on M2 of `real-data-and-shelters.md`).** Firestore-backed
  agent sessions (the H1 real fix above). Gated because it touches the same
  `server.py` session code that shelter-side auth work will also touch —
  sequence after that lands to avoid two agents rebasing the same file
  twice in one week. Until then H1 stays at "mitigated."

## Ledger

- 2026-08-24 — PH-1 — PR #__ — `send_adoption_profile_to_shelter` now
  returns `notified_shelter: arcade_tools.available()` instead of a
  hardcoded `True`; `PAWTHWAY_SYSTEM` tells the model to say plainly when
  nobody was notified. Did the smaller return-value + prompt fix, not a
  new notification path (that stays open if Arcade gets configured later).
