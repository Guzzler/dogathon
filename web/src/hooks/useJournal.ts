import { useCallback, useEffect, useRef } from "react";
import type { JournalEntry, ScheduleBlock } from "../phases/careplan/types";
import { scheduleBlocks as seedSchedule, seedJournal } from "../phases/careplan/data";
import { LOCAL_MODE } from "../lib/localMode";
import { patchFoster, useFoster } from "./useFoster";

type Updater = (prev: JournalEntry[]) => JournalEntry[];

/**
 * The Care Plan journal, persisted on the foster document.
 *
 * Deliberately mirrors the `useState` tuple the Care Plan already used, so wiring it up was a
 * one-line change there. Persisting it is what lets the adoption page read the same entries —
 * before this, the journal only existed in Care Plan's component state.
 */
export function useJournal(): [JournalEntry[], (updater: Updater) => void] {
  const { foster } = useFoster();
  const stored = foster?.journal;

  // Seed once, so a foster who has never opened Care Plan still sees the demo entries.
  const seeded = useRef(false);
  useEffect(() => {
    if (!foster || stored || seeded.current) return;
    seeded.current = true;
    patchFoster({ journal: seedJournal });
  }, [foster, stored]);

  const journal = stored ?? seedJournal;

  const setJournal = useCallback(
    (updater: Updater) => { patchFoster({ journal: updater(stored ?? seedJournal) }); },
    [stored],
  );

  return [journal, setJournal];
}

/** Read-only view for anything outside Care Plan (the adoption page). */
export function useJournalEntries(): JournalEntry[] {
  const { foster } = useFoster();
  return foster?.journal ?? (LOCAL_MODE ? seedJournal : []);
}


type ScheduleUpdater = (prev: ScheduleBlock[]) => ScheduleBlock[];

/**
 * The Care Plan's care schedule, persisted the same way as the journal — ticking off a vet
 * visit or a medication has to be visible on the adoption page's health record, which can't
 * happen while it lives in component state.
 */
export function useCareSchedule(): [ScheduleBlock[], (updater: ScheduleUpdater) => void] {
  const { foster } = useFoster();
  const stored = foster?.careSchedule;

  const seeded = useRef(false);
  useEffect(() => {
    if (!foster || stored || seeded.current) return;
    seeded.current = true;
    patchFoster({ careSchedule: seedSchedule });
  }, [foster, stored]);

  const setSchedule = useCallback(
    (updater: ScheduleUpdater) => { patchFoster({ careSchedule: updater(stored ?? seedSchedule) }); },
    [stored],
  );

  return [stored ?? seedSchedule, setSchedule];
}

/** Read-only view for the adoption page. */
export function useCareScheduleBlocks(): ScheduleBlock[] {
  const { foster } = useFoster();
  return foster?.careSchedule ?? (LOCAL_MODE ? seedSchedule : []);
}
