# `real-data-and-shelters.md` — the three routing bullets, verbatim as they stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17, in the same PR that queued RS-13. The 2026-09-13,
2026-09-14 and 2026-09-15 bullets each recorded the same outcome — this queue empty, all gates
still gated on a person, the `[large]` slot found one doc over — and the README's own rule says a
chronological log is the same growth shape as a ledger, with the oldest entries the ones that
stopped being read. Compressed to two lines in the working doc. The one substantive thing they
carried, PH-22 having fixed the callee behind RS-6's `dogFromForm()` omission convention, is kept
there rather than only here.

- **2026-09-15 — the slot is in `production-hardening.md` for a seventh consecutive run, and
  this time it was *labelled* rather than measured for.** Fallbacks re-run against this doc
  again and unchanged: queue empty, no gate opened (RS-12b, RS-6b and RS-8 all still want a
  signed-in human; M5 still wants a shelter; `git log --all --since=2026-09-12` is this loop's
  own commits only). Nothing new is implied for this doc — PH-22, whose fix covered the half of
  RS-6 that RS-6 could not see, shipped as PR #83 and `dogFromForm()`'s omission convention is
  now safe as written.

- **2026-09-14 — the `[large]` slot is in `production-hardening.md` for a sixth consecutive
  run, and nothing here has changed.** All three fallbacks re-run against this doc again: queue
  empty, no gate opened (RS-12b, RS-6b and RS-8 all still want a signed-in human; M5 still wants
  a shelter; `git log --all --since=2026-09-11` is this loop's own commits only), and measuring
  produced PH-22 one doc over. **But PH-22 is partly about this doc's own work, and that is worth
  saying here rather than only there.** RS-6's `dogFromForm()` omits fields it has no value for
  — `foster_weeks`, `size`, `energy_level` — and asserted in a comment that `normalizeDog()`
  "already knows how to render" an absent key. It did not; it filled all three with defaults
  from a breed regex, making a hand-entered dog the *most* likely record to carry invented
  facts, while the scraped roster got real values from `enrichment.json`. The form was right
  and its callee was not. **PH-22 (PR #83) fixed the callee**, so the convention is now safe.

- **2026-09-13 — the fifth consecutive run, same three fallbacks, same outcome; PH-21 was found
  one doc over.** Its one note for this doc: PH-21 edits `ShelterRosterView.tsx`, M3's screen,
  to label the paragraph staff already read with who wrote it. Correctly PH-21's and not an RS
  item, but read RS-12's ledger row before touching that view.

