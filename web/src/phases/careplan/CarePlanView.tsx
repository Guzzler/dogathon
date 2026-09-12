import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DemoCarePanel } from "../../components/DemoCarePanel";
import { useDogs } from "../../hooks/useDogs";
import { useFoster } from "../../hooks/useFoster";
import { useCareSchedule, useJournal } from "../../hooks/useJournal";
import { normalizeDog, dogPhotoOrNull } from "../../lib/dog";
import { DEMO_MODE } from "../../lib/demoMode";
import { LOCAL_MODE } from "../../lib/localMode";
import type { Dog } from "../../types";
import {
  daysSincePickup,
  emergencyContacts,
  tips as rawTips,
  weekPhases,
} from "./data";
import { medicalSummary as demoMedical, seedMilestones as demoMilestones } from "./data.demo";
import { buildAgentBrief } from "./brief";
import { buildPlanTimeline } from "./plan";
import { Emergency } from "./Emergency";
import { Hub } from "./Hub";
import { JournalTips } from "./JournalTips";
import { firedRules } from "./triggers";
import type {
  DogProfile,
  ExperienceLevel,
  JournalEntry,
  Milestone,
  Tip,
} from "./types";
import "./carePlan.css";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDogProfile(dog: Dog, pickupDate: string): DogProfile {
  const d = normalizeDog(dog);
  return {
    id: d.id,
    name: d.name,
    breed: d.breed,
    ageMonths: Math.max(1, Math.round(d.age_years * 12)),
    // Nullable all the way through. The old `?? 0` was justified in a comment as reading
    // "unknown" in the Care Plan header — no header renders it; the two readers are the
    // emergency screen and the agent brief, and both printed the zero as a fact.
    weightLbs: d.weight_lbs ?? null,
    pickupDate,
    careNeeds: d.needs ?? [],
    backstory: d.notes,
    photoUrl: dogPhotoOrNull(d, 600, 600) ?? undefined,
  };
}

type View = "hub" | "journal" | "emergency";

/** `/care-plan` is Home; `/care-plan/journal` and `/care-plan/emergency` are the other two. */
function viewFromParam(tab: string | undefined): View {
  return tab === "journal" || tab === "emergency" ? tab : "hub";
}

function dateLabelForDay(day: number, pickupIso: string): string {
  const [y, m, d] = pickupIso.split("-").map(Number);
  const target = new Date(y, m - 1, d + (day - 1));
  return target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const DAY_OPTIONS = [
  { day: 1, label: "Day 1 · Decompression" },
  { day: 8, label: "Day 8 · Week 2" },
  { day: 15, label: "Day 15 · Week 3" },
  { day: 22, label: "Day 22 · Week 4" },
  { day: 42, label: "Day 42 · Week 6+" },
];

function phaseForDay(day: number) {
  const weekIndex = Math.min(Math.max(Math.ceil(day / 7), 1), 6);
  return (
    weekPhases.find((p) => p.index === weekIndex) ??
    weekPhases[weekPhases.length - 1]
  );
}

export function CarePlanView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  const matchedDog = useMemo(
    () => (foster?.matchedDogId ? dogs.find((d) => d.id === foster.matchedDogId) : undefined),
    [foster?.matchedDogId, dogs],
  );

  const pickupIso = foster?.pickup?.date || todayIso();
  const dog: DogProfile | null = matchedDog ? toDogProfile(matchedDog, pickupIso) : null;

  const { tab } = useParams();
  const view = viewFromParam(tab);
  const openView = (v: View) => navigate(v === "hub" ? "/care-plan" : `/care-plan/${v}`);
  const [dayInFoster, setDayInFoster] = useState(() => daysSincePickup(pickupIso));
  const [experience, setExperience] = useState<ExperienceLevel>("beginner");
  const [journal, setJournal] = useJournal();   // persisted, so the adoption page sees it too
  const [schedule, setSchedule] = useCareSchedule();   // persisted, so Adopt sees ticks live

  const phase = phaseForDay(dayInFoster);

  // Everything the foster had logged as of the day we're showing. Writes still go to the full
  // list — this only governs what's on screen and what the trigger rules can see.
  const journalToDate = useMemo(
    () => journal.filter((e) => e.dayInFoster <= dayInFoster),
    [journal, dayInFoster],
  );

  // Seed copy is written with a `{dog}` placeholder so it reads for whoever is actually
  // matched — and so the model's context doesn't talk about a dog the foster doesn't have.
  const dogName = dog?.name ?? "your dog";
  const fill = (t: string) => t.replaceAll("{dog}", dogName);

  const tips = useMemo(
    () => rawTips.map((t) => ({ ...t, title: fill(t.title), body: fill(t.body) })),
    [dogName],
  );
  // The only milestone a real foster has is the one the app can prove: the day the dog came
  // home, taken from the pickup they scheduled in Match. Everything else on this timeline used
  // to be a demo dog's past -- dated vet visits, boosters and weigh-ins, relabelled with this
  // dog's name and then printed on the adoption page as though the foster had logged them.
  const milestones = useMemo<Milestone[]>(() => {
    if (LOCAL_MODE) {
      return demoMilestones.map((m) => ({
        ...m,
        title: fill(m.title),
        note: m.note ? fill(m.note) : m.note,
      }));
    }
    return foster?.pickup?.date
      ? [{ id: "m-pickup", dayInFoster: 1, title: `${dogName} came home`, kind: "behavior" }]
      : [];
  }, [dogName, foster?.pickup?.date]);

  const tipsById = useMemo(() => {
    const m: Record<string, Tip> = {};
    tips.forEach((t) => (m[t.id] = t));
    return m;
  }, [tips]);

  const fired = useMemo(
    () =>
      firedRules({
        entries: journalToDate,
        tasks: [],
        profile: dog ?? { id: "", name: "", breed: "", ageMonths: 0, weightLbs: null, pickupDate: pickupIso, careNeeds: [], backstory: "" },
        dayInFoster,
      }),
    [journalToDate, dayInFoster],
  );

  function toggleScheduled(blockId: string, itemId: string) {
    setSchedule((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              items: b.items.map((it) =>
                it.id === itemId ? { ...it, done: !it.done } : it,
              ),
            }
          : b,
      ),
    );
  }

  function addJournalEntry(
    entry: Omit<JournalEntry, "id" | "createdAt" | "dayInFoster">,
  ) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setJournal((prev) => [
      {
        ...entry,
        id: `j-${Date.now()}`,
        createdAt: `Day ${dayInFoster} · ${time}`,
        dayInFoster,
      },
      ...prev,
    ]);
  }

  function toggleStar(id: string) {
    setJournal((prev) => prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));
  }

  if (loading) {
    return <div className="cp-stage cp-stage--empty"><p className="cp-mini-meta">Loading Care Plan…</p></div>;
  }

  if (!dog) {
    return (
      <div className="cp-stage cp-stage--empty">
        <div className="cp-empty-card">
          <p className="cp-eyebrow">No foster yet</p>
          <h2>Finish the Match phase first</h2>
          <p className="cp-mini-meta">
            Your Care Plan unlocks once you've been matched with a dog. Head to Match to
            confirm approval and schedule pickup.
          </p>
          <button className="cp-btn cp-btn--primary" onClick={() => navigate("/match")}>
            Open Match →
          </button>
        </div>
      </div>
    );
  }

  const dayOptionsWithDates = DAY_OPTIONS.map((o) => ({
    ...o,
    dateLabel: dateLabelForDay(o.day, pickupIso),
  }));

  return (
    <div className="cp-stage cp-stage--solo">
      {DEMO_MODE && (
        <DemoCarePanel
          day={dayInFoster}
          onSetDay={setDayInFoster}
          dayOptions={dayOptionsWithDates}
          experience={experience}
          onSetExperience={setExperience}
        />
      )}

      <main className="cp-main" role="application">
        {view === "hub" && (
          <Hub
            dog={dog}
            dayInFoster={dayInFoster}
            phase={phase}
            blocks={schedule}
            milestones={milestones}
            onToggleScheduled={toggleScheduled}
            pinnedTip={tipsById[phase.pinnedTipId]}
            firedRules={fired}
            tipsById={tipsById}
            experience={experience}
            onOpen={openView}
          />
        )}
        {view === "journal" && (
          <JournalTips
            entries={journalToDate}
            dayInFoster={dayInFoster}
            dogName={dog.name}
            dogPhotoUrl={dog.photoUrl}
            dogContext={buildAgentBrief({
              dog,
              dayInFoster,
              phase,
              weeks: buildPlanTimeline(schedule, milestones, dayInFoster),
              milestones,
              pinnedTip: tipsById[phase.pinnedTipId],
              firedRules: fired,
              tipsById,
            })}
            onAdd={addJournalEntry}
            onToggleStar={toggleStar}
            tips={tips}
            pinnedTipId={phase.pinnedTipId}
          />
        )}
        {view === "emergency" && (
          <Emergency
            dog={dog}
            summary={LOCAL_MODE ? demoMedical : undefined}
            contacts={emergencyContacts}
          />
        )}
      </main>
    </div>
  );
}
