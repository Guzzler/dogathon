# `design-consistency.md` — the empty-queue routing bullets, verbatim as they stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17, in the same PR that recorded the palette notice firing
on a real Actions run. These four bullets (2026-09-08 through 2026-09-15) narrate nine runs of the
same routing outcome — this queue empty, the repo's `[large]` slot held by another doc, two leads
left rather than promoted. The README tells the same story once in its fallback chain, and a
chronological log grows like a ledger. What survives in the working doc: the `theme.css` lead at
its true size (four `ap-*` rules, not fifteen classes), the `carePlan.css` re-count (62 literals,
not ~115), and the note-to-another-doc convention that shaped PH-21 and PH-22.

- **This doc's queue is now empty of open items, and the repo's `[large]` slot is empty with
  it (2026-09-08, left for `dogathon-plan`).** DC-10 and DC-4 were the last two, so
  `design-consistency.md` — which had held the slot for four consecutive runs (DC-5, DC-7,
  DC-8, DC-10) — holds nothing. Across all three docs the only open item is **RS-4**, a
  workflow trigger that is small by construction, so this is not an empty-queue audit case
  yet; it is one refill away from being one. Two leads for whoever queues next, both from this
  run rather than invented:
  - **`theme.css` has never had the pass the other two just had.** DC-10 ruled it out of scope
    on purpose: 22 of its 224 classes look unreferenced but most are false positives
    (`is-on`, `is-active`, `has-error`, `leaflet-*` come from libraries or from constructed
    names), and a handful do not — `shelter__form`, `shelter__form-row`, `shelter__label`,
    `shelter__error`, `signin__google`, `signin__note`, `signin__fine`, `account__wipe`,
    `avatar`, `avatar--initial`, `ap-row`, `ap-when`, `ap-manner`, `ap-routine`,
    `tabbar__link--account`. That is a one-class-at-a-time item, not a sweep, and it is small.
  - **`carePlan.css`'s ~115 color literals are now a smaller problem than the number
    suggests**, because the pass above deleted 80 classes' worth of rules. Re-count before
    treating the parked retokenisation as the size it used to be.

- **2026-09-09 — the `theme.css` lead above is mostly wrong, and shrinks to a tenth of its
  stated size.** Re-measuring every `className` literal under `web/src` against `.<name>` in
  `theme.css` found **eleven of the fifteen classes live**, including all four `shelter__*`, all
  three `signin__*` and both `avatar*`. Only the four `ap-*` rules (`theme.css:557-564`) are
  genuinely unreferenced. That is the README's 2026-09-07 lesson landing against a *lead* rather
  than a shipped claim: the cheapest wrong measurement to find is the one the last run just
  wrote. **The lead survives at four rules, not fifteen, which is a reason to leave it a lead
  rather than promote it.** Working verbatim in
  [`archive/design-consistency-themecss-lead-2026-09-14.md`](archive/design-consistency-themecss-lead-2026-09-14.md).

- **2026-09-10 through 2026-09-14 — still empty, still the same routing decision, re-checked
  rather than carried over.** `production-hardening.md` has held the repo's `[large]` slot for
  six consecutive runs (PH-17, PH-19, PH-20, PH-21, and now PH-22), and execute works the queues
  top-down: anything added here — including the true four-rule `ap-*` version of the `theme.css`
  lead above — would be picked ahead of it. The `carePlan.css` literal re-count is still
  untouched and still wants doing before the parked retokenisation is sized.
  - **The note this doc left for PH-21 was taken, and it is worth recording as a win rather than
    deleting as spent.** It asked that the attribution line appearing on three views be *one*
    class and not three, for PR #11's reason. PH-21 shipped `ProfileAttribution` plus
    `lib/adoptionSource.ts` — one line and one class (`.profile-attrib`, the withdrawn state a
    data attribute) for all three surfaces. A one-bullet note in the second-ranked doc changed
    the shape of an item built out of the third, at a cost of three sentences.
  - **2026-09-15 — the `carePlan.css` re-count this bullet kept asking for is done, and the
    parked retokenisation is a little over half the size it is recorded as.** Counted the same
    way the 2026-09-07 figure was: **24 hex literals and 38 `rgb(`/`rgba(` — 62, not ~115 —
    against 133 `var(--` uses**, in 1136 lines across 129 distinct class selectors. DC-8's
    re-homing and DC-10's deletion pass took the literals down with the rules they lived in, so
    the number in "What's parked" describes a file that no longer exists. **It stays parked
    anyway** — the bar there is "someone commissions a palette pass on purpose", which is about
    intent and not about volume, and 62 literals is still a repaint by volume. What changes is
    that whoever commissions it is now sizing it honestly.
  - **The same note now applies to PH-22**, which is queued in `production-hardening.md` and
    lands on Discovery. It has to render "not recorded" for a foster duration, a size and an
    energy level across **seven** call sites (`SwipeDeck`, `DogDetailView` twice, `SavedView`
    twice, `HubView`, `PostFosterView`). That is the PR #11 shape again and then some: whoever
    builds it should introduce **one** way of rendering an unrecorded value — a shared component
    or a single class — not seven inline ternaries, and should check whether PH-21's
    `.profile-attrib` is already that thing before adding a second one.

