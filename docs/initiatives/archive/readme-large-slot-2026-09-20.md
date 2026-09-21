# README — `[large]` slot entries archived 2026-09-20

Verbatim from `README.md`'s fallback-chain section, moved when the thirteenth link was added.

- **2026-09-17 / 09-18 — the tenth and eleventh links, verbatim in
  [`archive/readme-large-slot-2026-09-19.md`](archive/readme-large-slot-2026-09-19.md).** Tenth:
  **enumerate the *surfaces*, not the datasets** — five runs had each pointed the tense test at
  another consumer of one dataset, and asking which of the **five phases** had never been measured
  named Match immediately (PH-23). With it, **look for the exemption next to the rule**, and the
  note that "verified locally, not in the environment it runs in" came due twice on one run and
  resolved in opposite directions (DC-4 works on a real Actions run; RS-4's weekly check has never
  once completed, 403 from the runner's IP — RS-13, M4 reopened). Eleventh: **the surface that
  *writes*** — the same census named **Onboarding**, unmeasured for ten runs because every previous
  face of the tense test watched a value *leaving* the app and Onboarding's job is to take one
  **in**. **A census of render sites cannot find a defect in a write site.** Two riders: **a
  defensive default that cannot execute is evidence the value it defends against is being
  manufactured upstream** (`prefs()`'s `?? 50`), and **enumerating the questions *asked* against the
  fields *written*** is what found `time_availability`, a claim answering a question nobody asks.

- **2026-09-19 — the twelfth link: the layer *below* the one you just fixed.** No census this run.
  PH-24's own parting note said the write layers disagree about what omitting a key means, and
  checking it found that **PH-24's guarantee holds only for a foster's first pass**: `patchFoster`
  is `setDoc(..., { merge: true })`, which merges nested maps key by key, so `finish()` carefully
  declining to write `pref_size` leaves the previous `pref_size` exactly where it was. That is
  PH-25, and the generalisation is the one worth carrying:
  - **A fix stated as "stop writing X" has a storage-layer half, and it is a different layer than
    the one the fix was reviewed in.** Omission at the form is only honest if omission at the write
    layer deletes. The eleventh link taught that a render census misses write sites; this one adds
    that a *write* census misses the **persistence semantics** underneath them — three layers, and
    each was invisible from the one above.
  - **Two backends behind one function is where the disagreement hides.** `writeLocalFoster()` has
    been correct all along and Firestore has not, so every test and every LOCAL_MODE demo of the
    retake path showed the right behaviour. **When one code path has two implementations, "verified"
    names which one.** That is the 2026-09-07 rule — what you measured against is part of the claim
    — arriving through a backend rather than through a harness.
  - **The cheapest lead is the one the last run wrote down and declined to take.** PH-24 left this
    note deliberately, under the atomic-PR rule, and it cost one run to verify and nothing to find.
    A parting note is a queued item that has not been written down yet; **read the last run's
    exclusions before going looking.**
