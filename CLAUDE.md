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
  and deployed to **Cloud Run**, same GCP project. It's reserved for exactly the two moments
  that need the LLM: **Care Plan "ask anything about your dog"** and **Post Foster generate +
  send adoption profile** — both reuse the existing `/chat` SSE endpoint (no dedicated
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
- **No auth.** One seeded demo foster (`fosters/annie`), publicly viewable. Firestore rules
  (`firestore.rules`) are scoped narrowly to `/dogs/**` (read-only) and `/fosters/annie/**`
  (read+write) rather than wide open, so the public URL isn't a fully open database.

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
profile (the Contact-shelter sheet explains instead of offering Apply). A `complete` journey
clears the block, so the foster can start again.

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
entries)`. **The Care Plan journal is the intended source**: `weigh_in` entries drive the
health section, `photo` entries fill the gallery, `note` entries become the highlights
timeline, `vet_visit` entries list out. Where the journal is empty it falls back to content
derived from the dog's own record and sets `fromJournal.*` false, which the UI renders as a
"sample content" hint. As the journal fills in, those sections switch over on their own —
no further wiring needed.

Two routes render it from `web/src/phases/postfoster/AdoptionProfile.tsx`:
- `/post-foster` — the foster's own view, with sharing and the agent panel.
- `/adoption/:dogId` — the shareable link. **Deliberately outside the onboarding gate** so
  someone without a Pawthway account can open it.

Sharing offers copy-link, a `mailto:` draft, and the Web Share API where supported.

## Where liking becomes matching

Discovery's like/pass only writes `likedDogIds` / `passedDogIds`. Committing to a dog is a
separate, explicit step — **Saved → Apply to foster** (or Contact shelter → Apply on a dog's
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
`gcloud auth application-default login` once so the Admin SDK can reach Firestore locally.

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
