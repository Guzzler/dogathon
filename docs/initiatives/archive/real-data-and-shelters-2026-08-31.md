# Archive — real-data-and-shelters, 2026-08-31

Verbatim snapshot of the RS-9 entry as it stood in the working doc, moved here
on 2026-08-31 when the doc crossed the README's ~400-line threshold. RS-9 is
closed and its reasoning had stopped being read; the working doc keeps a
two-line pointer. Archives are append-only — if something here turns out to be
wrong, correct the working doc and say so there.

## RS-9 — the composite index, and the IAM grant it needed

- **RS-9 — DONE 2026-08-29, by Sharang, in-session.** Kept here rather than
  deleted because the sequence is worth not re-deriving. RS-7's target ran and was
  refused: `403, The caller does not have permission` (run 33240631397) — the deploy
  service account had `roles/datastore.user`, which reads and writes documents but
  cannot create composite indexes. Sharang granted
  **`roles/datastore.indexAdmin`** to
  `github-deploy@pawthway-hackathon.iam.gserviceaccount.com` and asked for it to be
  applied in-session; the invocation is in the runbook note below. Re-ran
  `deploy-frontend.yml` (run 33243275175): the `Deploy Firestore indexes` step is
  green and logs *"deployed indexes in firestore.indexes.json successfully for
  (default) database"*. Then waited out the asynchronous build and confirmed the
  index actually **serves** — `gcloud firestore indexes composite list` went
  `CREATING` → `READY` for `shelterId, createdAt, __name__` on the `(default)`
  database. That last check is the one this initiative kept saying was outstanding;
  it is now done, and by reading the index's real state rather than a deploy's exit
  code. **RS-5 is unblocked.**

  For the record, since "pull the key from GitHub and do it" was the first idea:
  **a GitHub Actions secret cannot be read back.** `gh secret list` returns names
  only — that's GitHub's design, not a permissions problem — so there is no path
  where CI's `GCP_SA_KEY` gets pulled down to do a one-off admin action, and
  wanting one is a smell. Use a human's own `gcloud` credentials, which is what
  happened.

