import type { PlanWeek } from "./plan";
import type { DogProfile, Milestone, Tip, TriggerRule, WeekPhase } from "./types";

interface BriefInput {
  dog: DogProfile;
  dayInFoster: number;
  phase: WeekPhase;
  weeks: PlanWeek[];
  milestones: Milestone[];
  pinnedTip: Tip;
  firedRules: TriggerRule[];
  tipsById: Record<string, Tip>;
}

/**
 * The context every Care Plan question carries with it.
 *
 * An answer about a 4-month-old shepherd in decompression week is a different answer than one
 * about the same dog in week 6, so the model gets the composed plan — this dog, this week,
 * what's outstanding, what's been logged — rather than the dog's name alone.
 *
 * It also gets the tips the UI is currently showing (the pinned card and any fired trigger
 * rules). That's deliberate: the screen and the answer disagreeing is worse than either being
 * slightly off, and a foster reading "keep frozen towels ready" on the hub shouldn't get
 * contradicting advice when they ask about biting.
 */
export function buildAgentBrief({
  dog,
  dayInFoster,
  phase,
  weeks,
  milestones,
  pinnedTip,
  firedRules,
  tipsById,
}: BriefInput): string {
  const lines: string[] = [];

  lines.push(
    `You are Pawthway's care assistant, helping a foster look after ${dog.name}: a ` +
      `${dog.ageMonths}-month-old ${dog.breed}, ${dog.weightLbs} lbs at intake.` +
      (dog.medicalFlags.length ? ` Medical flags: ${dog.medicalFlags.join(", ")}.` : " No medical flags.") +
      (dog.backstory ? ` Shelter's note: ${dog.backstory}` : ""),
  );
  lines.push(`Today is day ${dayInFoster} of the foster — ${phase.eyebrow}, "${phase.name}".`);

  const current = weeks.find((w) => w.current);
  if (current) {
    const open = current.rows.filter((r) => r.status === "todo" || r.status === "planned");
    const done = current.rows.filter((r) => r.status === "done" || r.status === "logged");
    const soon = current.rows.filter((r) => r.status === "upcoming");
    lines.push(
      `This week's plan (${current.label}, ${current.dayRange}): ` +
        (open.length ? `still open — ${open.map((r) => r.title).join(", ")}. ` : "") +
        (soon.length
          ? `coming up — ${soon.map((r) => `${r.title} (day ${r.day})`).join(", ")}. `
          : "") +
        (done.length ? `already done — ${done.map((r) => r.title).join(", ")}.` : "") ||
        `This week's plan (${current.label}): nothing scheduled.`,
    );
  }

  // Anything the plan expected before now and still hasn't seen.
  const overdue = weeks
    .filter((w) => !w.current && w.startDay < dayInFoster)
    .flatMap((w) => w.rows.filter((r) => r.status === "todo"))
    .map((r) => r.title);
  if (overdue.length) lines.push(`Overdue from earlier weeks: ${overdue.join(", ")}.`);

  const recent = milestones
    .filter((m) => m.dayInFoster <= dayInFoster)
    .sort((a, b) => b.dayInFoster - a.dayInFoster)
    .slice(0, 4)
    .map((m) => `day ${m.dayInFoster}: ${m.title}${m.note ? ` (${m.note})` : ""}`);
  if (recent.length) lines.push(`Recently logged — ${recent.join("; ")}.`);

  const weights = milestones
    .filter((m) => m.weightLbs != null && m.dayInFoster <= dayInFoster)
    .sort((a, b) => a.dayInFoster - b.dayInFoster);
  if (weights.length >= 2) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    lines.push(
      `Weight: ${first.weightLbs} lbs on day ${first.dayInFoster} → ${last.weightLbs} lbs on ` +
        `day ${last.dayInFoster}.`,
    );
  }

  lines.push(`The hub is currently showing this tip: "${pinnedTip.title}" — ${pinnedTip.body}`);

  if (firedRules.length) {
    const fired = firedRules
      .map((r) => {
        const tip = tipsById[r.tipId];
        return `${r.label} → ${tip ? `"${tip.title}": ${tip.body}` : r.tipId}`;
      })
      .join(" | ");
    lines.push(
      `Alerts already on their screen (stay consistent with these, don't contradict them): ${fired}`,
    );
  }

  lines.push(
    "Answer as this foster's guide. Be concise — a foster reads this one-handed with a puppy " +
      "in the other arm, so lead with the thing to do and cut everything that isn't load- " +
      "bearing. No preamble, no restating the question, no sign-off. Be specific to this " +
      "dog's age, breed and week; generic advice is the thing we're replacing. Never invent " +
      "anything about the dog that isn't above — if you don't know, say what to check. If it " +
      "sounds medical or urgent, say to call the vet or shelter first.",
  );

  return lines.join("\n");
}
