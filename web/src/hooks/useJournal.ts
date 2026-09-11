import { useCallback } from "react";
import type { JournalEntry, ScheduleBlock } from "../phases/careplan/types";
import { scheduleBlocks } from "../phases/careplan/data";
import { seedJournal } from "../phases/careplan/data.demo";
import { LOCAL_MODE } from "../lib/localMode";
import { patchFoster, useFoster } from "./useFoster";

/**
 * The starting point for a foster who has logged nothing yet.
 *
 * Outside `LOCAL_MODE` that is empty, and it has to be: a demo dog's journal and a
 * pre-ticked care schedule are assertions about a specific animal, and writing them onto a
 * real foster's document made them indistinguishable from things that foster observed — they
 * reached the adoption page as a weight "from the care plan" and another dog's vaccination
 * record. A fresh clone shows a banner saying the data is local, so the demo content is
 * honest behind that banner and nowhere else.
 */
const seedIfLocal = <T,>(seed: T[]): T[] => (LOCAL_MODE ? seed : []);

type Updater = (prev: JournalEntry[]) => JournalEntry[];

/**
 * The Care Plan journal, persisted on the foster document.
 *
 * Deliberately mirrors the `useState` tuple the Care Plan already used, so wiring it up was a
 * one-line change there. Persisting it is what lets the adoption page read the same entries —
 * before this, the journal only existed in Care Plan's component state.
 *
 * Nothing is written until the foster writes something. There is no seeding effect: a foster
 * who opens Care Plan and leaves gains no `journal` field at all.
 */
export function useJournal(): [JournalEntry[], (updater: Updater) => void] {
  const { foster } = useFoster();
  const stored = foster?.journal;

  const journal = stored ?? seedIfLocal(seedJournal);

  const setJournal = useCallback(
    (updater: Updater) => { patchFoster({ journal: updater(stored ?? seedIfLocal(seedJournal)) }); },
    [stored],
  );

  return [journal, setJournal];
}

/** Read-only view for anything outside Care Plan (the adoption page). */
export function useJournalEntries(): JournalEntry[] {
  const { foster } = useFoster();
  return foster?.journal ?? seedIfLocal(seedJournal);
}


type ScheduleUpdater = (prev: ScheduleBlock[]) => ScheduleBlock[];

/**
 * The Care Plan's care schedule, persisted the same way as the journal — ticking off a vet
 * visit or a medication has to be visible on the adoption page's health record, which can't
 * happen while it lives in component state.
 *
 * `scheduleBlocks` is a template (every row unticked), so it is safe to show in any mode; it
 * is still only persisted once the foster actually ticks something.
 */
export function useCareSchedule(): [ScheduleBlock[], (updater: ScheduleUpdater) => void] {
  const { foster } = useFoster();
  const stored = foster?.careSchedule;

  const setSchedule = useCallback(
    (updater: ScheduleUpdater) => { patchFoster({ careSchedule: updater(stored ?? scheduleBlocks) }); },
    [stored],
  );

  return [stored ?? scheduleBlocks, setSchedule];
}

/**
 * Read-only view for the adoption page. Unlike the Care Plan's own view this does *not* fall
 * back to the blank template: an untouched schedule is "nothing ticked off yet", and the page
 * says so rather than listing rows nobody has looked at.
 */
export function useCareScheduleBlocks(): ScheduleBlock[] {
  const { foster } = useFoster();
  return foster?.careSchedule ?? [];
}
