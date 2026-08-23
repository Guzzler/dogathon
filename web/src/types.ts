import type { JournalEntry, ScheduleBlock } from "./phases/careplan/types";

export type EventKind =
  | "text"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "turn_end"
  | "error";

export interface AgentEvent {
  kind: EventKind;
  text: string;
  name?: string;
  args?: Record<string, unknown>;
  is_error?: boolean;
  /** Set on `error` frames so the UI can branch without parsing the message. */
  code?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  dangerous: boolean;
}

export interface ToolCallState {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  dangerous: boolean;
  status: "pending_approval" | "running" | "done" | "error";
  result?: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  toolCalls?: ToolCallState[];
  /**
   * Set when the turn failed. Kept separate from `text` so a failure renders as
   * its own notice with a retry, instead of being appended to whatever partial
   * answer had already streamed in.
   */
  error?: { message: string; code: string };
}

export interface HealthInfo {
  anthropic_key_set: boolean;
  arcade_available: boolean;
  tool_count: number;
}

export type DogStatus = "available" | "foster" | "medical_hold" | "adopted" | "ready_for_adoption";

export type DogSize = "small" | "medium" | "large";

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age_years: number;
  /** Optional: some sources publish a size bucket but never a weight. */
  weight_lbs?: number;
  status: DogStatus;
  intake_date?: string;
  // Tri-state: null means the shelter didn't record it. Never coerce to false — that
  // renders as a factual claim ("Not recommended") about a real animal.
  good_with_kids: boolean | null;
  good_with_dogs: boolean | null;
  notes: string;
  adoption_profile?: string;

  // Added for Discovery. All optional — dogs seeded before these existed still
  // render, because `normalizeDog()` derives sensible values from the fields above.
  /** Preferred over deriving from weight — a published bucket beats a guessed number. */
  size?: DogSize;
  shelter_id?: string;
  good_with_cats?: boolean | null;
  energy_level?: number;          // 0 (couch potato) – 4 (zoomies)
  grooming?: "low" | "high";
  coat?: "short" | "long";
  traits?: string[];
  needs?: string[];
  foster_weeks?: number;   // expected foster stay, 1–16
  foster_length?: string;  // legacy free text; foster_weeks wins when both exist
  photo?: number;          // placedog id, for seeded/demo dogs only
  photo_urls?: string[];   // real photos from the source, preferred when present

  /** Denormalised from the source org. Real shelters aren't in `shelters.ts`. */
  shelter?: { id: string; name: string; short: string; address: string; lat: number; lng: number };

  /** The shelter says this dog already has a foster. Shown as status, never used to hide them. */
  in_foster_home?: boolean;

  // Provenance, so a re-import can tell its own records apart from seeded ones.
  source?: string;
  source_url?: string;
  imported_at?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Who actually completes this step in a real foster process. Missing = "foster". */
  owner?: "foster" | "shelter";
}

/**
 * The six string fields are what the agent reads (`src/agent/builtin/foster.py`), so
 * onboarding keeps writing them. The `pref_*` fields below carry the same answers in the
 * structured form the matching function needs; both are written together.
 */
export interface FosterIntake {
  living_arrangement?: string;
  experience_level?: string;
  time_availability?: string;
  size_preference?: string;
  energy_preference?: string;
  restrictions?: string;

  pref_size?: number;      // 0 (small) – 100 (large)
  pref_energy?: number;    // 0 – 4, matches Dog.energy_level
  pref_home?: "apartment" | "townhouse" | "houseYard";
  pref_experience?: "first" | "experienced";
  pref_tags?: string[];
}

export type FosterPhase = "onboarding" | "discovery" | "match" | "care_plan" | "complete";

export interface Pickup {
  date: string;
  time: string;
  location: string;
}

export interface Foster {
  id: string;
  name: string;
  phase: FosterPhase;
  intake: FosterIntake;
  likedDogIds: string[];
  passedDogIds: string[];
  matchedDogId: string | null;
  approvalChecklist: ChecklistItem[];
  prepChecklist: ChecklistItem[];
  careChecklist: ChecklistItem[];
  pickup: Pickup | null;
  readyForAdoption: boolean;

  /** Care Plan journal, persisted so the adoption page can read the same entries. */
  journal?: JournalEntry[];
  /** Care Plan schedule, persisted so ticking an item updates the adoption page. */
  careSchedule?: ScheduleBlock[];
  /** The foster's own note for the adoption page. Never generated. */
  adoptionNote?: string;
  /** Cached tags extracted from journal notes — see web/src/lib/highlights.ts. */
  adoptionHighlights?: { tags: string[]; summary: string; fromNoteCount: number };
}

export interface CareLogEntry {
  id: string;
  type: "weigh_in" | "vet_visit" | "note" | "photo";
  note: string;
  value: string;
  photo_url: string;
  created_at: { seconds: number; nanoseconds: number } | null;
}
