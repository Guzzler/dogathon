# Archived 2026-09-30 from `real-data-and-shelters.md` (verbatim)

Cut to make room for RS-18's spec. The roster-signal bullet is the dated history of the weekly
check through its first successful run; the RS-17 leads bullet became RS-18 (lead a) and a
one-line pointer (lead b).

## From "Where this actually stands"

- **2026-09-17 — the roster's only staleness signal has still never run, and now says so.**
  RS-4's weekly `import-dogs.yml` schedule fired for the first time on 2026-09-14 and failed `403`
  scraping SF SPCA's sitemap from the GitHub runner; the same URL returns `200` from a residential
  IP with no `User-Agent`. RS-13 (shipped the same day) makes that outcome reportable rather than a
  skipped step — *drifted, clean, or could not look*. **M4 stays reopened**: the check is honest,
  and it still cannot look. RS-13b under "Needs a human" is the only thing that changes that.
  **2026-09-21 — RS-13's scheduled branch observed on a real run, and it did what it says.** Run
  `35582812290` went green, caught the 403, and opened issue **#96** ("Weekly roster check could not
  reach sfspca.org", label `roster-drift`) whose body says the freshness is *unknown*, that nothing
  was written, and quotes the import's own 403 line. That discharges the RS-13 row's "check the
  2026-09-21 run". Next Monday should *comment* on #96, not open a second issue — worth one look.
  **2026-09-28 — it looked, for the first time.** Run `36403398124` took 2m19s against 21s for a
  403, scraped **26** dogs against 19 committed, and commented on #96 (reused, as designed) with a
  real plan: `write 26`, `delete 11`, `keep 2 … matched to a foster (delisted: ['d-026',
  'sfspca-61200213'])`. So the drift signal works end to end, the roster has turned over by more
  than half, and **the 403 is intermittent, not structural** — one success in three Mondays. Two
  things the run exposed: #96 keeps its *could not reach* title under a comment saying it did, and
  the `write 26` it plans is a whole-document replace over fields other writers now own — **RS-16**.

## From "Needs a human, not a queue item"

- **Leads RS-17 left (2026-09-29), each still true when it shipped.** (a) **Other fosters' open
  applications on a dog that just went `foster`** stay `submitted`, and the inbox shows them as if
  the dog were free — a closing-the-others design, not a status write. (b) **A foster who uses
  *Change request* after confirmation and then withdraws** leaves the dog `foster` with no notice:
  the change cleared the application's `pickupConfirmedAt`, which is what the withdrawn-row notice
  keys on (deliberately — without it, any withdrawn row would offer to relist a dog another foster
  holds). The roster's *In foster* group still offers **List again**, so the dog is recoverable, not
  lost. SF SPCA's `in_foster_home` prose flag stays unconflated with `status`, as specified.
