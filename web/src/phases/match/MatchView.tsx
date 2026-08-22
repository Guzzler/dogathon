import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { Checklist } from "../../components/Checklist";
import { DEFAULT_APPROVAL_CHECKLIST, DEFAULT_PREP_CHECKLIST } from "../../checklists";
import type { ChecklistItem, Pickup } from "../../types";

export function MatchView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();
  const [pickup, setPickup] = useState<Pickup>({ date: "", time: "", location: "" });

  const dog = dogs.find((d) => d.id === foster?.matchedDogId);

  useEffect(() => {
    if (!foster) return;
    const patch: Record<string, unknown> = {};
    if (!foster.approvalChecklist?.length) patch.approvalChecklist = DEFAULT_APPROVAL_CHECKLIST;
    if (!foster.prepChecklist?.length) patch.prepChecklist = DEFAULT_PREP_CHECKLIST;
    if (Object.keys(patch).length) patchFoster(patch);
    if (foster.pickup) setPickup(foster.pickup);
  }, [foster]);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster || !foster.matchedDogId) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>No match yet</h1>
        <p className="pw-muted">Like a dog in Discovery first to start the approval process.</p>
      </div>
    );
  }

  function toggle(list: "approvalChecklist" | "prepChecklist", id: string, done: boolean) {
    if (!foster) return;
    const items = (foster[list] as ChecklistItem[]).map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ [list]: items });
  }

  async function savePickup() {
    await patchFoster({ pickup });
  }

  async function goToCarePlan() {
    await patchFoster({ phase: "care_plan" });
    navigate("/care-plan");
  }

  return (
    <div className="pw-page">
      <h1>You matched with {dog?.name ?? "your dog"}!</h1>
      <p className="pw-subtitle">Finish approval, prep your home, and schedule pickup.</p>

      <div className="pw-grid">
        <Checklist title="Approval / screening" items={foster.approvalChecklist ?? DEFAULT_APPROVAL_CHECKLIST} onToggle={(id, done) => toggle("approvalChecklist", id, done)} />
        <Checklist title="Get ready at home" items={foster.prepChecklist ?? DEFAULT_PREP_CHECKLIST} onToggle={(id, done) => toggle("prepChecklist", id, done)} />

        <div className="checklist-card">
          <div className="checklist-card__head">
            <h3>Schedule pickup</h3>
          </div>
          <div className="pickup-form">
            <label>
              Date
              <input type="date" value={pickup.date} onChange={(e) => setPickup({ ...pickup, date: e.target.value })} />
            </label>
            <label>
              Time
              <input type="time" value={pickup.time} onChange={(e) => setPickup({ ...pickup, time: e.target.value })} />
            </label>
            <label>
              Location
              <input
                type="text"
                value={pickup.location}
                onChange={(e) => setPickup({ ...pickup, location: e.target.value })}
                placeholder="Shelter address"
              />
            </label>
            <button className="btn btn--ghost" onClick={savePickup}>
              Save pickup time
            </button>
          </div>
        </div>
      </div>

      <button className="btn btn--primary" onClick={goToCarePlan}>
        I've got {dog?.name ?? "the dog"} → start Care Plan
      </button>
    </div>
  );
}
