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
  errored?: boolean;
}

export interface HealthInfo {
  anthropic_key_set: boolean;
  arcade_available: boolean;
  tool_count: number;
}

export type DogStatus = "available" | "foster" | "medical_hold" | "adopted" | "ready_for_adoption";

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age_years: number;
  weight_lbs: number;
  status: DogStatus;
  intake_date: string;
  good_with_kids: boolean;
  good_with_dogs: boolean;
  notes: string;
  adoption_profile?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface FosterIntake {
  living_arrangement?: string;
  experience_level?: string;
  time_availability?: string;
  size_preference?: string;
  energy_preference?: string;
  restrictions?: string;
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
}

export interface CareLogEntry {
  id: string;
  type: "weigh_in" | "vet_visit" | "note" | "photo";
  note: string;
  value: string;
  photo_url: string;
  created_at: { seconds: number; nanoseconds: number } | null;
}
