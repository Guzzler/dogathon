# Pawthway — project context

Shared context for the team (Ritu, Sharang, Eesha) and for Claude sessions working in this
repo. This is the Dogathon hackathon project: **Pawthway**, a guided, Tinder-style journey
app that takes a foster from onboarding through discovery, matching, care, and handing the
dog back adoption-ready.

## Phase ownership

The app is 5 phases, each a self-contained route/view so people can build in parallel against
a shared Firestore schema (`web/src/types.ts`) without stepping on each other:

- **Onboarding** (`web/src/phases/onboarding/`) — swipeable intake questions
- **Discovery** (`web/src/phases/discovery/`) — swipe feed of dogs — **Eesha**
- **Match** (`web/src/phases/match/`) — approval checklist, home prep, pickup scheduling — **Sharang**
- **Care Plan** (`web/src/phases/careplan/`) — checklist, care log timeline, AI tips chat — **Ritu**
- **Post Foster** (`web/src/phases/postfoster/`) — AI-drafted adoption profile, send to shelter

Plus a **Hub** (`web/src/phases/hub/`) landing page showing current phase + reminders.

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
