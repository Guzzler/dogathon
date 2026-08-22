import { useCallback, useEffect, useRef } from "react";
import type { JournalEntry } from "../phases/careplan/types";
import { seedJournal } from "../phases/careplan/data";
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
