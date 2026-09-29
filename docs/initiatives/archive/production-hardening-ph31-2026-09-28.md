# Archived 2026-09-28 from production-hardening.md — PH-31 spec, verbatim

Shipped 2026-09-27 as PR #106; the Ledger row in `production-hardening.md` is the account.

### PH-31 — listed and appliable are one test, not two — **shipped 2026-09-27; the Ledger row is the account**

- [x] PH-31. Spec kept below until plan archives it. **Reality differed in one place:** PH-28
  shipped `isListable()` with the status half already in (`status === "available" && shelter !=
  null`) but did not wire it to the apply sites, which still tested `shelter != null` — so this was
  the wiring plus the write order, not a new predicate. **This queue has no open item** as of this run.


PH-28's rule says *a dog nobody can apply to is not listed*. Read from the other side it says **a
dog that is not listed cannot be applied to** — and on `main` at `6940633` neither apply site checks
either half. `SavedView.tsx:34` maps `likedDogIds` with no status filter, and `DogDetailView` renders
any id at `/dog/:id`, so a dog the shelter **retired** (RS-6), marked **adopted**, or got back as
**ready_for_adoption** (RS-12) still offers *Apply to foster* to anyone who liked it — writing
`matchedDogId` and an `applications` row into the inbox of a shelter that has already said no.
Five of `DogStatus`'s six values mean "not taking applications"; the apply sites honour none.
**Re-verified against `main` at `e646a73` (2026-09-27), after PH-28 merged as PR #104:** still
open, exactly as described. `isListable()` (`lib/dog.ts:128`) checks both halves, but only
Discovery calls it; both apply sites shipped `canApply = dog.shelter != null`
(`DogDetailView.tsx:54`, `SavedView.tsx:115`) — the shelter half only. **Not discharged.**

1. Both sites' `canApply` becomes `isListable(dog)`; the disabled label stays *Not taking
   applications*. One predicate, three callers — Discovery, `DogDetailView`, `SavedCard`.
2. **Write the application before the foster document.** Both `apply()`s `patchFoster({ matchedDogId,
   phase: "match" })` first (`DogDetailView.tsx:58`, `SavedView.tsx:122`), so a failed
   `createApplication()` strands the foster on Match for a dog no shelter was told about.
   `requestPickup()` (RS-14) already has the right order; copy it. `createApplication()`'s silent
   `if (!opts.shelterId) return;` (`applications.ts:22`) becomes a throw — no guarded caller can reach it.
3. **Not in scope:** a foster *already* matched to a dog later retired (that is the shelter's
   decline, RS-11's path), and two fosters applying for one available dog (the inbox shows both).

**Verify:** vitest — `isListable` false for `retired`, `adopted`, `ready_for_adoption` and a
`null`-shelter dog, true for an available `sfspca-mission` one; a rendered `SavedView` case
(`MatchView.test.tsx`'s `renderToStaticMarkup` pattern) where a liked `retired` dog shows no enabled
Apply button. `./node_modules/.bin/tsc -b`, build, lint at `main`'s count. If PH-28 ships with the
status half already in, **discharge this with a Ledger line** rather than building it twice.
