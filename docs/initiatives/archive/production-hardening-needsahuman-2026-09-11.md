# Archived 2026-09-11 — `production-hardening.md`, the "Needs a human" block

Verbatim snapshot. Archived because the README's 2026-09-11 doc-size note called this doc
"structurally at its ceiling" and named this block as the thing to archive next rather than
hunting for prose to trim. **Nothing here is discharged** — all three items are still parked and
still want a signed-in human. Read this file, not the one-line pointers in the working doc,
before acting on any of them.

---

### Needs a human — PARKED, not pending

**Read this before adding to the list below (2026-08-31).** These accumulate faster than
anyone clears them — PH-15 and PH-16 generated PH-15b on the run that shipped them. Per the
README's "nobody uses this app yet" section they are **parked**: nobody is blocked by the
unverified behaviour, and several will answer themselves once a real shelter exercises the
same rules. Do not queue them, and do not read the length of this list as debt.
**PH-7c — DONE 2026-08-31**, the one cheap enough to just do because it needed no sign-in:
the deployed agent's `/health` returns `firestore_reachable: true`. PH-13 still wants a
`/health` hit for a different reason, so that half is not discharged by it.

- **PH-15b (2026-08-30) — run PH-15's redaction write against the deployed project.**
  PH-15 shipped; its verification did not, and an unattended run has no way to do it:
  the only sign-in is a Google popup, the Firestore emulator needs a JRE that isn't
  installed here, and both popup-free routes to an ID token (creating a test account,
  minting a custom token off the service-account key) are off-limits to this loop.
  What was done instead is a close read of `firestore.rules:49-51`, which says the
  write *should* pass — a reading, not a result. Signed in as a test foster with at
  least one application, from the browser console on `https://pawthway-hackathon.web.app`:
  four writes, one session. The `{ fosterName, status: "withdrawn" }` write succeeds;
  the same write without the status change comes back `permission-denied`; with PH-16's
  tightened rule live the redaction must **still** succeed (PH-15's path riding on the
  deliberately-unpinned `fosterName`); and a withdraw that also changes `shelterId` must
  now be denied. **Record the answer here.**

- **PH-13 (2026-08-29) — lift the instance pin, now that PH-10 and PH-11 have landed.**
  Raise `--max-instances` from 1 to **2** in `deploy-backend.yml` (leave
  `--min-instances=1`), in its own small PR, and rewrite the long comment above the flag
  to say what was confirmed rather than what was expected. Not queued for execute:
  merging deploys to production immediately (`deploy-backend.yml` is path-triggered),
  and what makes it safe can only be confirmed by a person driving two browsers. Confirm
  and record both — `/health`'s `active_sessions` differing across two hits (proof there
  really are two instances), and one dangerous-tool approval issued in one session and
  answered such that the parked turn resumes. That second one is PH-8's actual claim and
  has never been observed.

- **PH-7b — the alerting half of PH-7.** Nothing in the agent backend's failure path
  reaches a person. The logging side is already correct — `server.py` calls
  `logging.exception` at the stream failure (`:300`) and the session-persist failure
  (`:332`), so the records exist in Cloud Logging at `ERROR` severity. What's missing is
  one alert that reads them. Deliberately **not** queued: creating an alert policy and
  notification channel is a hard-to-reverse change to shared GCP infrastructure that
  sends real email and carries quota implications, and an unattended run declined it on
  exactly those grounds (PR #33). That was the right call; re-queueing it would produce
  the same refusal. Roughly: in `pawthway-hackathon`, a notification channel for
  Sharang's email, then a log-based alerting policy on the Cloud Run agent service
  filtered to `severity>=ERROR`. **If you do it via `gcloud`, add the invocation to
  [`docs/runbook-gcp.md`](../runbook-gcp.md)** — that file exists (RS-9 wrote the first
  entry), so this needs a section, not a new doc. Out of scope even then: uptime checks,
  a status page, Sentry, instance pins.
