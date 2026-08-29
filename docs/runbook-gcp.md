# GCP runbook

One-off administrative actions against the `pawthway-hackathon` project that
aren't in any workflow, written down so they're reproducible rather than living
in one person's shell history. Everything here needs a **human's own** `gcloud`
credentials (`gcloud auth login`), not CI's service account.

**A GitHub Actions secret cannot be read back.** `gh secret list` returns names
only — that's GitHub's design, not a permissions problem. So there is no path
where the CI deploy key is pulled down to run an admin command locally, and
looking for one is a sign the command should be run as a person instead.

## The deploy service account

`github-deploy@pawthway-hackathon.iam.gserviceaccount.com` is what
`deploy-frontend.yml`, `deploy-backend.yml` and `import-dogs.yml` authenticate
as, via the `GCP_SA_KEY` repository secret.

List what it currently holds:

```bash
gcloud projects get-iam-policy pawthway-hackathon --flatten="bindings[].members" --filter="bindings.members:github-deploy@pawthway-hackathon.iam.gserviceaccount.com" --format="value(bindings.role)"
```

### Firestore index admin (added 2026-08-29, RS-9)

`roles/datastore.user` can read and write documents but **cannot create
composite indexes** — a `firebase deploy --only firestore:indexes` fails with
`403, The caller does not have permission`. Creating them needs
`datastore.indexes.create`:

```bash
gcloud projects add-iam-policy-binding pawthway-hackathon --member="serviceAccount:github-deploy@pawthway-hackathon.iam.gserviceaccount.com" --role="roles/datastore.indexAdmin"
```

## Firestore indexes

`firestore.indexes.json` is the source of truth and deploys from
`deploy-frontend.yml`'s own step. Index builds are **asynchronous**: the deploy
returns before an index is serving, so a query can still fail
`failed-precondition` for a few minutes afterwards on a collection with real
data. Check the real state rather than trusting the deploy's exit code:

```bash
gcloud firestore indexes composite list --project=pawthway-hackathon --format="table(name.basename(),state,fields)"
```

`CREATING` means wait; `READY` means the query will work. Note that a deploy
never *removes* an index absent from the file — that's the safe direction, and
nothing should add a flag that changes it.

## Still not done

**Log-based alerting on the agent backend (PH-7b).** `src/agent/server.py`
logs at `ERROR` severity through `logging.exception` at the failure points that
matter, so the records are already in Cloud Logging; nothing reads them. The
open task is one notification channel plus one log-based alert policy on the
Cloud Run `pawthway-agent` service filtered to `severity>=ERROR`. If you do it
with `gcloud` rather than the console, **paste the invocation into this file**
— that's the whole point of it existing. See
`docs/initiatives/production-hardening.md`.
