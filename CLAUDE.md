# Pawthway — project context

Shared context for the team (Ritu, Sharang, Eesha) and for Claude sessions working in this
repo. This is the Dogathon hackathon project: **Pawthway**, a guided, Tinder-style journey
app that takes a foster from onboarding through discovery, matching, care, and handing the
dog back adoption-ready.

## Phase ownership

The app is 5 phases, each a self-contained route/view so people can build in parallel against
a shared Firestore schema (`web/src/types.ts`) without stepping on each other:

- **Onboarding** (`web/src/phases/onboarding/`) — the app's front door: a landing screen that
  takes the foster's name, then the intake questions
- **Discovery** (`web/src/phases/discovery/`) — map + swipe feed, dog detail, saved list — **Eesha**
- **Match** (`web/src/phases/match/`) — approval checklist, home prep, pickup scheduling — **Sharang**
- **Care Plan** (`web/src/phases/careplan/`) — checklist, care log timeline, AI tips chat — **Ritu**
- **Post Foster** (`web/src/phases/postfoster/`) — the dog's adoption page, share link, AI draft

Plus a **Hub** (`web/src/phases/hub/`) landing page showing current phase + reminders.

## Mobile shell and design system

The app is a **mobile-first phone frame**, not a desktop layout. `web/src/components/Layout.tsx`
renders `.shell > .phone` with a bottom tab bar; every phase renders inside it. On desktop the
frame is centred and capped at 430px.

- `web/src/theme.css` holds the design tokens (cream/coral palette, Fraunces + Nunito) and the
  Discovery component classes. It loads *after* `App.css`/`pawthway.css`, so its tokens win.
- **`.btn` exists in both design systems.** Ours is scoped to `.screen .btn` so their
  `.btn--primary` etc. are untouched. If you add a shared class name, scope it the same way.
- Phases still using the older markup render as `.pw-page` inside `.phone-body`, which gives
  them scrolling and padding. They pick up the new fonts and colours automatically.
- Screens that own their full height (onboarding, dog detail) hide the tab bar — see
  `FULL_BLEED` in `Layout.tsx`.

## Architecture

Everything lives inside one GCP project (`pawthway-hackathon`, Blaze plan) so there's a single
login and no cross-account glue:

- **Frontend** → Firebase Hosting. Static Vite build (`web/dist`).
- **Data** → Firestore. Collections: `dogs` (seeded roster) and `fosters/annie` (the one demo
  foster — intake answers, liked/passed dog ids, matched dog id, checklist state, `careLog`
  subcollection for weigh-ins/notes/photos).
- **The frontend talks to Firestore directly** via the Firebase Web SDK (`web/src/firebase.ts`,
  `web/src/hooks/{useFoster,useDogs,useCareLog}.ts`) for all plain CRUD — onboarding answers,
  swipe like/pass, checklist ticks, care-log entries. No REST CRUD layer.
- **Agent backend** → the existing Python FastAPI agent (`src/agent/server.py`), containerized
  and deployed to **Cloud Run**, same GCP project. It's reserved for exactly the three moments
  that need the LLM: **Match pickup coordination** (after a slot is confirmed), **Care Plan
  "ask anything about your dog"**, and **Post Foster generate + send adoption profile** — all
  reuse the existing `/chat` SSE endpoint (no dedicated
  `/adoption/generate` or `/adoption/send` REST routes; the frontend just sends a purpose-worded
  chat message via `AgentChatPanel`'s `quickActions` prop, and the agent's own tool-calling
  handles gathering data and writing results). The agent reads/writes the *same* Firestore data
  via the Firebase Admin SDK (`src/agent/firestore_client.py`), so the AI and the UI never
  disagree about state.
- **Local demo mode.** `web/.env` is gitignored, so a fresh clone has no Firebase config. Rather
  than crash on the first Firestore call, `web/src/lib/localMode.ts` exports `LOCAL_MODE` and the
  three hooks (`useFoster`, `useDogs`, `useCareLog`) fall back to `data/dogs.json` plus a
  localStorage-backed foster. A banner at the top of the app says when this is active. Add
  `web/.env` and it silently switches back to real Firestore — no code changes.
- **Auth.** Google sign-in (`web/src/auth.ts`); each foster owns `fosters/{uid}`, enforced by
  `firestore.rules`. Browsing is open to guests, but **applying to foster requires an
  account** — see "Accounts" below. The agent backend is *not* covered by those rules (the
  Admin SDK bypasses them), so it verifies a Firebase ID token itself on every call.

## New agent tool modules

- `src/agent/builtin/shelter.py` — Firestore-backed `list_dogs()`, `get_dog()`, `update_dog()`
  (dangerous).
- `src/agent/builtin/foster.py` — `get_foster()`, `save_intake()`, `record_swipe()`,
  `update_checklist()` (all dangerous except the getter); also holds the default checklist
  constants (`DEFAULT_APPROVAL_CHECKLIST`, `DEFAULT_PREP_CHECKLIST`, `DEFAULT_CARE_CHECKLIST`).
  **These are duplicated in `web/src/checklists.ts` for the frontend's own seeding — keep both
  in sync if you change the default checklist items.**
- `src/agent/builtin/care.py` — `get_care_log()`, `log_care_entry()` (dangerous),
  `get_care_checklist()`.
- `src/agent/builtin/adoption.py` — `generate_adoption_profile()` (safe, gathers dog + intake +
  care-log data; the agent writes the narrative itself from this), `send_adoption_profile_to_shelter()`
  (dangerous — goes through the existing approval-modal flow; uses Arcade Gmail/Slack if
  `ARCADE_API_KEY` is set, else just flips the dog's Firestore `status` to `ready_for_adoption`).

Tool convention (unchanged from the base scaffold): plain `@tool` for reads, `@tool(dangerous=True)`
for anything that writes or has external effects — gated by the existing `ApprovalModal` UI.

## Schema additions for Discovery

Both additions are **optional fields on the existing shapes**, so nothing the agent reads changed.

- **`Dog`** gains `shelter_id`, `good_with_cats`, `energy_level` (0–4), `grooming`, `coat`,
  `traits`, `needs`, `foster_length`, `photo`. `web/src/lib/dog.ts` exports `normalizeDog()`,
  which fills any missing field by deriving it (size from `weight_lbs`, energy from age/breed,
  shelter by hashing the id) — so dogs seeded before these fields existed still render.
- **`FosterIntake`** gains `pref_size`, `pref_energy`, `pref_home`, `pref_experience`,
  `pref_tags`. Onboarding writes these *alongside* the six original strings, which are what
  `src/agent/builtin/foster.py` reads. **If you change onboarding, keep writing both.**
- Shelters are frontend-only (`web/src/lib/shelters.ts`) — real SF rescues with coordinates.
  There is no `shelters` Firestore collection; dogs reference them by `shelter_id`.

Matching lives in `web/src/lib/matching.ts`: `scoreDog()` returns 0–99 from size/energy distance
plus home, experience and tag rules, and `matchReasons()` renders the same inputs as the
"Why you match" copy.

## The dog roster is scraped, reviewed, and committed

`data/dogs.json` is built once, offline, and committed. Nothing calls out at runtime — no
per-user cost, no rate limits, nothing to fail on stage.

**Source: the SF SPCA's own site**, scraped. The alternatives were tried and rejected:
Petfinder decommissioned their API on 2 December 2025 (`api.petfinder.com` no longer
resolves), RescueGroups needs a key granted by a human, and **both carry only adoption
listings**. The SF SPCA publishes more than either — staff-written write-ups, and which dogs
are currently in a foster home.

`scripts/import_dogs.py` runs the pipeline; `scripts/shelters/sfspca.py` is the scraper.

- **Enumeration comes from their sitemap** (`sfspca-adoption-sitemap.xml`), not the
  JavaScript-rendered listing page — more reliable and gentler on them. One request per
  second; they're a small non-profit.
- **Detail pages are server-rendered**, so plain `httpx` is enough. Facts come from the
  `adoptionFacts__div` block, the write-up from the `theme-post-content` widget.
- **The sitemap mixes dogs and cats.** Two independent checks, because neither is
  sufficient: a cat-breed list (Turkish Van is a cat despite sounding like nothing in
  particular) and the write-up's own vocabulary. A cat in a dog app is the worst possible
  miss.
- **Foster placement is prose, not a field** — "currently in a foster home", "his foster
  parent said". Surfaced as a status chip; never used to hide a dog, since every adoptable
  dog is a foster candidate.

Re-bake without re-fetching with `--from-cache`.

### Descriptive fields are hand-written

`notes`, `traits`, `needs`, `energy_level` and compatibility live in `data/enrichment.json`,
written by hand from each write-up (which the importer dumps to
`data/shelter_descriptions.json`). **No model call in the pipeline** — the roster is built
once, so what ships is reviewed rather than regenerated, and no key is needed to build it.
Each entry carries a `_name` so the file reads next to the opaque ids.

`scripts/shelters/enrich.py` validates on the way in and **rejects rather than repairs**:
notes over 240 characters, notes mentioning compatibility, notes carrying adoption fees, and
energy outside 0–4. Anything rejected is simply absent.

**Compatibility is a structured field, never prose**, and may be set only where the shelter
says so outright ("he gets along with kids, adults, and other dogs"; "she'd like to avoid
sharing a home"). Silence stays null. It is genuinely sparse — about 10% for kids — and that
is the honest number, not a bug.

## Unknown is not a claim

Real listings leave fields blank constantly, so the schema carries that through rather than
defaulting it. `good_with_kids`, `good_with_dogs`, `good_with_cats`, `grooming` and `coat`
are all nullable and render as "Not recorded" / "Not tested", or omit their row entirely.
`weight_lbs` is optional — a published `size` bucket beats a weight we'd have to invent.

Two consequences worth knowing:

- **`scoreDog` treats unknown as −4, not −26.** Scoring an unrecorded field the same as a
  known "no" pushed honest records under Discovery's `>= 45` cutoff, which made real data
  look emptier than invented data.
- **Map pins come from the dogs, not from `SHELTERS`.** That constant is eight hardcoded SF
  rescues; a real org would have had no pin at all. A dog carries its own `shelter`, and
  `shelterFor()` remains only as the fallback for seeded records.

## Accounts: who the app is acting as

`web/src/lib/session.ts` holds the current session in a **module-level variable**, not only in
React state. `patchFoster()` and `addCareLogEntry()` are plain functions called from ~20
places; they resolve the foster document synchronously via `fosterDocId()` rather than having
a uid threaded through every call site.

Three states matter:
- **user** — signed in with Google. Owns `fosters/{uid}` and its `careLog` subcollection.
- **guest** — chose "Continue as guest". Same journey, kept in localStorage. The flag persists
  so the sign-in screen isn't a toll gate on every visit.
- **signedOut** — sees `SignInView`, which is the real front door (in front of the onboarding
  gate: the app must know *whose* journey to load before asking whether it has started).

**Guest is not a fallback, it's a supported path.** Without `web/.env` there is no Firebase to
authenticate against, so Google sign-in disables itself and says why — the whole product still
runs on a fresh clone. Don't add code that assumes a uid exists.

**Applying is where guest ends.** Browsing, saving and the questionnaire are open; tapping
"Apply to foster" as a guest opens `SignInToApply` instead of committing (both apply paths:
`DogDetailView`, `SavedView`). A shelter has to be able to reach a real person, and everything
past applying — pickup coordination, care tips, the adoption profile — is agent work that the
backend can only attribute from a signed-in token. `needsAccountToApply()` is the one check,
and it deliberately doesn't fire when Firebase is unconfigured: a fresh clone has no account to
sign in to and no Firestore to protect.

Guest storage is `localStorage`, which is per-browser and per-origin. Hosted, that means two
visitors on two devices get separate journeys automatically — but **two people sharing one
browser share one journey**, because a browser cannot tell them apart. Only signing in
distinguishes humans. `clearGuestData()` (surfaced as "Start fresh on this device" in the
account sheet) is the one-tap handover for a shared or demo machine.

Firestore rules scope `fosters/{uid}` to `request.auth.uid == uid`. A shared adoption link is
opened by people who can't read that document, so `useFoster`'s `onSnapshot` has an error
callback that degrades to null instead of throwing.

One consequence is worth knowing before you build on it: an **application is stored as fields
on the foster's private document**, so a shelter can't query "who applied to us". Moving it to
its own collection is cheap now and a migration later — see
[docs/shelter-integration.md](docs/shelter-integration.md) before adding anything shelter-side.

Relatedly, every dog in `data/dogs.json` is invented and the shelters in `web/src/lib/shelters.ts`
are real organisations we have no relationship with.
[docs/real-data-sourcing.md](docs/real-data-sourcing.md) covers where real listings would come
from (the Petfinder API shut down in December 2025 — don't plan around it), the source-adapter
design that makes manual shelter entry and a synced feed the same code path, and the partnership
question that gates turning any of it on.

### The agent needs to know too

Every tool takes `foster_id`, defaulting to `""`. `src/agent/current_foster.py` resolves an
omitted id against the foster the conversation belongs to. **That id comes from a verified
Firebase ID token and nowhere else**: `web/src/api.ts` attaches `Authorization: Bearer
<getIdToken()>` to `/chat`, `/approve`, `/reset` and `/highlights`, and `require_foster_id` in
`server.py` reads the `uid` claim off it. The request body no longer carries a foster id, and
must not get one back — the tools use the Admin SDK, which bypasses `firestore.rules`, so a
body-supplied id is a read/write of any journey to anyone who knows a uid. `/health` and
`/tools` stay open; they leak nothing.

Two things keep that correct when more than one person is chatting, and both matter:

- `current_foster` is a **ContextVar set inside the streaming generator** (`server._stream`),
  not a module global set in the endpoint. A global is shared by every request in the process:
  with two people chatting at once, the second request's id overwrites the first while the
  first's stream is still open, and that stream's tool calls then read and write the wrong
  person's journey. Don't simplify it back to a global.
- `server.py` keeps **one `Agent` and one approval queue per foster id** (bounded by count and
  idle time), with the id pinned into that session's system prompt. One shared `Agent` means
  shared history — one foster's questions showing up in another's transcript.

Conversations live in memory, so a Cloud Run restart or a second instance loses them. That's
fine for a demo and the reason this isn't the place to put anything that has to survive.

### What a turn is allowed to cost

- **The model follows the surface.** `loop.model_for_surface()` maps the phase a chat is mounted
  in to a model: Match pickup coordination gets `claude-haiku-4-5` (logistics, answers already in
  Firestore), Care Plan and Post Foster get `claude-opus-4-7` — one has to be right about a
  specific dog's medical notes, the other writes the paragraph a stranger reads. `/highlights`
  was already deliberately on Haiku and stays there. The model is set per message rather than at
  construction, because one session spans several phases.
- **`phase` is optional and the fallback is the dear one.** `web/src/api.ts` doesn't send it yet,
  so everything currently runs on the capable model; adding it to the `/chat` body is what turns
  the cheap path on. An unknown phase costing more is the safe direction to fail.
- **Swapping the model is not just swapping the string.** Adaptive thinking and
  `output_config.effort` arrived with the 4.6 generation and are 400s on Haiku 4.5, so
  `Agent._request()` sends them only for models in `loop.ADAPTIVE_MODELS`.
- **`max_tokens` is 4096, down from 64000.** The longest thing the agent writes is a
  one-paragraph adoption profile; the remainder is headroom for thinking, which is billed inside
  the same ceiling. At 25 turns the old number was roughly $40 of output on one message.
- **Cloud Run is pinned to exactly one instance** (`--min-instances=1 --max-instances=1` in
  `deploy-backend.yml`). This is correctness, not thrift — sessions and approval queues are
  per-process, so a second instance can swallow an `/approve` that a `/chat` elsewhere is
  blocked on, and that tool hangs its 300s timeout with nothing in the logs. It also makes the
  backend a single point of failure; the fix is Firestore-backed state, not a bigger number.

## Onboarding is a gate, not a phase you navigate to

A foster with no intake can't reach anything else. `OnboardingGate` in `web/src/App.tsx`
redirects to `/welcome` until `hasOnboarded()` passes (`web/src/lib/foster.ts` — any intake
keys, or a phase past `onboarding`). `/welcome` takes their name, then hands off to the
questionnaire; the tab bar stays hidden throughout. Afterwards the Hub shows a
"What you're looking for" card summarising the answers, with **Change answers** to clear
intake and send them back through the front door.

## One foster at a time

`activeApplication()` (`web/src/lib/foster.ts`) returns non-null while `matchedDogId` is set
and the phase is `match` or `care_plan`. While it is, applying for a different dog is blocked
in both places you can apply — the Saved list (disabled buttons plus a notice) and a dog's
profile (the Apply-to-foster sheet explains instead of confirming). A `complete` journey
clears the block, so the foster can start again.

## Match: who owns which approval step

`ChecklistItem` has an optional `owner: "foster" | "shelter"`. The Match view splits the
approval checklist on it — "Your steps" are tappable, "What {shelter} handles" render locked
with an hourglass. Records seeded before the field existed fall back to `checklistOwner(id)`
in `web/src/checklists.ts`, same spirit as `normalizeDog()`.

Two different gates, don't conflate them:
- **The badge** ("Shelter approved you as a foster") tracks *only* the shelter-owned steps.
- **Pickup scheduling** unlocks when the whole checklist is done, both sides. `activeIdx` on
  the timeline uses this one, so it agrees with the Applications tab in Saved.

Because there's no shelter-side dashboard (out of scope), `DemoShelterPanel` fakes it: a
fixed-position, dark, dashed-border widget pinned outside the phone frame that ticks the
shelter's steps so you can drive the approval live in a demo. It's deliberately ugly-adjacent
so nobody mistakes it for product. It renders only in the Match view.

Pickup scheduling is `PickupScheduler` — a hand-built month calendar (no date library):
shelters are closed Sun/Mon, earliest pickup is 2 days out, bookable window is 28 days. Once
a slot is confirmed, an `AgentChatPanel` appears for coordinating with the shelter — that's
the third LLM moment, alongside Care Plan and Post Foster.

## Foster duration and the countdown

`Dog.foster_weeks` (1–16) is the expected stay; `formatWeeks()` renders it as "1 week",
"6 weeks" or "3 months". Records without it fall back to parsing the old `foster_length`
free text, then to 6 weeks.

`fosterWindow()` (`web/src/lib/foster.ts`) turns that into a countdown, anchored to
**`pickup.date` from the Match phase** — the only honest start, since that's when the dog
actually arrives. Before pickup it shows the total commitment instead of a countdown. It's
surfaced on the Discovery card and dog profile (total), and on the Hub, Care Plan,
Saved list and Applications timeline (time left).

## The adoption page

`web/src/lib/adoption.ts` assembles the whole page via `buildAdoptionProfile(dog, foster,
entries, journal)`.

**Nothing on this page is invented.** An adoption profile is read by someone deciding whether
to take on a real animal, so a plausible-sounding guess ("no accidents in foster") is worse
than a blank — it can't be told apart from something the foster actually observed. Every field
is either logged by the foster, recorded by the shelter, or absent, and each section says
which. `AdoptionProfile.missing` lists what has no data so the page can ask for it.

Sources:
- **Foster Parent Notes** — every journal entry across the whole foster period, oldest first,
  plus a Claude-written summary and tags (below). `starred` is shown as a marker, not used as
  a filter: a summary that only saw starred entries would miss most of what happened.
- **Photo carousel** — the shelter's photo first, then every journal photo, oldest first.
- **A note from the foster** — `Foster.adoptionNote`, typed by the foster. Never generated;
  blank until they write one.
- **Health record** — weigh-ins and vet visits from `careLog`. Weight falls back to the
  shelter's intake figure and says so.
- **Shelter's record / Gets along with / Care needs** — straight off the dog document,
  labelled as shelter-recorded rather than foster-observed. `good_with_cats` being absent
  renders as "Not tested", not "No".

Two routes render it from `web/src/phases/postfoster/AdoptionProfile.tsx`:
- `/post-foster` — the foster's own view, with sharing and the agent panel.
- `/adoption/:dogId` — the shareable link. **Deliberately outside the onboarding gate** so
  someone without a Pawthway account can open it.

Sharing offers copy-link, a `mailto:` draft, and the Web Share API where supported.

## Where liking becomes matching

Discovery's like/pass only writes `likedDogIds` / `passedDogIds`. Committing to a dog is a
separate, explicit step — **Saved → Apply to foster** (or Apply to foster → confirm on a dog's
profile), which sets `matchedDogId` and flips `phase` to `match`. That's the handoff into the
Match phase. The Applications tab reads `approvalChecklist` and `pickup` back out to draw its
status timeline, so it never disagrees with the Match view.

## Env / secrets

Two `.env` files, both gitignored, both templated by a `.env.example`:

- **Root `.env`** (`ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID=pawthway-hackathon`) — used by the
  Python agent locally. On Cloud Run, `FIREBASE_PROJECT_ID` is picked up from the runtime
  environment automatically; only `ANTHROPIC_API_KEY` needs to be set as a Cloud Run env var.
- **`web/.env`** (`VITE_FIREBASE_*` — all public/client-safe config from
  `firebase apps:sdkconfig WEB <app-id> --project=pawthway-hackathon`, plus `VITE_AGENT_URL`
  pointing at the deployed Cloud Run URL). Local dev leaves `VITE_AGENT_URL` unset — Vite
  proxies `/api` to `127.0.0.1:8000` (see `web/vite.config.ts`).

If you're a teammate pulling this repo fresh: copy both `.env.example` files, ask for the
`ANTHROPIC_API_KEY` and the Firebase web config values (or run the `firebase apps:sdkconfig`
command above yourself if you have access to the `pawthway-hackathon` Firebase project), then
`gcloud auth application-default login` once so the Admin SDK can reach Firestore *and verify
ID tokens* locally. Both halves are needed to use the agent at all now: without `web/.env`
there's no token to send, and without ADC the backend can't check one, so `/chat` answers 401.

## Local dev

```bash
uv sync
cp .env.example .env        # fill in ANTHROPIC_API_KEY
cd web && npm install && cp .env.example .env   # fill in Firebase web config
```

```bash
uv run agent-server                     # backend: SSE bridge on :8000
cd web && npm run dev                   # frontend: :5173
uv run python scripts/seed_firestore.py # one-time: seed dogs + fosters/annie
```

## Deploy

```bash
firebase deploy --only hosting,firestore:rules --project=pawthway-hackathon
gcloud run deploy pawthway-agent --source . --project=pawthway-hackathon \
  --region=us-central1 --allow-unauthenticated \
  --set-env-vars=ANTHROPIC_API_KEY=<key>
```

After the Cloud Run deploy, put its URL in `web/.env` as `VITE_AGENT_URL` and redeploy hosting
so the production build points at it.

## Explicitly out of scope

Emergency Mode (24h vet map) and a shelter-side dashboard are in the original product spec but
not in this scaffold — full happy path across the 5 phases, shallow depth per phase, was the
call for hackathon time constraints. Easy to bolt on later if time allows.
