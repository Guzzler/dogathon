import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { PickupScheduler } from "../../components/PickupScheduler";
import { DemoShelterPanel } from "../../components/DemoShelterPanel";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_PREP_CHECKLIST, checklistOwner } from "../../checklists";
import { normalizeDog, photoUrl } from "../../lib/dog";
import { downloadIcs } from "../../lib/calendar";
import { DEMO_MODE } from "../../lib/demoMode";
import type { ChecklistItem, Pickup } from "../../types";

const STAGES = ["Applied", "Under review", "Approved", "Pickup"];

/** How long each shelter-side review step takes to clear. See the effect below. */
const REVIEW_STEP_MS = 6000;

export function MatchView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  const raw = dogs.find((d) => d.id === foster?.matchedDogId);
  const dog = raw ? normalizeDog(raw) : null;

  useEffect(() => {
    if (!foster) return;
    const patch: Record<string, unknown> = {};
    if (!foster.approvalChecklist?.length) patch.approvalChecklist = DEFAULT_APPROVAL_CHECKLIST;
    if (!foster.prepChecklist?.length) patch.prepChecklist = DEFAULT_PREP_CHECKLIST;
    if (Object.keys(patch).length) patchFoster(patch);
  }, [foster]);

  // Derived above the early returns so the review effect below can be a hook.
  const approvalItems = foster?.approvalChecklist ?? DEFAULT_APPROVAL_CHECKLIST;
  const ownerOf = (i: ChecklistItem) => i.owner ?? checklistOwner(i.id);
  const yourStepsAll = approvalItems.filter((i) => ownerOf(i) === "foster");
  const shelterStepsAll = approvalItems.filter((i) => ownerOf(i) === "shelter");
  const yourStepsDone = yourStepsAll.length > 0 && yourStepsAll.every((i) => i.done);
  const nextShelterStep = shelterStepsAll.find((i) => !i.done);

  // There's no shelter dashboard in this app, so the review that would happen on
  // their side happens here: once the foster has finished their own steps, the
  // shelter's clear one at a time. Demo mode leaves it to the panel instead, so a
  // walkthrough can move at whatever pace the room needs.
  useEffect(() => {
    if (DEMO_MODE || !foster || !yourStepsDone || !nextShelterStep) return;
    const id = nextShelterStep.id;
    const timer = setTimeout(() => {
      const items = (foster.approvalChecklist ?? DEFAULT_APPROVAL_CHECKLIST).map((i) =>
        i.id === id ? { ...i, done: true } : i,
      );
      patchFoster({ approvalChecklist: items });
    }, REVIEW_STEP_MS);
    return () => clearTimeout(timer);
  }, [foster, yourStepsDone, nextShelterStep]);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster || !foster.matchedDogId || !dog) {
    return (
      <div className="screen pad" style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>📋</div>
        <h3 style={{ marginTop: 14 }}>No match yet</h3>
        <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
          Apply to foster a dog from Saved or a dog's profile to start the approval process here.
        </p>
        <button className="btn outline sm" style={{ margin: "20px auto 0" }} onClick={() => navigate("/discovery")}>
          Find dogs
        </button>
      </div>
    );
  }

  const approval = approvalItems;
  const prep = foster.prepChecklist ?? DEFAULT_PREP_CHECKLIST;
  const yourSteps = yourStepsAll;
  const shelterSteps = shelterStepsAll;
  // The badge tracks only the shelter's own review; scheduling needs both sides finished.
  const shelterApproved = shelterSteps.length > 0 && shelterSteps.every((i) => i.done);
  const approved = approval.length > 0 && approval.every((i) => i.done);
  const activeIdx = foster.pickup ? 3 : approved ? 2 : 1;
  // Only true once the foster has done their part and the shelter is still working.
  const reviewInProgress = !DEMO_MODE && yourStepsDone && !shelterApproved;

  function setApprovalItem(id: string, done: boolean) {
    const items = approval.map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ approvalChecklist: items });
  }
  function setAllShelterItems(done: boolean) {
    const items = approval.map((i) => ((i.owner ?? checklistOwner(i.id)) === "shelter" ? { ...i, done } : i));
    patchFoster({ approvalChecklist: items });
  }
  function togglePrep(id: string, done: boolean) {
    const items = prep.map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ prepChecklist: items });
  }
  async function confirmPickup(pickup: Pickup) {
    await patchFoster({ pickup });
  }
  async function goToCarePlan() {
    await patchFoster({ phase: "care_plan" });
    navigate("/care-plan");
  }

  const pickupDateLabel = foster.pickup
    ? new Date(foster.pickup.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <div className="screen">
      <div className="topbar"><h3>Match &amp; pickup</h3></div>

      <div className="scroll pad" style={{ paddingTop: 6, paddingBottom: 34, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Dog header */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="row" style={{ gap: 13 }}>
          <div style={{ width: 56, height: 56, borderRadius: 17, flexShrink: 0, background: `var(--cream-2) url(${photoUrl(dog.photoId, 300, 300)}) center/cover` }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 20 }}>You matched with {dog.name}!</h2>
            <p className="muted" style={{ marginTop: 2 }}>{dog.shelter.name}</p>
          </div>
        </motion.div>

        {/* Approval badge + timeline */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .05 }} className="card" style={{ padding: 15 }}>
          <div className={`chip ${shelterApproved ? "sage" : "butter"}`} style={{ fontWeight: 800 }}>
            {shelterApproved
              ? "✓ Shelter approved you as a foster"
              : reviewInProgress
                ? "⏳ Shelter is reviewing your application"
                : "⏳ Waiting on shelter review"}
          </div>
          <div className="tl">
            {STAGES.map((label, n) => (
              <div key={label} className="tl-step" data-done={n < activeIdx} data-now={n === activeIdx}>
                <span className="tl-dot">{n < activeIdx ? "✓" : ""}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </motion.div>

        <ChecklistSection title="Your steps" items={yourSteps} onToggle={setApprovalItem} />
        <ChecklistSection title={`What ${dog.shelter.short} handles`} items={shelterSteps} locked />
        <ChecklistSection title="Get ready at home" items={prep} onToggle={togglePrep} />

        {/* Pickup */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>Schedule pickup</div>
          {!approved ? (
            <>
              <button className="btn" disabled>🔒 Schedule pickup</button>
              <p className="muted" style={{ textAlign: "center", marginTop: 8, fontSize: 12 }}>
                {shelterApproved
                  ? "Finish your own steps to unlock this."
                  : `Unlocks once ${dog.shelter.short} finishes their review.`}
              </p>
            </>
          ) : foster.pickup ? (
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card" style={{ padding: 15 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--sage-soft)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 17 }}>🗓️</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{pickupDateLabel}</div>
                  <div className="muted" style={{ marginTop: 2 }}>{foster.pickup.time} · {foster.pickup.location}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 13 }}>
                <button
                  type="button"
                  className="btn outline sm"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => downloadIcs({
                    dogName: dog.name,
                    shelterName: dog.shelter.name,
                    date: foster.pickup!.date,
                    time: foster.pickup!.time,
                    location: foster.pickup!.location,
                  })}
                >
                  Add to calendar
                </button>
                <button
                  type="button"
                  className="btn outline sm"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => patchFoster({ pickup: null })}
                >
                  Reschedule
                </button>
              </div>
            </motion.div>
          ) : (
            <PickupScheduler shelter={dog.shelter} onConfirm={confirmPickup} />
          )}
        </div>

        {/* Chat once pickup is locked in */}
        {foster.pickup && (
          <div className="match-chat">
            <div className="eyebrow" style={{ marginBottom: 9 }}>Chat with {dog.shelter.short}</div>
            <AgentChatPanel
              activityMode="minimal"
              placeholder="Ask about parking, what to bring…"
              emptyState={`You're confirmed for ${pickupDateLabel} at ${foster.pickup.time}. Ask us anything before the day.`}
              quickActions={[
                {
                  label: "What should I bring?",
                  message: `I'm picking up ${dog.name} on ${pickupDateLabel} at ${foster.pickup.time}. What should I bring?`,
                },
                {
                  label: "How long does it take?",
                  message: `How long should I set aside for the ${dog.name} pickup appointment?`,
                },
                {
                  label: "Parking?",
                  message: `Where should I park for pickup at ${dog.shelter.name}?`,
                },
              ]}
            />
          </div>
        )}

        <button
          className="btn sm"
          style={{ margin: "2px auto 0" }}
          disabled={!foster.pickup}
          title={!foster.pickup ? "Schedule pickup first" : undefined}
          onClick={goToCarePlan}
        >
          I've got {dog.name} → start Care Plan
        </button>
      </div>

      {DEMO_MODE && (
        <DemoShelterPanel items={shelterSteps} onToggle={setApprovalItem} onSetAll={setAllShelterItems} />
      )}
    </div>
  );
}

/**
 * Collapses itself once every item is ticked, so a finished checklist stops eating
 * the screen and the pickup section stays reachable without a long scroll. An
 * explicit tap always wins over that default.
 */
function ChecklistSection({ title, items, onToggle, locked }: {
  title: string;
  items: ChecklistItem[];
  onToggle?: (id: string, done: boolean) => void;
  locked?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  if (!items.length) return null;

  const doneCount = items.filter((i) => i.done).length;
  const complete = doneCount === items.length;
  const open = override ?? !complete;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride(!open)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0 2px 9px", textAlign: "left" }}
      >
        <span className="eyebrow">{title}</span>
        <span className="sp" />
        <span className="muted" style={{ fontSize: 11.5, fontWeight: 800, color: complete ? "var(--sage)" : undefined }}>
          {complete ? "✓ all done" : `${doneCount}/${items.length}`}
        </span>
        <span style={{ fontSize: 13, lineHeight: 1, color: "var(--ink-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>⌄</span>
      </button>

      {open && (
        <div className="card" style={{ padding: 6 }}>
          {items.map((item, i) => (
            <StepRow
              key={item.id}
              item={item}
              last={i === items.length - 1}
              locked={locked}
              onToggle={onToggle ? (done) => onToggle(item.id, done) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ item, onToggle, locked, last }: { item: ChecklistItem; onToggle?: (done: boolean) => void; locked?: boolean; last?: boolean }) {
  const clickable = !locked && !!onToggle;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onToggle?.(!item.done)}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
        padding: "10px 11px", borderRadius: 14, cursor: clickable ? "pointer" : "default",
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <span style={{
        width: 21, height: 21, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12,
        background: item.done ? "var(--sage)" : locked ? "var(--cream-2)" : "#fff",
        color: item.done ? "#fff" : "var(--ink-3)",
        border: item.done ? "none" : locked ? "none" : "2px solid var(--line)",
      }}>
        {item.done ? "✓" : locked ? "⏳" : ""}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, opacity: item.done ? .55 : 1, textDecoration: item.done ? "line-through" : "none" }}>
        {item.label}
      </span>
      <span className="sp" />
      {locked && !item.done && <span className="muted" style={{ fontSize: 11 }}>Shelter</span>}
    </button>
  );
}
