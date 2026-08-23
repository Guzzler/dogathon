# Real dogs: where the data would come from

Nothing here is built. This is a design plus the research behind it, written down
before anyone picks an API, because the obvious answer turned out to be wrong and
that changes the shape of the thing.

Today the roster is 34 hand-written dogs in `data/dogs.json`, pushed into
Firestore by `scripts/seed_firestore.py`. Photos come from `placedog.net` by
index (`photoUrl()` in `web/src/lib/dog.ts`). Shelters are frontend constants —
`web/src/lib/shelters.ts` — with real names, real street addresses and real
coordinates for real organisations, none of whom know this app exists.

That last fact is the hard part of this document, and it is not an engineering
problem. It's in [The part that isn't engineering](#the-part-that-isnt-engineering)
at the bottom, and it gates everything above it.

This assumes [docs/shelter-integration.md](shelter-integration.md) as read. That
document already specifies `applications/{applicationId}` and
`shelters/{shelterId}` with `staffUids`; this one builds on those rather than
restating them.

## What I actually checked

Verified 2026-08-23. Where I could not confirm something I've said so rather
than filling the gap in — most of the confident-sounding writing on this topic
is describing an API that no longer exists.

### Petfinder is gone

Not deprecated, not hard to get into. Gone.

Petfinder emailed API users on **7 November 2025** saying the API would stop
functioning in 25 days, and shut it off on **2 December 2025** alongside a
website rebuild it wasn't compatible with. The replacement they offered is a
no-code embeddable "Custom Pet List Widget" — an iframe for a shelter's own
website, not a data feed
([announcement coverage](https://www.airdriemedia.com/petfinder-shuts-down-its-api/),
[Petfinder's own upgrade notice](https://help.petfinder.com/s/article/Petfinder-Site-Upgrade-and-Maintenance-December-2025)).
Developers had reported Petfinder quietly refusing to issue *new* keys since
around early 2024, so the shutdown was the end of a slide rather than a surprise.

I confirmed the current state directly rather than trusting the reporting:

```
$ nslookup api.petfinder.com
*** can't find api.petfinder.com: Non-existent domain

$ nslookup www.petfinder.com
Name:    www.petfinder.com          # resolves fine
```

`api.petfinder.com` is **NXDOMAIN** — the hostname has been removed from DNS
entirely, while the main site resolves normally. `www.petfinder.com/developers/`
returns 403 to any non-browser client. There is no key to apply for, no waitlist,
no partner tier I could find. Every tutorial, wrapper library and "free pet API"
listicle still describing Petfinder v2 with OAuth client-credentials and
3600-second tokens is describing a dead host.

**Do not design around Petfinder.** If someone on the team remembers it as the
default choice for this problem, that memory is about eighteen months stale.

### RescueGroups.org — the one open syndication API left

Live, free, and it has *written terms that contemplate exactly what we want to
do*, which is rarer than it sounds.

- v5 is REST/JSON:API at `https://api.rescuegroups.org/v5/public/...`, key on the
  `Authorization` header. I confirmed it's up — an unauthenticated call returns a
  well-formed `401` naming the missing header, not a connection failure:
  ```
  $ curl https://api.rescuegroups.org/v5/public/animals?limit=1
  {"errors":[{"status":401,"source":{"header":"Authorization"},
   "title":"Missing authorization header",
   "detail":"Missing authorization header - apikey authentication required"}]}
  ```
- v2 still exists (`https://api.rescuegroups.org/http/v2.json`, POST-only, JSON
  in and out). New work should use v5.
- Public data needs only a **public API key**, requested via a form linked from
  their [Adoptable Pet Data API page](https://rescuegroups.org/services/adoptable-pet-data-api/).
  It's free. I could not determine the approval turnaround or whether a human
  reviews it — the form itself wasn't reachable to me. **Somebody should just
  request one; that's a five-minute task and it unblocks the measurement below.**
- Location filtering is first-class: radius search in miles or km, anchored on a
  postal code or a lat/lng pair.

Their [API Terms of Service](https://rescuegroups.org/api-terms-of-service/) are
the useful part, and they're unusually direct:

> "The data may be temporarily cached in your system for use in your applications."

> "These Terms do not grant you any rights to the data accessed through the API
> other than for temporary use and display in your services."

> "If your service caches data from the API, you shall update that data on a
> schedule. We recommend updating daily, but no less frequently than weekly."

> "If your API Key is displaying animals and organization data to the public,
> every pet detail page **must contain** the included Pet Adoption Tracker image."

> "You may charge a fee for your services, however you may not sell, rent, or
> lease access to the API or the API data."

They explicitly **do not** require attribution or a backlink. Flooding the API
may earn a `429`; no numeric rate limit is published.

Three things follow directly. **Caching into Firestore is permitted** — this is
the licence for the whole ingestion design below. **A daily cron is not a nice-to-have,
it's the terms** — weekly is the floor. And **the Pet Adoption Tracker is a
UI requirement**, an image that has to land on the dog detail page in
`web/src/phases/discovery/`; whoever builds that screen needs to know before
they build it, not after.

What I could **not** confirm: whether any of the eight shelters we name are in
RescueGroups' data at all. Their coverage comes from rescues opting in and from
automatic imports out of shelter software like Chameleon, so it skews toward
smaller rescues. Measuring this needs the key. **First concrete task: get the
key, query a 50-mile radius around SF, and count how many of our eight come
back.** Everything downstream depends on that number, and I'd rather the plan
say "go measure" than pretend I know.

### Adopt-a-Pet — partners only, and they mean it

There is a real API at [partner-apis.adoptapet.com](https://partner-apis.adoptapet.com/),
covering a large database (their materials cite 1,000+ shelters and 16,000+
rescues). It is not open. Their own developer support says API keys "are not
provided to students or other organizations outside their partners", and that use
of the syndicated search API is "strictly limited to contractually agreed upon
partner organizations, and only for the contractually agreed upon time period".
The route in is emailing `info@adoptapet.com` and negotiating. Their public
`pet_list.html` docs returned `401` to me.

Their [robots.txt](https://www.adoptapet.com/robots.txt) also forecloses the
back door, explicitly disallowing `/pet-search`, `/pet-search-display`,
`/dog-adoption/search` and `/pet-adoption/search`. The search results are the
thing you'd want to scrape and they are named as off-limits.

Treat Adopt-a-Pet as a later partnership conversation, not a milestone-one
dependency.

### Shelter management systems

This is where the interesting finding is.

**Shelterluv** exposes a real HTTP API — `https://www.shelterluv.com/api/v1/animals/...`
with an `X-Api-Key` header. The key mechanism is the important bit: **the shelter
generates it from inside their own Shelterluv account** (gear icon → Configure →
Generate New Key), sometimes with their support team issuing it. There is no
developer signup where we obtain access to shelters generally. Access is per-shelter
and granted by that shelter.

That constraint is a feature. It means the technical integration and the
permission conversation are *the same conversation* — we cannot accidentally
build something that ingests a shelter's live animal data without them
deliberately handing us a credential. Given the section at the bottom of this
document, that is the property we want.

The public Shelterluv embed (`new.shelterluv.com/misc/shelterluv_embed.js`) is
just an iframe pointed at `/embed/{shelter_gid}`. It renders HTML for a shelter's
own site. It is not a JSON feed and shouldn't be treated as one. I also could not
read Shelterluv's full API terms — their documentation sits behind a customer
login at `portal.shelterluv.com`. **A partner shelter can show us those terms;
until one does, I don't know what they permit around caching or third-party
display.** Do not assume they match RescueGroups'.

**PetPoint** (24Pet/Pethealth) is used by well over a thousand North American
shelters, with `24petconnect.com` / Petango as the public-facing search. Their
messaging about "modern API capabilities" for the newer 24PetShelter product is
future-tense and framed around "trusted industry partners" — partner-gated, and I
found no open developer documentation or self-serve signup. I can't tell you what
it costs or whether we'd qualify. Unknown, and probably a phone call.

**Chameleon** appears to have no public API at all. It integrates outward by
export — pushing adoptable animals into RescueGroups, Petfinder and Shelter
Animals Count (the SAC path is a Crystal Report over SFTP). So Chameleon shelters
are reachable *through aggregators*, not directly. That's an argument for the
RescueGroups adapter carrying more weight than its brand recognition suggests.

### The eight shelters we already name

The brief said six; `web/src/lib/shelters.ts` actually hardcodes **eight**.
Rocket Dog Rescue and a second SF SPCA campus are in there too. Here's what each
one actually publishes, checked by hand:

**SF SPCA** (`sfspca`) — WordPress, and it has a **live, unauthenticated JSON
endpoint** powering its own adoptions page:

```
GET https://www.sfspca.org/wp-json/sfspca/v1/adoption

{"pagination":{"currentPage":0,"maxPages":3,"results":32},
 "items":[{"title":"Gretchen",
           "tags":{"gender":"Female","weight-category":"XS","species":"Cat",
                   "breed":"Domestic Shorthair","color":"Black",
                   "location":"04","site":"Mission Adoption Center"},
           "permalink":"https://www.sfspca.org/sfspca-adoption/61594630/",
           "thumb":"https://www.sfspca.org/wp-content/uploads/...jpg",
           "bonded":false}]}
```

32 animals across 3 pages when I looked, mixed cats and dogs — only 4 dogs on the
first page, so species filtering happens client-side. The permalink carries a
stable-looking external id. Their robots.txt allows all user agents with
`Crawl-delay: 10`.

This is tempting and I want to be precise about what it is: an **undocumented
internal endpoint that happens to be readable**, not a published API. It has no
terms, no versioning, no support, and no promise it exists next month. The route
declares no parameters beyond a WPML language code. It is fine to *use it to
prove the pipeline works in a demo*. It is not something to build a launch on
without asking them.

**"SF SPCA Pacific Heights"** (`petsun`) isn't a separate organisation — it's a
second campus of the same SF SPCA. The endpoint above already distinguishes
campuses via `tags.site` ("Mission Adoption Center"). Modelling it as its own
shelter is a small data-model bug that the `shelters` collection should fix.

**SF ACC** (`acc`) — a city agency on WordPress, self-hosting its listings and
syndicating out to Petfinder (org `CA326`). Its robots.txt is an **allowlist**,
and this is the decisive detail for the scraping section:

```
User-agent: Googlebot
Allow: /
...                       # ~12 named search-engine and social crawlers
User-agent: *
Disallow: /
```

Every named crawler is permitted; everything else — including anything we write —
is disallowed sitewide. Scraping SF ACC is not a grey area. Their robots.txt says
no.

**Muttville** (`muttville`) — self-hosted Craft CMS for listings, but their
adoption **applications** run on Shelterluv forms
(`shelterluv.com/form/other/MVSF/...`, org code `MVSF`).

**Copper's Dream** (`coppers`) — Squarespace; the `/adopt` page references
Shelterluv. A Bay Area, largely foster-based rescue.

**Rocket Dog** (`rocket`) — WordPress with a Shelterluv embed on the page
(`shelterluv_wrap_...`), a Shelterluv "match me" application at
`new.shelterluv.com/matchme/adopt/RCKT/Dog`, and Shelterluv checkout for
donations (`RCKTDOG`).

**Wonder Dog** (`wonder`) — a Wix site, robots.txt permissive. I couldn't locate
its adoptables path (the URLs I guessed 404'd), so I don't know what backs it.

**Family Dog** (`familydog`) — **the record in our app is wrong.** The domain the
name implies doesn't resolve; the organisation is at `ilovefamilydog.org`, and it
uses Shelterluv. Yelp lists the San Francisco location as **CLOSED**, at a
different street address than the one we hardcode (`2601 Cesar Chavez`).

Two conclusions worth pulling out.

**Four of the eight are on Shelterluv** — Muttville, Copper's Dream, Rocket Dog
and Family Dog. For this particular set of shelters, Shelterluv is the common
denominator, not Petfinder and not RescueGroups. A single Shelterluv adapter,
fed one key per consenting shelter, covers half our named roster. That is the
highest-leverage adapter to build after manual entry.

**Our hardcoded shelter constants have already drifted from reality.** One of
eight is closed at the address we display, and one of eight isn't a distinct
organisation. Nobody introduced a bug — the data was hand-written once and the
world moved. That is a small, live demonstration of the thing this whole document
is about, and an argument for `shelters/{shelterId}` becoming a real collection
with an owner rather than a constant in a `.ts` file.

## About scraping

The owner floated it, so it deserves a straight answer rather than a policy
reflex.

**Where it's clearly not defensible.** SF ACC's robots.txt disallows all
unnamed agents sitewide. Adopt-a-Pet disallows its search paths by name.
Petfinder returns 403 to non-browser clients and 403s its own `/robots.txt`,
which is a site actively rejecting automated access. In those three cases the
operator has stated a preference in the standard machine-readable place, and
overriding it is a decision to ignore them — not a technical workaround. For a
product whose pitch is partnership with shelters, getting caught scraping the
city shelter that told us not to is a self-inflicted wound far larger than the
data is worth.

**Where it's arguably fine.** SF SPCA allows all agents with a 10-second crawl
delay, and their JSON endpoint is served to anyone who asks. Reading it at low
volume, honouring the delay, with a `User-Agent` that identifies Pawthway and a
contact address, is within what they've said. It's still their internal endpoint
and still impolite to build a business on silently — but as a way to prove the
adapter interface works against something real, it's reasonable.

**The cost nobody budgets for.** Scrapers don't fail loudly, they fail into
plausible-looking wrongness. A CSS class changes and the breed field starts
capturing a menu label. A page gains a "recently adopted" section and adopted
dogs flow into the feed. Every scraped source is a permanent, unscheduled
maintenance obligation owned by whoever wrote it, and the failure mode is
*silently serving wrong data*, not an alert.

**The part that actually settles it.** Adoption listings are somebody's
operational record about live animals, and staleness has a victim. A dog adopted
last Tuesday that our scraper still shows means a real person reads the profile,
imagines the dog in their home, and applies. Then either nothing happens, or a
shelter volunteer spends their time explaining. We will have spent someone's
hope on a record we didn't have permission to hold and couldn't keep current.
That's the same principle already written into
[the adoption page](../CLAUDE.md) — nothing on it is invented, because a
plausible guess can't be told apart from an observation. A stale listing is that
failure with a stranger's afternoon attached.

**Recommendation.** Scraping is defensible only as a *demo-grade* source, for a
site whose robots.txt permits it, clearly labelled in the UI as coming from the
shelter's public page rather than from the shelter, and never with a Pawthway
application attached to it. The moment a real application can be submitted
against a dog, that dog's data has to come from a source the shelter knowingly
gave us. Everything else is borrowing a stranger's credibility.

The good news is that the adapter design below means a scraper is just one more
`Source`, easy to add for a demo and easy to delete when a real feed replaces it.
Build it if it helps; don't let it become load-bearing.

## The design: every source is an adapter

The whole extensibility claim rests on one idea — **manual shelter entry is a
source adapter, not a special case.** If manual entry goes down a bespoke code
path, then "add a feed later" means building a second half of the system. If it
implements the same interface as RescueGroups, then the pipeline is proven by the
one source that needs nobody's approval, and every later source is an
incremental addition to a working machine.

### The interface

Two methods, deliberately. `fetch()` does I/O; `to_dog()` is pure. Splitting them
means the mapping — which is where the bugs live — is testable against a saved
fixture with no network.

```python
@dataclass(frozen=True)
class SourceRecord:
    external_id: str          # stable id in the source's own namespace
    shelter_id: str           # our shelters/{id}, resolved by the adapter
    payload: dict             # the source's raw record, untouched
    fetched_at: datetime

class Source(Protocol):
    id: str                   # "manual" | "rescuegroups" | "shelterluv:MVSF"
    def fetch(self) -> Iterable[SourceRecord]: ...
    def to_dog(self, record: SourceRecord) -> dict: ...   # a `Dog`, per web/src/types.ts
```

`ManualSource.fetch()` reads a Firestore collection instead of calling an HTTP
API. That's the only difference. It still emits `SourceRecord`s, still goes
through the same normalisation, reconciliation and write path.

`to_dog()` returns the existing `Dog` shape from `web/src/types.ts` and nothing
new. That shape is already forgiving — every Discovery field is optional and
`normalizeDog()` in `web/src/lib/dog.ts` derives what's missing (size from
`weight_lbs`, energy from age and breed, shelter by hashing the id). An adapter
that can only fill in name, breed, age, weight and status produces a dog that
renders correctly today. **That existing tolerance is what makes thin external
feeds usable at all, and it's a reason not to make more `Dog` fields required.**

### Where it runs

**Cloud Scheduler → Cloud Run job**, in the existing `pawthway-hackathon`
project. The pieces are already there: `Dockerfile` builds the Python image,
`.github/workflows/deploy-backend.yml` deploys it with `gcloud run deploy --source .`,
and `src/agent/firestore_client.py` already picks up Application Default
Credentials from the attached service account with no config. A sync job is a
second entrypoint on the same image, deployed by the same workflow, writing
through the same Admin SDK that already bypasses Firestore rules.

Daily is the right cadence — it satisfies RescueGroups' "daily, no less
frequently than weekly", and adoption listings don't move faster than that.

Not Cloud Functions (a second runtime and deploy path for no gain) and not a
thread inside the agent server (`src/agent/server.py` holds conversations in
memory and gets restarted; per CLAUDE.md that's explicitly not where anything
durable belongs).

### Firestore shape and provenance

External records land in the existing `dogs` collection as ordinary `Dog`
documents, plus one nested `source` object:

```ts
source: {
  adapter: string;          // "manual" | "rescuegroups" | "shelterluv:MVSF"
  external_id: string;      // the source's id, not ours
  url: string | null;       // canonical listing on the shelter's own site
  first_seen: Timestamp;
  last_synced: Timestamp;   // last time we wrote this doc
  last_seen_in_feed: Timestamp;  // last time the source still listed it
}
```

`last_synced` and `last_seen_in_feed` look redundant and are not. The first says
when we touched the record; the second says when the source last vouched for it.
Reconciliation reads the second one, and the gap between them is exactly the
staleness that hurts people.

**Document ids must be deterministic** — `rg-12345`, `sl-MVSF-887`,
`man-<firestore-autoid>`. A sync is then an idempotent upsert: re-running it
updates in place instead of producing a second copy of every dog. Hand-seeded
dogs keep their `d-001` ids and get `source.adapter: "seed"`, which makes them
trivially findable when it's time to delete the fake ones.

**A synced dog and a shelter-entered dog differ in exactly one way that
matters: who owns the fields.** For `adapter: "manual"` the shelter's staff are
the authors and the sync must never touch it. Enforce that with one guard in the
write path — *an adapter may only write documents whose `source.adapter` equals
its own id.* It's a single condition and it prevents the worst plausible bug in
this system, which is a feed silently overwriting a dog a shelter volunteer typed
in by hand.

The UI consequence is small and worth stating: synced dogs are read-only in the
shelter dashboard, with an "edit this at the source" link to `source.url`. Trying
to make them editable means either losing edits on the next sync or building
field-level conflict resolution, and neither is milestone-one work.

### Reconciliation

**A dog disappears from the feed.** Don't delete it, and don't mark it adopted —
you don't know why it vanished. It could be adopted, on medical hold, or the feed
could have hiccuped. Keep `status` meaning *the dog's real-world state, as stated
by whoever owns the record*, and add a separate pipeline-owned field:

```ts
listing_state: "listed" | "missing" | "withdrawn"
```

Missing after one sync hides it from Discovery. Missing after two consecutive
syncs marks it `withdrawn`. The document survives either way, because
`fosters/{uid}.matchedDogId` and any `applications/{id}.dogId` point at it and a
dangling reference is worse than a stale one. Conflating "gone from a feed" with
"adopted" would also put a false outcome on the adoption page, which is the one
place this codebase has already decided not to invent anything.

**Duplicates across sources.** The same dog can appear via RescueGroups and via
its shelter's Shelterluv key. Fuzzy matching on name + breed + approximate age is
unreliable in a domain full of "Luna, 2yr terrier mix", and a wrong merge is
worse than a duplicate. Sidestep it: **one primary source per shelter**, declared
on the shelter document (`shelters/{id}.primary_source`). An adapter skips any
shelter it isn't primary for. Simple, deterministic, and correct for a
Bay-Area-sized problem. Revisit only if we're ever ingesting shelters we don't
have a per-shelter relationship with.

**Photos: hotlink first.** Point `img` at the source's URL, don't copy files into
Cloud Storage. Two reasons. It sidesteps a real licensing question —
RescueGroups grants "temporary use and display" and no rights beyond it, which
plausibly does *not* cover copying photographs into our own bucket indefinitely;
shelter photos are often the photographer's or the shelter's, and nobody in this
project has read a photo licence. And it degrades honestly: a removed photo shows
as broken rather than as a permanently cached image of a dog that's been gone for
a year. Copying into Cloud Storage is a real optimisation later — for reliability
and for the adoption page's carousel — but only with written permission from the
source. **Flagged, unresolved, needs a human.**

`normalizeDog()` currently falls back to a `placedog.net` stock image for dogs
without a photo. For real listings that fallback should be a neutral placeholder
instead: a stock photo of a different dog attached to a real adoptable animal is
exactly the invented-detail problem this codebase avoids elsewhere.

### What "start with the Bay Area" means concretely

Geography is adapter configuration, not a core concept. Nothing in the schema
knows about the Bay Area.

Milestone-one scope: **a 50-mile radius around San Francisco (37.7749,
-122.4194), dogs only, and only shelters present in `shelters/{shelterId}`.** The
last clause is the real filter. We seed that collection from today's eight
constants — corrected: drop `petsun` as a duplicate campus, fix or remove Family
Dog — and an adapter ignores anything that doesn't resolve to a shelter we know.
The radius stops the query being unbounded; the registry stops us listing dogs
from organisations we've never spoken to.

Expanding later is adding rows to `shelters` and widening a radius. No migration.

## The shelter interface

Manual entry is milestone one, so this isn't a later phase — it's the first
adapter's user interface.

[docs/shelter-integration.md](shelter-integration.md) already specifies the
model: `shelters/{shelterId}` carrying `staffUids`, `applications/{applicationId}`
as a top-level collection queryable from both sides, and a dashboard that is
honestly "a list of applications with a checklist the shelter can tick, and a
form to add a dog". Nothing here changes that. Staff sign in with the existing
Google auth (`web/src/lib/session.ts`), get matched to a shelter by `staffUids`,
and see their applications and their roster.

What this document adds is that the "form to add a dog" is not a convenience
feature. It is `ManualSource`, and it's the thing that proves the pipeline before
any third party has approved anything.

`shelters/{shelterId}` grows two ingestion fields:

```ts
{
  name: string; address: string; staffUids: string[];   // from shelter-integration.md
  primary_source: string;        // "manual" | "rescuegroups" | "shelterluv:MVSF"
  source_config: object | null;  // adapter-specific; e.g. Shelterluv org code
}
```

Credentials do **not** go in `source_config`. A Shelterluv key is a shelter's
credential to their own live animal system, and `shelters/{id}` has to be readable
by rules that check `staffUids`. Keys belong in Secret Manager, referenced by
name, read only by the job's service account.

### Rules

`dogs` is currently `allow write: if false`, with the agent's Admin SDK bypassing
rules entirely — correct today, and it has to change the moment a shelter edits
its own roster from a browser. `shelter-integration.md` sketches:

```
match /dogs/{dogId} {
  allow read: if true;
  allow write: if isStaff(request.resource.data.shelter_id);
}
```

That needs two amendments once dogs have provenance.

```
match /dogs/{dogId} {
  allow read: if true;

  // Staff may only create dogs they own — manual entry, their shelter.
  allow create: if isStaff(request.resource.data.shelter_id)
                && request.resource.data.source.adapter == "manual";

  // Staff may only edit records the sync doesn't own, and may not
  // reassign a dog to another shelter or relabel where it came from.
  allow update: if isStaff(resource.data.shelter_id)
                && resource.data.source.adapter == "manual"
                && request.resource.data.shelter_id == resource.data.shelter_id
                && request.resource.data.source.adapter == resource.data.source.adapter;

  allow delete: if false;   // retire by status, never delete
}
```

`resource.data` (the stored document) rather than `request.resource.data` (what
the client is sending) on the update conditions — otherwise a client claims
`adapter: "manual"` in its payload and edits a synced record. The sync job is
unaffected by all of this; the Admin SDK bypasses rules, which is why the
"an adapter only writes its own documents" guard has to live in the job's code
and can't be delegated to rules.

`allow delete: if false` matters more than it looks. Retiring a dog means setting
`status`, not removing the document, because applications and foster journeys
reference `dogId` and a Firestore delete leaves them pointing at nothing.

## Sequencing

**Milestone one: one real shelter, manual entry, applications that reach a
human.**

Concretely — seed `shelters/{shelterId}` from the corrected constants; build the
`Source` interface and `ManualSource`; build the staff dashboard's add-a-dog form
and application list per `shelter-integration.md`; amend the rules above; and put
three real dogs from one shelter that has said yes in front of real people.

The temptation is to make milestone one a RescueGroups feed, because a hundred
dogs feels more like a product than three. I'd argue the opposite. **The value of
this app is the application flow, not the catalogue** — a hundred browsable dogs
nobody can actually apply for is a worse product than three dogs with a real
shelter on the other end. Manual entry needs no third-party approval, no key, no
partner agreement and no legal read of anyone's terms. It exercises every part of
the pipeline: adapter, normalisation, provenance, reconciliation, rules, and the
shelter dashboard. And the conversation it requires — asking one shelter to
participate — is the conversation that has to happen anyway.

**Milestone two: the second adapter, whichever is unblocked first.** Shelterluv
if our partner shelter is one of the four already on it (they hand us a key from
their own account, and we cover half our named roster with one adapter).
RescueGroups otherwise — free key, real terms, needs the Pet Adoption Tracker on
the detail page and a daily cron. Either way the pipeline already exists and this
is a new class plus a config row.

**Deferred, deliberately.** Copying photos into Cloud Storage — hotlink until
someone has read a licence. Cross-source dedupe — one primary source per shelter
until that stops being true. Adopt-a-Pet and PetPoint — partnership conversations
we haven't started. Any scraper as a production source. Geographic expansion
beyond the Bay Area. Custom claims instead of `staffUids` — `shelter-integration.md`
is right that it's the better answer at a scale we're nowhere near.

## The part that isn't engineering

`web/src/lib/shelters.ts` names eight real organisations — SF SPCA, SF ACC,
Muttville, Copper's Dream, Wonder Dog, Family Dog, Rocket Dog — with their real
addresses and coordinates. **We have no relationship with any of them.** Right
now that's harmless, because every dog is invented and every application stops
at `DemoShelterPanel`, which the codebase deliberately made ugly so nobody
mistakes it for product.

Real listings change what those names mean. A page showing a real dog, at a real
shelter, with an Apply button, is telling a person that applying does something.
So either the application reaches somebody at that shelter, or the page is
lying — and the person who pays for the lie is a stranger who wanted to foster a
dog.

This gets sharper on inspection. Muttville, Rocket Dog, Copper's Dream and
Family Dog **already run their adoption applications through Shelterluv forms**.
They have an intake process, a queue and volunteers working it. A Pawthway
application isn't landing in an empty inbox; it's landing beside a system they
already use, or nowhere. There's no version of "just collect applications and
forward them later" that doesn't create work for people who never agreed to it.

Three questions for a human, none of which have engineering answers:

**Which shelter has actually said yes?** Not "would probably be fine with it" —
a named contact who knows their dogs will appear in this app and that people
will apply through it. Milestone one is scoped to exactly one because one is
sufficient and because the answer to this question is likely to be one for a
while.

**Where does a submitted application go?** Into `applications/{applicationId}`
for staff to review in our dashboard, which requires them to log into a second
system and check it? Or forwarded into the process they already run? The first is
cleaner to build and easier for a shelter to ignore. This is their operational
decision, not ours.

**What do we do about the seven we haven't asked?** Until each has agreed, the
options are to remove them from `shelters.ts`, or keep them as clearly-marked
sample data with no real dogs and no Apply button attached. What isn't an option
is a page that shows a real dog under a real shelter's name and an Apply button
that goes nowhere. Note that one of the eight is already listed at an address
where it appears to have closed — the constants are drifting, and drift on
invented data is a shrug while drift on a real listing is a person driving to the
wrong place.

None of this blocks writing the adapter interface, the job, or the schema. All of
it blocks turning the first feed on.
