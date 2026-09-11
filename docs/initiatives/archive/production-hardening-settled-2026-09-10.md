# Archive — production-hardening: three settled sections (2026-09-10)

Snapshot taken 2026-09-10, verbatim, from `docs/initiatives/production-hardening.md`:
"What deletion left behind, and what an application does about it", "No error tracking",
and "Two smaller ones — both resolved". Archived together because the same run's PH-17/PH-18
edits carried the working doc to 445 lines, and because all three are the 2026-09-02 shape —
each is restated by something shorter that is still live: PH-14/15/16's ledger rows and
[`production-hardening-deletion-2026-08-30.md`](production-hardening-deletion-2026-08-30.md)
restate the first, **PH-7b** under "Needs a human" restates the second in more operational
detail than the narrative did, and PH-4's and PH-5's ledger rows restate the third.
Archives are append-only; if something here turns out to be wrong, correct the working doc
and say so there.

### What deletion left behind, and what an application does about it — archived 2026-08-30

Reading `deleteAccount()`, `firestore.rules` and `server.py` against `main` on
2026-08-30 turned up two things a deleted account left behind, and both were
structural rather than an oversight to patch in place:

- **The agent transcript** (`fosters/{uid}/agentSession/current`) survived, because
  deleting a document doesn't delete its subcollections — a verbatim dump of
  everything the foster typed, unreachable forever once the uid stopped existing.
  Shipped as PH-14: `POST /reset` clears it through the Admin SDK, and the call goes
  first, while an ID token can still be minted.
- **The `applications` rows** survived carrying `fosterName`, with no `delete` rule to
  remove them. The decision was **redact, don't delete** — the absent delete rule is
  right, because an application is a two-owner record and must not vanish out from
  under a staff member mid-review. Shipped as PH-15 (`"(deleted account)"` +
  `status: "withdrawn"`) and PH-16 (pin the other fields, leave `fosterName` free).

The full reasoning — including why export and deletion are different questions, and
why `applications`'s update rule must stay loose about `fosterName` specifically — is
in the [archive](archive/production-hardening-deletion-2026-08-30.md). Read it before
tightening that rule.

## No error tracking

Cloud Run logs only. Combined with the single-instance pin above: one wedged
instance is the whole backend, and the first signal you'd get is a foster
telling you chat is broken.

**Sharpened 2026-08-28, and there is now a second reason to care.** The
codebase already does the *logging* half competently — `server.py` calls
`logging.exception` at each of the failure points that matter (the stream
failure at `:300`, the session-persist failure at `:332`), so the information
exists in Cloud Logging. What is missing is anything that *reads* it. That's
a cheap gap to close relative to its value, and it just got demonstrated in
the adjacent repo surface: the design-token guard in `ci.yml` printed
`fatal: ... no merge base` on four consecutive runs while reporting success,
and nobody noticed for a day, because nothing reads logs that don't fail
anything (see `design-consistency.md`, DC-3). The same shape of blindness
applies to the backend, with a foster on the other end of it. → PH-7.

## Two smaller ones — both resolved

- **Guest→account migration — 2026-08-26 (PH-5, PR #29).** A guest is pure
  `localStorage` with no Firebase Auth session, so there was never anything to
  `linkWithCredential`; `migrateGuestData()` copies the local `Foster` and care log
  into `fosters/{uid}` on first sign-in, only when that doc doesn't already exist.
  The README's "already decided" list carries the corrected framing.
- **`tsconfig.app.json` strictness — 2026-08-26 (PH-4, PR #27).** `"strict": true`
  made explicit. It was already on (TypeScript 6 defaults it), so this is a pin
  against a silent future regression, not a fix. *(When re-checking, use
  `./node_modules/.bin/tsc` — `npx tsc` resolves to an unrelated `tsc@2.0.4` that
  prints a banner and exits 1 without compiling.)*
