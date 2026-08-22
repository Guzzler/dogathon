import { useEffect, useState } from "react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { addCareLogEntry, useCareLog } from "../../hooks/useCareLog";
import { Checklist } from "../../components/Checklist";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { DEFAULT_CARE_CHECKLIST } from "../../checklists";
import type { CareLogEntry, ChecklistItem, Dog as DogRecord } from "../../types";
import { fosterWindow } from "../../lib/foster";
import { normalizeDog } from "../../lib/dog";

const ENTRY_LABELS: Record<CareLogEntry["type"], string> = {
  weigh_in: "⚖️ Weigh-in",
  vet_visit: "🩺 Vet visit",
  note: "📝 Note",
  photo: "📷 Photo",
};

export function CarePlanView() {
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();
  const { entries } = useCareLog();
  const [showTips, setShowTips] = useState(false);
  const [entryType, setEntryType] = useState<CareLogEntry["type"]>("note");
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const dog = dogs.find((d) => d.id === foster?.matchedDogId);

  useEffect(() => {
    if (foster && !foster.careChecklist?.length) {
      patchFoster({ careChecklist: DEFAULT_CARE_CHECKLIST });
    }
  }, [foster]);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster || !foster.matchedDogId) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>No dog in care yet</h1>
        <p className="pw-muted">Finish the Match phase first.</p>
      </div>
    );
  }

  function toggle(id: string, done: boolean) {
    if (!foster) return;
    const items = (foster.careChecklist as ChecklistItem[]).map((i) => (i.id === id ? { ...i, done } : i));
    patchFoster({ careChecklist: items });
  }

  async function addEntry() {
    if (!note.trim() && !value.trim() && !photoUrl.trim()) return;
    setSaving(true);
    try {
      await addCareLogEntry({ type: entryType, note, value, photo_url: photoUrl });
      setNote("");
      setValue("");
      setPhotoUrl("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pw-page">
      <h1>Caring for {dog?.name ?? "your foster"}</h1>
      <p className="pw-subtitle">Weigh-ins, vet visits, notes, and photos -- these build the adoption profile later.</p>

      {dog && <FosterCountdown dog={dog} pickupDate={foster.pickup?.date} />}

      <div className="pw-grid">
        <Checklist title="Care plan checklist" items={foster.careChecklist ?? DEFAULT_CARE_CHECKLIST} onToggle={toggle} />

        <div className="checklist-card">
          <div className="checklist-card__head">
            <h3>Log an entry</h3>
          </div>
          <div className="care-log-form">
            <select value={entryType} onChange={(e) => setEntryType(e.target.value as CareLogEntry["type"])}>
              <option value="note">Note</option>
              <option value="weigh_in">Weigh-in</option>
              <option value="vet_visit">Vet visit</option>
              <option value="photo">Photo</option>
            </select>
            {entryType === "weigh_in" && (
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 24 lbs" />
            )}
            {entryType === "photo" && (
              <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL" />
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes…" rows={2} />
            <button className="btn btn--primary" disabled={saving} onClick={addEntry}>
              {saving ? "Saving…" : "Add entry"}
            </button>
          </div>
        </div>
      </div>

      <div className="care-log-timeline">
        <h3>Timeline</h3>
        {entries.length === 0 && <p className="pw-muted">Nothing logged yet.</p>}
        <ul>
          {[...entries].reverse().map((e) => (
            <li key={e.id} className="care-log-entry">
              <span className="care-log-entry__type">{ENTRY_LABELS[e.type]}</span>
              {e.value && <span className="care-log-entry__value">{e.value}</span>}
              {e.note && <span className="care-log-entry__note">{e.note}</span>}
              {e.photo_url && (
                <a href={e.photo_url} target="_blank" rel="noreferrer" className="care-log-entry__note">
                  photo
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn btn--ghost" onClick={() => setShowTips((v) => !v)}>
        {showTips ? "Hide" : "🐾 Ask anything about your dog"}
      </button>

      {showTips && (
        <div className="care-tips-drawer">
          <AgentChatPanel
            placeholder="e.g. how do I crate train a nervous dog?"
            emptyState="Crate training, food safety, biting/behavior -- ask anything about caring for your foster."
          />
        </div>
      )}
    </div>
  );
}

/** How much of the foster window is left, anchored to the pickup date. */
function FosterCountdown({ dog, pickupDate }: { dog: DogRecord; pickupDate: string | undefined }) {
  const d = normalizeDog(dog);
  const win = fosterWindow(d.fosterWeeks, d.fosterLength, pickupDate);

  return (
    <div className="hub-card" style={{ marginBottom: 4 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="chip butter" style={{ fontWeight: 800 }}>🗓️ {win.total} foster</span>
        <span className={`chip ${win.daysLeft < 14 ? "coral" : "sage"}`} style={{ fontWeight: 800 }}>
          ⏳ {win.leftLabel}
        </span>
      </div>
      {win.started && (
        <>
          <div className="fosterbar" aria-label={win.leftLabel}>
            <i style={{ width: `${Math.round(win.progress * 100)}%` }} />
          </div>
          <p className="pw-muted" style={{ marginTop: 9, fontSize: 13 }}>
            {win.endDate && `Heads home around ${win.endDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}.`}{" "}
            Everything you log here becomes {d.name}'s adoption page.
          </p>
        </>
      )}
    </div>
  );
}
