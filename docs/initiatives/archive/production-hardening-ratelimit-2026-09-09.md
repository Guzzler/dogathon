# Archive — production-hardening.md, the PH-11 rate-limit decision (verbatim, 2026-09-09)

Snapshotted so the working doc could hold PH-17's design answer without crossing the
README's ~400-line threshold. The decision is shipped and restated by PH-11's ledger row;
what is kept in the working doc is the decision, the two constants that must move together,
and the condition for revisiting it. Archives are append-only — correct the working doc.

---

## What the rate limit means with more than one instance (decided 2026-08-30, PH-11)

**Option (b): keep the bucket in memory and divide the budget by the maximum
instance count.** `server.py` now carries three constants instead of one —
`CHAT_REQUESTS_PER_MINUTE_BUDGET = 20` (what a foster is allowed, in total,
across the whole service), `MAX_CLOUD_RUN_INSTANCES = 1` (which must equal
`--max-instances` in `deploy-backend.yml`), and `CHAT_REQUESTS_PER_MINUTE`
derived from the two. Raising the flag without raising the constant is still
possible, but it is now visibly wrong in a diff and called out by a `!!` comment
block in both files — including next to the flag itself, which is where someone
will actually be editing when they get it wrong.

**Why not (a), the Firestore-backed bucket.** It is the correct answer at any
instance count and it was genuinely close. It lost on scope, not on cost: the
read+write per chat request is small next to the model call in the same turn, but
it makes the spend brake depend on Firestore being up, and `_await_approval`
already establishes that a Firestore failure has to fail *closed*. A rate limiter
that fails closed on a Firestore blip turns a database hiccup into "you can't talk
to the assistant"; one that fails open stops being a spend brake at the exact
moment something is going wrong. Neither is a good answer, and picking between
them is a bigger question than max-instances=2 deserves. Revisit (a) if the
instance count ever stops being a small fixed number — that is the condition, and
it is written down here so it doesn't have to be re-derived.

**What (b) costs, stated plainly:** a foster whose requests all land on one
instance is throttled at the divided number, not the budget. At
`--max-instances=2` that is 10/minute rather than 20 for an unlucky foster.
Over-throttling one person is recoverable; multiplying spend by the instance count
is the failure that has no floor.

**Today the division is by 1, so nothing changed numerically.** That is correct
and not a hedge: `--max-instances` is still 1 on `main`, and PH-13 (a human's) is
what raises both numbers together.
