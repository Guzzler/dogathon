import type { Milestone, ScheduleBlock, ScheduledCareItem } from "./types";

/**
 * The care plan and the care record used to be two lists stacked in the same week: the
 * scheduled chips ("DHPP booster", "Weight check") and the logged milestones ("DHPP booster",
 * "Weigh-in — 22 lbs"). They describe the same events, so the same shot showed up twice and
 * the plan's week never agreed with the day it actually happened.
 *
 * This merges them into one row per real event. A scheduled item and the milestone that
 * records it collapse together — the milestone's day wins, because that's when it happened,
 * not when it was penciled in.
 */

/** Care topics we can recognise in both a plan label and a logged milestone title. */
const TOPICS: Array<[string, RegExp]> = [
  ["dhpp", /\bdhpp\b|distemper|parvo/i],
  ["bordetella", /bordetella|kennel cough/i],
  ["rabies", /\brabies\b/i],
  ["heartworm", /heartworm/i],
  ["flea", /flea|tick\b/i],
  ["deworm", /deworm|worming/i],
  ["weight", /weigh|weight/i],
  ["nails", /\bnail/i],
  ["dental", /dental|teeth clean/i],
  ["fecal", /fecal|stool/i],
  ["skin", /\bskin\b|\bcoat\b/i],
  ["teething", /teeth(ing)?\b|chew/i],
  ["cue-training", /\bsit\b|\btouch\b|\bcue\b/i],
  ["leash", /leash|walk\b/i],
  ["wellness", /wellness|intake|vet (check|visit)|check-?in with/i],
];

function topicOf(text: string): string | null {
  for (const [topic, re] of TOPICS) if (re.test(text)) return topic;
  return null;
}

export type RowStatus = "logged" | "done" | "todo" | "planned" | "upcoming";

export interface PlanRow {
  key: string;
  /** Known only once something is dated — a milestone, or a scheduled item that has one. */
  day?: number;
  title: string;
  /** Drives the coloured kind chip. */
  kind: ScheduledCareItem["kind"];
  kindLabel: string;
  note?: string;
  status: RowStatus;
  /** Present when a schedule item backs the row, so the foster can still tick it off. */
  toggle?: { blockId: string; itemId: string };
  /** Set when a milestone confirms a scheduled item actually happened. */
  recordedDay?: number;
}

export interface PlanWeek {
  id: string;
  label: string;
  startDay: number;
  endDay: number | null;
  dayRange: string;
  passed: boolean;
  current: boolean;
  rows: PlanRow[];
}

const SCHED_KIND_LABEL: Record<ScheduledCareItem["kind"], string> = {
  vaccine: "Vaccine",
  wellness: "Wellness",
  grooming: "Grooming",
  medication: "Med",
  training: "Training",
  checkup: "Check",
};

const MILE_KIND_LABEL: Record<Milestone["kind"], string> = {
  vet: "Vet",
  vaccine: "Vaccine",
  weigh: "Weigh-in",
  training: "Training",
  behavior: "Behavior",
};

/** Milestone kinds borrow the schedule palette so a merged row looks like one thing. */
function chipKind(k: Milestone["kind"]): ScheduledCareItem["kind"] {
  if (k === "vaccine") return "vaccine";
  if (k === "training") return "training";
  if (k === "weigh" || k === "vet") return "checkup";
  return "wellness";
}

/**
 * One chronological list per week bucket. Scheduled items pair with the milestone that records
 * them (same topic, nearest day), and the pair lands in the week the milestone actually falls
 * in — so Bordetella stops appearing under both Week 3 and Month 2.
 */
export function buildPlanTimeline(
  blocks: ScheduleBlock[],
  milestones: Milestone[],
  dayInFoster: number,
): PlanWeek[] {
  const sorted = [...blocks].sort((a, b) => a.startDay - b.startDay);

  const bucketFor = (day: number): number => {
    let idx = 0;
    sorted.forEach((b, i) => { if (day >= b.startDay) idx = i; });
    return idx;
  };

  const rows: PlanRow[][] = sorted.map(() => []);
  const claimed = new Set<string>();

  sorted.forEach((block, blockIdx) => {
    block.items.forEach((item) => {
      const topic = topicOf(item.label);
      // The record for this item, if the foster (or shelter) logged one.
      const blockEnd = sorted[blockIdx + 1]?.startDay ?? Infinity;
      const candidates = topic
        ? milestones.filter((m) => !claimed.has(m.id) && topicOf(m.title) === topic)
        : [];
      // A record inside the planned week wins; otherwise take the nearest one, which is how a
      // shot that slipped a fortnight still lands on the row that scheduled it.
      const match =
        candidates.find((m) => m.dayInFoster >= block.startDay && m.dayInFoster < blockEnd) ??
        candidates.sort(
          (a, b) =>
            Math.abs(a.dayInFoster - block.startDay) - Math.abs(b.dayInFoster - block.startDay),
        )[0];

      if (match) {
        claimed.add(match.id);
        const upcoming = match.dayInFoster > dayInFoster;
        rows[bucketFor(match.dayInFoster)].push({
          key: item.id,
          day: match.dayInFoster,
          // The record's own title wins when it carries a value ("Weigh-in — 22 lbs");
          // otherwise the plan's label is the more descriptive of the two.
          title: /\d/.test(match.title) ? match.title : item.label,
          kind: item.kind,
          kindLabel: SCHED_KIND_LABEL[item.kind],
          note: upcoming ? undefined : match.note,
          status: upcoming ? "upcoming" : item.done ? "done" : "logged",
          toggle: { blockId: block.id, itemId: item.id },
          recordedDay: upcoming ? undefined : match.dayInFoster,
        });
      } else {
        // Nothing logged against it yet — it stays a plain to-do in its planned week.
        rows[blockIdx].push({
          key: item.id,
          title: item.label,
          kind: item.kind,
          kindLabel: SCHED_KIND_LABEL[item.kind],
          status: item.done ? "done" : block.startDay > dayInFoster ? "planned" : "todo",
          toggle: { blockId: block.id, itemId: item.id },
        });
      }
    });
  });

  // Milestones with no scheduled counterpart — the story the foster logged themselves.
  milestones
    .filter((m) => !claimed.has(m.id))
    .forEach((m) => {
      const upcoming = m.dayInFoster > dayInFoster;
      rows[bucketFor(m.dayInFoster)].push({
        key: m.id,
        day: m.dayInFoster,
        title: m.title,
        kind: chipKind(m.kind),
        kindLabel: MILE_KIND_LABEL[m.kind],
        note: upcoming ? undefined : m.note,
        status: upcoming ? "upcoming" : "logged",
      });
    });

  return sorted.map((block, i) => {
    const next = sorted[i + 1]?.startDay ?? null;
    const endDay = next == null ? null : next - 1;
    const current = dayInFoster >= block.startDay && (next == null || dayInFoster < next);
    // Dated rows run in order; undated plan items trail behind them.
    const ordered = [...rows[i]].sort((a, b) => {
      if (a.day == null && b.day == null) return 0;
      if (a.day == null) return 1;
      if (b.day == null) return -1;
      return a.day - b.day;
    });
    return {
      id: block.id,
      label: block.label,
      startDay: block.startDay,
      endDay,
      dayRange: endDay == null ? `Day ${block.startDay}+` : `Day ${block.startDay}–${endDay}`,
      passed: dayInFoster >= block.startDay,
      current,
      rows: ordered,
    };
  });
}
