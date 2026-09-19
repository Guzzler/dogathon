# Archived 2026-09-18 — PH-18's Ledger row, verbatim

Compressed in the working doc to make room for PH-24's spec. PH-18's own spec is archived
separately in [`production-hardening-ph18-2026-09-15.md`](production-hardening-ph18-2026-09-15.md);
this is the account of what actually shipped, including the three things the build turned up that
the spec had only half of, and the two parting leads (both since closed, in PR #85's own diff and
in PR #86).

- 2026-09-15 — PH-18 `[large]` — PR #85 — **The emergency screen no longer tells a foster
  anything nobody recorded, and the two rows it was meant to keep now render where they were
  always meant to.** Deleted: a 120-line hand-drawn SVG of Presidio Park, the Bay, a blue route
  and a "1.2 mi · 4 min" chip whose travel time nobody computed; the "VCA SF Veterinary
  Specialists · 1.2 mi · Open now" row; and "Copper's Dream Rescue · Foster coordinator ·
  (415) 554-3030" — an invented number for an organisation that does not exist, on the screen
  someone opens in an emergency. `emergencyContacts` is now the two published national poison
  lines and nothing else.

  **Three things the build turned up that the spec had only half of.** (1) The spec's central
  correction held exactly: stripping the vet row alone would have promoted Pet Poison Helpline
  into a card headed "Nearest 24-hour vet" under a *Call Vet Now* button, because `nearest` was
  `find(c => c.distanceMi != null) ?? contacts[0]`. The card is now conditional on
  `kind === "vet"` and there is no such row, so it renders an honest "No 24-hour vet on file"
  instead — which means **the delete needed a replacement, not just a guard**: a screen with a
  hole where the vet was is its own kind of wrong answer. (2) `EmergencyContact` gains
  `kind: "vet" | "poison" | "shelter"`, per the spec's "fix the field, not the regex". Both
  poison lines now render as quick actions rather than one, because a category is a filter and a
  substring test was a `find`. (3) The coordinator row resolves the way the spec's second
  correction demanded and no other way: **no call action at all.** `DogProfile` gains
  `shelter?: {name, address}` from the dog's own record, so "Who else to tell" names the real
  shelter with its real address and offers no `tel:`. No `phone` was added to `Shelter`; that
  field would have had to be filled.

  Verified by `Emergency.test.tsx` (13 assertions, `renderToStaticMarkup` like
  `ShelterRosterView.test.tsx`), which locks both invisible halves: that no contact is promoted
  into the vet card, and that both poison lines reach the quick-action row rather than "Other
  contacts". A dev server could not be started from this unattended run, so the screen was
  verified as rendered markup rather than in a browser — the tests assert the exact strings a
  foster reads, including the absence of "Presidio Park", "<svg" and "4 min".

  **Two leads, neither taken.** `@keyframes cp-pulse-dot` in `carePlan.css:780` is referenced by
  nothing in `web/src` — dead when the map went, possibly dead before. And the "What to do now ·
  Triage guide" button at the bottom of the quick-action row is a `<button>` with no `onClick`:
  it has never done anything, which is a different defect from claiming something false, and
  outside this seam. *(Also, for Sharang rather than a doc edit: `CLAUDE.md` still lists
  "Emergency Mode (24h vet map)" as explicitly out of scope, and the map shipped anyway —
  though as of this PR the out-of-scope line is true again.)*

