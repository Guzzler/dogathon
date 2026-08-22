import type { ChecklistItem } from "./types";

// Mirrors the defaults in src/agent/builtin/foster.py -- keep both in sync.
export const DEFAULT_APPROVAL_CHECKLIST: ChecklistItem[] = [
  { id: "application", label: "Foster application submitted", done: false },
  { id: "home-check", label: "Home environment check", done: false },
  { id: "reference-check", label: "Reference check", done: false },
  { id: "orientation", label: "Foster orientation completed", done: false },
];

export const DEFAULT_PREP_CHECKLIST: ChecklistItem[] = [
  { id: "crate", label: "Crate", done: false },
  { id: "food", label: "Food + bowls", done: false },
  { id: "leash", label: "Leash + collar/harness", done: false },
  { id: "bed", label: "Bed or blanket", done: false },
  { id: "id-tag", label: "ID tag", done: false },
];

export const DEFAULT_CARE_CHECKLIST: ChecklistItem[] = [
  { id: "weigh-in-1", label: "First weigh-in", done: false },
  { id: "vet-visit", label: "Vet check-up scheduled", done: false },
  { id: "feeding-routine", label: "Feeding routine established", done: false },
  { id: "photos", label: "Photos added for adoption profile", done: false },
];
