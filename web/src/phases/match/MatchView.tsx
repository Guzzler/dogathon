import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { PickupScheduler } from "../../components/PickupScheduler";
import { DemoShelterPanel } from "../../components/DemoShelterPanel";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_PREP_CHECKLIST, checklistOwner } from "../../checklists";
import { normalizeDog, photoUrl } from "../../lib/dog";
import type { ChecklistItem, Pickup } from "../../types";

const STAGES = ["Applied", "Under review", "Approved", "Pickup"];

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

  const approval = foster.approvalChecklist ?? DEFAULT_APPROVAL_CHECKLIST;
  const prep = foster.prepChecklist ?? DEFAULT_PREP_CHECKLIST;
  const yourSteps = approval.filter((i) => (i.owner ?? checklistOwner(i.id)) === "foster");
  const shelterSteps = approval.filter((i) => (i.owner ?? checklistOwner(i.id)) === "shelter");
  // The badge tracks only the shelter's own review; scheduling needs both sides finished.
  const shelterApproved = shelterSteps.length > 0 && shelterSteps.every((i) => i.done);
  const approved = approval.length > 0 && approval.every((i) => i.done);
  const activeIdx = foster.pickup ? 3 : approved ? 2 : 1;

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

      <div className="scroll pad" style={{ paddingTop: 6, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Dog header */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="row" style={{ gap: 13 }}>
          <div style={{ width: 62, height: 62, borderRadius: 18, flexShrink: 0, background: `var(--cream-2) url(${photoUrl(dog.photoId, 300, 300)}) center/cover` }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 22 }}>You matched with {dog.name}!</h2>
            <p className="muted" style={{ marginTop: 2 }}>{dog.shelter.name}</p>
          </div>
        </motion.div>

        {/* Approval badge + timeline */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .05 }} className="card" style={{ padding: 17 }}>
          <div className={`chip ${shelterApproved ? "sage" : "butter"}`} style={{ fontWeight: 800 }}>
            {shelterApproved ? "✓ Shelter approved you as a foster" : "⏳ Waiting on shelter review"}
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

        {/* Your steps */}
        <Section title="Your steps">
          <div className="card" style={{ padding: 6 }}>
            {yourSteps.map((item, i) => (
              <StepRow key={item.id} item={item} last={i === yourSteps.length - 1} onToggle={(done) => setApprovalItem(item.id, done)} />
            ))}
          </div>
        </Section>

        {/* Shelter review */}
        <Section title={`What ${dog.shelter.short} handles`}>
          <div className="card" style={{ padding: 6 }}>
            {shelterSteps.map((item, i) => (
              <StepRow key={item.id} item={item} last={i === shelterSteps.length - 1} locked />
            ))}
          </div>
        </Section>

        {/* Get ready at home */}
        <Section title="Get ready at home">
          <div className="card" style={{ padding: 6 }}>
            {prep.map((item, i) => (
              <StepRow key={item.id} item={item} last={i === prep.length - 1} onToggle={(done) => togglePrep(item.id, done)} />
            ))}
          </div>
        </Section>

        {/* Pickup */}
        <Section title="Schedule pickup">
          {!approved ? (
            <div className="card" style={{ padding: 20, textAlign: "center", background: "var(--cream-2)", boxShadow: "none", border: "2px dashed var(--line)" }}>
              <div style={{ fontSize: 26 }}>🔒</div>
              <p className="sub" style={{ marginTop: 8, fontSize: 13.5 }}>
                {shelterApproved
                  ? "Finish your own steps above and pickup scheduling opens up."
                  : `Pickup scheduling unlocks once ${dog.shelter.short} finishes their review.`}
              </p>
            </div>
          ) : foster.pickup ? (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card" style={{ padding: 18 }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--sage-soft)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 18 }}>🗓️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{pickupDateLabel}</div>
                  <div className="muted" style={{ marginTop: 2 }}>{foster.pickup.time} · {foster.pickup.location}</div>
                </div>
              </div>
            </motion.div>
          ) : (
            <PickupScheduler shelter={dog.shelter} onConfirm={confirmPickup} />
          )}
        </Section>

        {/* Chat once pickup is locked in */}
        {foster.pickup && (
          <Section title={`Chat with ${dog.shelter.short}`}>
            <div className="care-tips-drawer" style={{ height: 380 }}>
              <AgentChatPanel
                placeholder="Ask about parking, what to bring…"
                emptyState={`Confirmed for ${pickupDateLabel} at ${foster.pickup.time}. Ask ${dog.shelter.short} anything before pickup.`}
                quickActions={[{
                  label: "Confirm pickup + ask what to bring",
                  message: `I just scheduled pickup for ${dog.name} on ${pickupDateLabel} at ${foster.pickup.time}. Can you confirm that works and let me know what I should bring?`,
                }]}
              />
            </div>
          </Section>
        )}

        <button className="btn" disabled={!foster.pickup} title={!foster.pickup ? "Schedule pickup first" : undefined} onClick={goToCarePlan}>
          I've got {dog.name} → start Care Plan
        </button>
      </div>

      <DemoShelterPanel items={shelterSteps} onToggle={setApprovalItem} onSetAll={setAllShelterItems} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 9 }}>{title}</div>
      {children}
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
        padding: "11px 11px", borderRadius: 14, cursor: clickable ? "pointer" : "default",
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12,
        background: item.done ? "var(--sage)" : locked ? "var(--cream-2)" : "#fff",
        color: item.done ? "#fff" : "var(--ink-3)",
        border: item.done ? "none" : locked ? "none" : "2px solid var(--line)",
      }}>
        {item.done ? "✓" : locked ? "⏳" : ""}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, opacity: item.done ? .55 : 1, textDecoration: item.done ? "line-through" : "none" }}>
        {item.label}
      </span>
      <span className="sp" />
      {locked && !item.done && <span className="muted" style={{ fontSize: 11 }}>Shelter</span>}
    </button>
  );
}
