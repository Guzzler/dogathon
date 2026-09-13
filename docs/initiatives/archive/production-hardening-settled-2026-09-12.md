# Archive — six settled sections of `production-hardening.md` (2026-09-12)

Verbatim snapshot of lines 21–100 of the working doc as they stood on 2026-09-12: the six
sections covering the instance pin, the rate-limit decision, PH-1's closure, what account
deletion left behind, error tracking, and the two small items. **Every one of them was already
a compressed pointer into an earlier archive**, which is why they could be cut in one move: the
reasoning they summarise has not lived in the working doc for days, and the working doc now
carries one paragraph naming all six and where each one's reasoning actually is.

This is the same cut as [`production-hardening-ledger-2026-09-12.md`](production-hardening-ledger-2026-09-12.md),
made in the same PR and for the same reason — the doc crossed 400 for a fourth consecutive run
while gaining a `[large]` item, a design answer and a re-verification, and the README's finding
that this doc is "structurally at its ceiling" means the thing to cut is pointers-to-pointers,
not prose someone still reads.

---

## What lifting the instance pin actually costs — answered 2026-08-29, discharged 2026-08-30; archived 2026-09-10

Both blockers shipped (PH-11's divided rate limit, PH-10's live transcript trim), the residual
two-device race is accepted, and what remains is one small PR raising `--max-instances` to **2**
plus the two things only a human can observe. That remainder is **PH-13** under "Needs a human",
stated there in full — which is why this section is now verbatim in
[`archive/production-hardening-instancepin-2026-09-10.md`](archive/production-hardening-instancepin-2026-09-10.md)
rather than here.

## What the rate limit means with more than one instance (decided 2026-08-30, PH-11); compressed 2026-09-09

**Option (b): keep the bucket in memory and divide the budget by the maximum instance
count.** `server.py` carries `CHAT_REQUESTS_PER_MINUTE_BUDGET = 20` (what a foster gets
across the whole service), `MAX_CLOUD_RUN_INSTANCES = 1` (**which must equal
`--max-instances` in `deploy-backend.yml`** — a `!!` comment sits next to the flag, where
someone will actually be editing when they get it wrong), and the per-instance limit
derived from the two. The cost, stated plainly: an unlucky foster whose requests all land
on one instance is throttled at the divided number. Over-throttling one person is
recoverable; multiplying spend by the instance count has no floor. The Firestore-backed
bucket (a) is the correct answer at any instance count and lost on scope, not cost — it
would make the spend brake depend on Firestore, and a limiter that fails closed on a blip
turns a database hiccup into "you can't talk to the assistant". **Revisit (a) if the
instance count stops being a small fixed number**; that is the condition. Today the
division is by 1, so nothing changed numerically, and PH-13 raises both numbers together.
Full reasoning verbatim in
[`archive/production-hardening-ratelimit-2026-09-09.md`](archive/production-hardening-ratelimit-2026-09-09.md).

## The notification that doesn't notify — CLOSED 2026-09-05 by RS-12 (PH-1); compressed 2026-09-09

The arc, in one line: a hardcoded `notified_shelter: True` (2026-08-24) → an honest
capability probe, `arcade_tools.available()` (PH-1, PR #19) → **true because a write
landed on a surface a staff account demonstrably reads** (RS-12, PR #63), with
`notified_via: "shelter_roster"` naming which surface and Arcade demoted to its own
`arcade_messaging_available` field so no one field conflates a capability with a
delivery. The fix was a shelter surface, so it was built and is recorded in
`real-data-and-shelters.md`, not here. Full section verbatim in
[`archive/production-hardening-ph1-2026-09-09.md`](archive/production-hardening-ph1-2026-09-09.md).

**Two things worth carrying forward rather than archiving.** The gap was found by
`grep -rn adoption_profile web/` returning **no reader at all** — the app's most
expensive turn wrote a paragraph no human but the foster ever saw; and the section sat
parked behind "downstream of M3" for days *after* M3 finished, because nobody re-read the
sentence. Nothing signed-in was verified: that half is RS-12b in `real-data-and-shelters.md`.

## Account deletion and export — shipped, and deletion now reaches everything

`deleteAccount()` (PH-2, PR #20) and `exportAccountData()` (PH-6, PR #28), both
in `web/src/auth.ts` and surfaced in `AccountSheet.tsx` for signed-in users;
guests have "Start fresh on this device". Details in the
[archive](archive/production-hardening-2026-08-29.md).

### What deletion left behind — archived 2026-08-30, compressed 2026-09-10

Two things a deleted account left behind, both structural: the agent transcript (a
subcollection, so deleting the parent document missed it → PH-14 clears it through
`POST /reset` first, while an ID token can still be minted) and the `applications` rows
carrying `fosterName` (**redact, don't delete** — an application is a two-owner record and
must not vanish mid-review → PH-15 redacts and withdraws, PH-16 pins every other field).
Full reasoning, including why `applications`'s update rule must stay loose about
`fosterName` specifically, in [`archive/production-hardening-deletion-2026-08-30.md`](archive/production-hardening-deletion-2026-08-30.md)
— read it before tightening that rule. Narrative archived in
[`archive/production-hardening-settled-2026-09-10.md`](archive/production-hardening-settled-2026-09-10.md).

## No error tracking — compressed 2026-09-10

Cloud Run logs only, and nothing reads them. The *logging* half is already correct
(`server.py:300`, `:332`), so what is missing is one alert policy — **PH-7b** under "Needs a
human", which states it more operationally than this section did. The reason it matters was
demonstrated next door: DC-3's guard printed `fatal: ... no merge base` on four consecutive
runs while reporting success, unnoticed for a day, because nothing reads logs that don't fail
anything.

## Two smaller ones — both resolved; compressed 2026-09-10

PH-5 (guest→account migration, PR #29) and PH-4 (`"strict": true` pinned in
`web/tsconfig.app.json`, PR #27) — the Ledger rows are the full account. One operational note
worth keeping out of the archive: when re-checking strictness use `./node_modules/.bin/tsc`,
because `npx tsc` resolves to an unrelated `tsc@2.0.4` that prints a banner and exits 1
without compiling.

