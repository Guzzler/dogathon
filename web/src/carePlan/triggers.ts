import type { TriggerContext, TriggerRule } from "./types";

function anyNoteMatches(ctx: TriggerContext, patterns: RegExp[]): boolean {
  return ctx.entries.some(
    (e) => e.text && patterns.some((p) => p.test(e.text!)),
  );
}

export const triggerRules: TriggerRule[] = [
  {
    id: "rule-biting-puppy",
    label: "Biting reported — puppy playbook",
    tipId: "tip-biting-teething",
    urgency: "warn",
    cta: "Try the wet towel trick",
    match: (ctx) =>
      ctx.profile.ageMonths < 6 &&
      anyNoteMatches(ctx, [/\bbit(e|ing|ten)?\b/i, /\bnipp/i, /\bmouth[yi]/i]),
  },
  {
    id: "rule-biting-adult",
    label: "Biting reported — adult playbook",
    tipId: "tip-biting-adult",
    urgency: "escalate",
    cta: "Contact shelter behavior team",
    match: (ctx) =>
      ctx.profile.ageMonths >= 6 &&
      anyNoteMatches(ctx, [/\bbit(e|ing|ten)?\b/i, /\bnipp/i, /\bmouth[yi]/i]),
  },
  {
    id: "rule-not-eating",
    label: "Skipped meals",
    tipId: "tip-not-eating",
    urgency: "warn",
    cta: "Warm the food, then call vet if 24h+",
    match: (ctx) =>
      anyNoteMatches(ctx, [
        /\bnot eating\b/i,
        /\bwon'?t eat\b/i,
        /\bskipped (a )?meal/i,
        /\brefused (the )?food/i,
      ]),
  },
  {
    id: "rule-crate-refusal",
    label: "Crate resistance",
    tipId: "tip-crate-refusal",
    urgency: "info",
    match: (ctx) =>
      anyNoteMatches(ctx, [
        /\bcrate\b.*\bwhin/i,
        /won'?t go in\b/i,
        /\bhates? (the )?crate\b/i,
      ]),
  },
  {
    id: "rule-scared",
    label: "Fear behavior noted",
    tipId: "tip-scared",
    urgency: "info",
    match: (ctx) =>
      anyNoteMatches(ctx, [/\bscared of\b/i, /\bafraid\b/i, /\bhid(es?|ing) from\b/i]),
  },
];

export function firedRules(ctx: TriggerContext): TriggerRule[] {
  return triggerRules.filter((r) => r.match(ctx));
}
