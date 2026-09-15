# Archived from `design-consistency.md` on 2026-09-14

The 2026-09-09 re-measurement of the `theme.css` lead, verbatim — the run that found eleven of
the fifteen classes the previous run had called unreferenced were live. Cut for length on
2026-09-14 when this doc crossed 400; the conclusion it reached is four lines in the working
doc and the working is here. Nothing below is superseded.

- **2026-09-09 — the queue is still empty on purpose, the `[large]` slot has left this doc,
  and the `theme.css` lead above is mostly wrong.** Re-measuring the fifteen classes that
  bullet names as *not* false positives — every `className="..."` and `className={...}`
  literal under `web/src` against `.<name>` in `theme.css` — finds **eleven of them live**:
  `shelter__form`, `shelter__form-row`, `shelter__label`, `shelter__error`, `signin__google`,
  `signin__note`, `signin__fine`, `account__wipe`, `avatar`, `avatar--initial` and
  `tabbar__link--account` all appear in a real `className`. Only the four `ap-*` rules
  (`theme.css:557-564` — `.ap-row`, `.ap-when`, `.ap-manner`, `.ap-routine`) are genuinely
  unreferenced. This is the README's 2026-09-07 lesson landing for the third consecutive run,
  now against a *lead* rather than a shipped claim: the cheapest wrong measurement to find is
  the one the last run just wrote. The lead survives, at a tenth of its stated size — four
  rules, not fifteen — which is a reason to leave it a lead rather than promote it.
  **Nothing is queued here this run, and that is a routing decision rather than an absence.**
  execute works the queues top-down and this doc outranks `production-hardening.md`, so any
  item added here — including the small, true, four-rule version of the lead above — would be
  picked *before* **PH-17**, the repo's only `[large]` item and a defect in what the product
  tells a stranger about a real animal. That is precisely the treadmill the 2026-08-31 re-rank
  exists to stop, arriving from the other direction. The `carePlan.css` literal re-count is
  untouched and still wants doing before the parked retokenisation is sized.

