# Pawthway — Care Plan (Phase 4)

Owner: Ritu · Branch: `ritu/care_plan`

The Care Plan is the "while the dog is with you" surface. It's what the foster opens every day — a calm home screen that answers *"what do I need to do today, and how is Marty actually doing?"* and quietly builds the story that becomes the adoption profile in Phase 5.

## Built so far

Everything below lives in `web/src/phases/careplan/` and renders inside the shared `.phone-body` shell. Three tabs total — the sub-nav (Home / Journal & Tips / Emergency) sits at the **bottom** of the frame, just above the app tab bar, styled slim so it doesn't read as a second copy of the app's navigation.

### Data wiring
- Reads the matched dog from `useFoster()` + `useDogs()` (`foster.matchedDogId`). If there's no match, the Care Plan shows a "Finish the Match phase first" fallback that links to `/match`.
- Pickup date comes from `foster.pickup?.date`, falling back to today. `daysSincePickup()` derives the live day-in-foster count.
- Journal entries and the schedule-block completion state use the persisted `useJournal()` / `useCareSchedule()` hooks so the Post-Foster adoption page can read the same state.
- Puppy support: two puppies (Marty, 4mo shepherd; Willow, 6mo lab) added to `data/dogs.json`. Age renders as "N mo" for under-1-year dogs (`lib/dog.ts` `ageLabel`). Onboarding has a new "Life stage — Puppy vs Adult" tag group; `matching.ts` scores it ±18/20.

### Home tab (`Hub.tsx`)
- **Phase banner** — green header showing current phase name ("Week 1 · Decompression") derived from days-in-foster.
- **Triggered tip cards** — fire from keyword rules over journal notes + `DogProfile` (age-branched biting playbook, skipped-meal warm-food warning, crate-refusal food-in-crate tip, scared/fear reassurance). Show above the plan when active.
- **Weight chart** — SVG sparkline of past weigh-ins (clipped to `dayInFoster`), only renders when there are 2+ points.
- **Care plan timeline** — one spine per week/month bucket, one row per real event:
  - Week header with a filled/hollow dot (past / current / upcoming) and day range
  - **Plan and record are merged** (`plan.ts` `buildPlanTimeline`). A scheduled item ("DHPP booster",
    "Weight check") and the milestone that records it collapse into a single row, matched on a care
    *topic* (dhpp / bordetella / weight / nails / cue-training …) rather than string equality. The
    milestone's day wins over the planned week, so Bordetella shows once on Day 30 instead of under
    both Week 3 and Month 2, and the merged title keeps the logged value ("Weigh-in — 22 lbs").
  - Row status is `logged` / `done` / `todo` / `planned` / `upcoming`. Rows backed by a schedule item
    stay tappable checkboxes; pure milestones render as records. Dated rows sort by day, undated plan
    items trail behind them.
- **Pinned "This week" tip** — collapses body in Experienced view.
- **Quick actions** — Journal & Tips + Emergency.

### Journal & Tips tab (`JournalTips.tsx`)
One unified composer with three modes:
- **Log note** — free text
- **Ask about {dog}** — keyword-matched stub answer, cites the relevant seed tip. Real LLM wiring is the drop-in next step.
- **Photo** — placeholder swatch + caption

All three land in a single chronological feed (notes, photos, Q&A pairs interleaved). Star any entry to earmark it for the adoption profile. The full seed tip library sits behind a "Browse care library" accordion at the bottom.

### Emergency tab (`Emergency.tsx`)
- Google-Maps-style SVG mock: street grid, park polygon, water body, blue user dot with accuracy ring, red teardrop marker for the nearest 24h vet, dashed route with distance/time chip, scale bar.
- Real phone numbers: VCA SF Veterinary Specialists `(415) 401-9200`, Pet Poison Helpline `(855) 764-7661`, ASPCA Animal Poison Control `(888) 426-4435`.
- `{dog}`'s medical summary (vaccines, allergies, medications, weight).
- Poison Control + "What to do now" quick tiles.

### Demo controls (`components/DemoCarePanel.tsx`)
Fixed bottom-right floating panel (mirrors Match's `DemoShelterPanel` visual pattern). Lets the demo driver:
- Jump to Day 1 / Week 2 / Week 3 / Week 4 / Week 6+ — the whole page (phase banner, schedule, chart, milestones, triggered cards) re-renders as if you were on that day.
- Swap the foster's experience level (beginner / experienced) — affects the pinned tip's body verbosity.
Each day option surfaces the actual calendar date next to it.

### Layout / responsiveness
- No topbar chrome — the app-level nav already labels the phase.
- Mobile-first: fills the 430px phone frame edge-to-edge; the desktop card look kicks in above 900px (unused now the app is phone-shell-only).
- Tabs scroll horizontally on narrow widths; long dog names wrap in headers instead of overflowing.

### Not built (spec items still deferred)
- Push notifications for missed tasks
- Real LLM in "Ask about {dog}" (stub returns keyword-matched canned answers with seed-tip citations)
- Templatize seeded content — several tip bodies still hardcode "Marty" instead of `{dogName}`
- Weight unit toggle in settings (imperial only right now)
- Realtime shelter visibility / daily digest


## Goals

1. **Reduce day-one panic.** A first-time foster should never wonder "what am I supposed to be doing?"
2. **Capture the story.** Every note, photo, and milestone the foster logs feeds the auto-generated adoption profile.
3. **Meet fosters where they are.** Beginners get more hand-holding; experienced fosters get a terser, log-focused view.
4. **Surface help at the moment of need** — not buried in a help center.

## Primary user

Adaptive to experience level (set by the onboarding intake):

- **First-time foster** — heavy scaffolding. Every checklist item has a "how" link. Tips layer surfaces proactively. Language is warm and reassuring.
- **Experienced foster** — dense, log-first view. Tips available on demand. Fewer explanations, more shortcuts (bulk-log feedings, quick weigh-in, etc.).

Both share the same data model and same four sub-features — only presentation and prompt cadence changes.

## Personalization — the plan knows the dog *and* the week

The Care Plan isn't a generic checklist. It's a timeline tailored to *this specific dog* (age, breed, medical flags, backstory from the shelter) and it changes as the foster moves through predictable phases.

### Timeline-personalized content

Every dog gets a week-by-week plan on pickup. Content is composed from templates keyed on the dog's attributes.

**Example: Marty, 4-month-old shepherd mix, no medical flags**

| Week | What the plan surfaces | Why |
|---|---|---|
| **Week 1 — Decompression** | Task: quiet space setup. Tip: "Expect Marty to hide or seem 'off' — this is normal. Don't force interaction." Milestone prompt: "First tail wag." | Rescue dogs need 3–7 days to feel safe. Beginners often panic here. |
| **Week 2 — Routine locks in** | Task: consistent feeding times, first short walks. Tip: "House-training clicks around now — reset the clock on every accident, don't scold." | Behavior gets predictable; foster can start reading the dog. |
| **Week 3 — Teething & testing** | **Proactive tip: "Puppies peak biting around 12–16 weeks. Keep frozen wet towels ready — cold soothes gums and redirects the bite."** Task: introduce chew rotation. | This is where the "wet towel trick" fires *before* the foster googles at 11pm. |
| **Week 4 — Honeymoon ends** | Tip: "Marty is comfortable enough to test limits now. This isn't regression — it's trust." Task: reinforce basic cues. | Fosters often think they've "ruined" the dog. Naming the phase defuses it. |
| **Week 6+ — Adoption prep** | Prompt: "Star your favorite photos and moments — we'll use them for Marty's adoption profile." | Feeds Phase 5. |

The timeline slides based on **days-in-foster**, not calendar dates, so it survives a delayed pickup.

### Conditional / triggered guidance

Tips also fire based on *what the foster logs* — not just what week it is.

| Trigger (observed via checklist / journal / note) | Response |
|---|---|
| Note mentions "bit", "nipping", "mouthy" — **dog < 12 months** | **Teething playbook:** wet-towel-in-freezer, chew rotation, redirect not scold. "This peaks around 12–16 weeks — normal." |
| Note mentions "bit", "nipping", "mouthy" — **dog ≥ 12 months** | **Behavioral playbook:** identify trigger (resource, fear, play), avoid punishment, escalate to trainer + shelter behavior contact if breaking skin. |
| Skipped 2+ meals or note mentions "not eating" | Escalate: "Try warming food / adding water. If 24h+, call the vet — one-tap to shelter contact." |
| Note mentions "crate", "won't go in", "whines" | Surface **food-in-crate trick** + gradual crate schedule |
| Weight drops >5% week-over-week | Alert card + prompt to log stools + vet contact CTA |
| Note mentions "scared of", "hides from" | Reassure ("normal in week 1–2") + desensitization ladder |
| No journal entries in 3 days | Gentle nudge (foster wellbeing check — burnout is real) |

Triggers are **rules over structured signals + keyword matches on free-text notes**, and they read the journal within a **recency window** (7 days; 3 for skipped meals) — a trigger describes a live situation, so one note about nipping on day 3 shouldn't pin the card to the hub for the rest of the foster. The LLM behind "Ask anything" gets the same rule outputs as context so its answers stay consistent with what the UI is already surfacing.

**Opinionated by design.** We know the dog's age, breed, and medical flags from day one (shelter intake feeds `DogProfile`), so rules branch on those attributes rather than asking the foster follow-up questions. A puppy biting and an adult biting get different playbooks — no disambiguation prompt.

### Where personalization lives in the data model

```
DogProfile {
  id, name, species, breed, age_months, weight,
  medical_flags: string[], backstory_tags: string[],
  pickup_date, shelter_id
}

CarePlanTemplate {
  applies_when: { species, age_band, breed_traits?, medical_flags? },
  weeks: [
    { week_index, phase_name, tasks: TaskTemplate[], tips: TipRef[], milestone_prompts: string[] }
  ]
}

TriggerRule {
  id, signal: "note_keyword"|"missed_task"|"weight_delta"|...,
  match: { keywords?, threshold?, window? },
  response: { tip_id, urgency: "info"|"warn"|"escalate", cta? }
}
```

The composed plan for a specific dog is `CarePlanTemplate.applies_to(DogProfile)` → a linear week-by-week timeline, plus the live `TriggerRule[]` running against the foster's logs.

## The four sub-features

### 1. Daily / weekly checklist

Recurring tasks generated from the dog's composed care plan (see [Personalization](#personalization--the-plan-knows-the-dog-and-the-week)). Task set shifts week to week — e.g., "quiet space setup" in week 1 fades once complete; "chew rotation" appears in week 3 for a teething puppy.

**Task types**
- Feeding (2–3×/day, portion from shelter intake)
- Walks / potty breaks
- Medications (with dose + time)
- Weigh-in (weekly by default; daily for underweight intakes)
- Crate practice / training session
- Enrichment (chew, puzzle, sniff walk)

**Behavior**
- Tasks reset daily/weekly on their own cadence.
- Missed tasks roll into a "yesterday" section (not deleted — the shelter cares).
- Tap-to-complete. Long-press to log detail (portion eaten, distance walked, etc.).
- Beginner view shows a "why this matters" line under each task; experienced view hides it.
- **Push notifications** for missed / upcoming tasks (in v1) — feeding-time reminders, meds due, weigh-in day. In-app inbox mirrors them so nothing is lost if the foster missed the push.

**Data**
```
Task {
  id, dog_id, kind, title, cadence: "daily"|"weekly"|"once",
  due_at, completed_at, notes, meta: { portion?, weight?, med_dose?, ... }
}
```

### 2. Vet & milestone timeline

Vertical timeline, newest at top. Merges scheduled and logged events.

**Event types**
- Vet appointments (upcoming + past, with notes)
- Vaccinations / boosters
- Weigh-ins (charted alongside the timeline)
- Training milestones ("first night without whining", "sat on cue", "loose-leash for 10 min")
- Behavior notes ("scared of the vacuum", "loves other dogs at the park")

**Behavior**
- Shelter pre-populates vet appointments and vaccination schedule at intake.
- Foster can add milestones freely; suggestions surface as chips ("Add: first bath?").
- **Weight tracking is a first-class feature** — every weigh-in is a data point on a chart (sparkline inline on the timeline, full chart on tap). Unit toggle in settings (imperial default in US). Weight anchors several triggers (see rules table): flagged loss, flagged plateau in an underweight intake, adoption-profile "gained X lbs in foster" storyline.
- Every milestone becomes an eligible highlight for the adoption profile.

### 3. Photo + notes journal

Chronological journal — the raw material for the adoption profile.

**Entry types**
- Photo (with optional caption)
- Short note ("Marty finally slept through the night!")
- Voice memo → auto-transcribed (nice-to-have; stub for prototype)

**Behavior**
- Prompt daily: "Any photo or moment from today?" (beginner cadence: daily; experienced: every 2–3 days).
- Auto-tag entries with dog age/day-in-foster ("Day 12 with Marty").
- Foster can star favorite entries — starred entries default into the adoption profile.
- Filter by type; grid view for photos, list for notes.

**Data**
```
JournalEntry {
  id, dog_id, kind: "photo"|"note"|"voice",
  created_at, day_in_foster,
  content: { image_url?, caption?, text?, audio_url? },
  starred: bool, tags: string[]
}
```

### 4. "Ask anything" tips layer

Contextual guidance for the pain points fosters actually hit. Three delivery modes: **scheduled** (this week's expected topic), **triggered** (fired by what the foster logs), and **on-demand** (free-form ask). See [Personalization](#personalization--the-plan-knows-the-dog-and-the-week) for the timeline + trigger rules.

**Entry points**
- **Pinned "this week" card** on the Care Plan hub — surfaces the tip for the current week phase (e.g., wet-towel card in week 3 for a puppy) *before* the foster hits the problem.
- **Triggered cards** — appear inline when a rule fires (biting keyword → wet towel card; skipped meals → warm-food + vet CTA).
- Inline "?" on any checklist item ("Why weigh-ins?").
- Free-form ask box: "Ask anything about Marty" — LLM answers scoped to Marty's profile *and* which week/phase she's in, citing seed tips when relevant.
- Emergency banner: "Something wrong? Open Emergency Mode" → 24h vet map (already sketched).

**Seed content (Care Plan v1)**
- Crate training: the food-in-the-crate trick, why crates are safe spaces, timeline.
- Food indiscretion: what dogs can/can't eat, when to call the vet, the safe-people-foods list.
- Biting: the towel trick, redirect-don't-punish, teething vs. reactive.
- House training: schedule, accident cleanup, when it typically clicks.
- Separation practice: departure ritual, gradual absence.

**Behavior**
- Tips are content records, not free-form chat, so we can curate quality.
- Free-form ask calls the LLM with the seeded tips + Marty's profile as context. Answers cite a seed tip when relevant.

## Screens

1. **Care Plan Hub** — landing screen. Day-in-foster counter + **current week phase banner** ("Week 3 · Teething & testing"), today's checklist, **pinned "this week" tip card**, any live triggered cards, next vet appointment, "add journal entry" CTA.
2. **Checklist detail** — expanded checklist with yesterday's misses, cadence editor.
3. **Timeline** — vertical timeline + weight sparkline.
4. **Journal** — grid/list toggle; entry composer.
5. **Tips / Ask** — browsable seed library + free-form ask box.
6. **Emergency Mode** — one-tap access to 24h vet map (already sketched, referenced here for continuity).

## Adaptive behavior (beginner vs. experienced)

| Surface | Beginner | Experienced |
|---|---|---|
| Hub | Big "next thing to do" card, tip pinned | Dense checklist, tips collapsed |
| Checklist items | "Why this matters" shown | Hidden; tap "?" to reveal |
| Journal prompt cadence | Daily | Every 2–3 days |
| Tips card rotation | Auto-rotate | Static / dismissable |
| Language | Warm, reassuring | Direct, terse |

Toggleable in settings — some experienced fosters still want the training wheels for a specific dog.

## Cross-phase links

- **From Phase 3 (Match):** the pre-arrival checklist hands off to the Care Plan on pickup day.
- **Into Phase 5 (Post-Foster):** starred journal entries + training milestones + weight trend auto-compose the adoption profile draft.
- **Sidekick (rescue-ops chat):** shelter staff see aggregate Care Plan status for their fosters (which dogs are logging, which are silent for 3+ days).

## Prototype scope (this branch)

- All four sub-features rendered with seeded mock data for one dog (**Marty, 4mo shepherd mix**).
- Demo control to jump between week 1 / week 3 / week 6 so the personalized timeline is visible without waiting.
- 2–3 trigger rules wired end-to-end (biting keyword → wet towel; skipped meals → warm food + vet; scared-of keyword → reassurance) so the "if X then Y" story is clickable.
- Adaptive toggle so we can demo both beginner and experienced views.
- No real backend — data in local state / JSON fixture (`data/care_plan_templates.json`, `data/trigger_rules.json`).
- "Ask anything" free-form input is a stub for now (returns a seeded response); LLM wiring lands later once we agree on the prompt.

## Decisions

- **Push notifications in v1** — missed / upcoming tasks push to the foster's phone; in-app inbox mirrors.
- **Weight tracking is first-class** — first-class chart, unit toggle in settings (imperial default), anchors several triggers.
- **Opinionated triggers, branched on `DogProfile`** — age / breed / medical flags are known from shelter intake, so rules pick the right playbook without asking the foster to disambiguate.

## Open questions

- "Ask anything" — do we cite the shelter as a source when the tip came from them, so trust is clear?

## Deprioritized (revisit post-v1)

- Realtime shelter visibility into Care Plan (daily digest / dashboard).
- Template authorship model (shelter vs. Pawthway-curated) and review workflow for bad triggered advice.
