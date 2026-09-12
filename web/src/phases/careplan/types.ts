export interface DogProfile {
  id: string;
  name: string;
  breed: string;
  ageMonths: number;
  /**
   * `null` when the shelter never weighed this dog — `weight_lbs` is optional by design and
   * the add-a-dog form makes it so. Never coerce to 0: every reader of this field either
   * prints it or tells the model, and "0 lbs at intake" is a claim about a real animal.
   */
  weightLbs: number | null;
  pickupDate: string;
  /**
   * The shelter's `needs` list, under the name it actually has. It was `medicalFlags`, which
   * was wrong about every dog in the roster — the whole vocabulary is behavioural ("Leash
   * training", "Only dog in the home"), so the brief was labelling training notes as medical.
   * An empty array means nothing was recorded, not that nothing is wrong.
   */
  careNeeds: string[];
  backstory: string;
  photoUrl?: string;
}

export type TaskKind =
  | "feeding"
  | "walk"
  | "med"
  | "weigh"
  | "crate"
  | "enrich"
  | "setup"
  | "train";

export interface TaskTemplate {
  id: string;
  kind: TaskKind;
  title: string;
  why: string;
  cadence: "daily" | "weekly" | "once";
  appearsWeek: number;
  disappearsWeek?: number;
}

export interface TaskState {
  templateId: string;
  completedAt?: string;
}

export type MilestoneKind = "vet" | "vaccine" | "weigh" | "training" | "behavior";

export interface Milestone {
  id: string;
  dayInFoster: number;
  title: string;
  kind: MilestoneKind;
  note?: string;
  weightLbs?: number;
  upcoming?: boolean;
}

export type JournalKind = "note" | "photo";

export interface JournalEntry {
  id: string;
  createdAt: string;
  dayInFoster: number;
  kind: JournalKind;
  text?: string;
  imageColor?: string;
  /** Set once real photo upload exists; until then entries carry `imageColor` only. */
  photoUrl?: string;
  caption?: string;
  starred: boolean;
}

export type TipUrgency = "info" | "warn" | "escalate";

export interface Tip {
  id: string;
  title: string;
  category: string;
  body: string;
  urgency: TipUrgency;
}

export interface WeekPhase {
  index: number;
  name: string;
  eyebrow: string;
  taskTemplateIds: string[];
  pinnedTipId: string;
  milestonePrompts: string[];
}

export interface TriggerContext {
  entries: JournalEntry[];
  tasks: TaskState[];
  profile: DogProfile;
  dayInFoster: number;
}

export interface TriggerRule {
  id: string;
  /** Rules read the journal within a recency window — see `anyNoteMatches` in triggers.ts. */
  label: string;
  tipId: string;
  urgency: TipUrgency;
  cta?: string;
  match: (ctx: TriggerContext) => boolean;
}

export type ExperienceLevel = "beginner" | "experienced";

export interface ScheduledCareItem {
  id: string;
  label: string;
  kind: "vaccine" | "wellness" | "grooming" | "medication" | "training" | "checkup";
  done: boolean;
}

export interface ScheduleBlock {
  id: string;
  label: string;
  startDay: number;
  items: ScheduledCareItem[];
}

export interface MedicalSummary {
  vaccines: string[];
  allergies: string[];
  medications: string[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  distanceMi?: number;
  hours?: string;
}
