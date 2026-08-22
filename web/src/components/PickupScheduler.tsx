import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Shelter } from "../lib/shelters";
import type { Pickup } from "../types";

const TIME_SLOTS = ["9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM"];
const WEEKDAY_HEAD = ["S", "M", "T", "W", "T", "F", "S"];
// Shelters in this world are closed Sun/Mon -- gives the calendar real gaps to show off.
const CLOSED_DAYS = new Set([0, 1]);
const LEAD_DAYS = 2; // shelters need a couple days' notice after approval
const WINDOW_DAYS = 28;

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  shelter: Shelter;
  onConfirm: (pickup: Pickup) => void | Promise<void>;
}

export function PickupScheduler({ shelter, onConfirm }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const minDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + LEAD_DAYS); return d; }, [today]);
  const maxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + WINDOW_DAYS); return d; }, [today]);

  const [monthCursor, setMonthCursor] = useState(() => new Date(minDate.getFullYear(), minDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canGoPrev = monthCursor.getFullYear() > minDate.getFullYear() || monthCursor.getMonth() > minDate.getMonth();
  const canGoNext = monthCursor.getFullYear() < maxDate.getFullYear() || monthCursor.getMonth() < maxDate.getMonth();

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: { date: Date | null; iso: string | null; available: boolean }[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push({ date: null, iso: null, available: false });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const available = d >= minDate && d <= maxDate && !CLOSED_DAYS.has(d.getDay());
      out.push({ date: d, iso: toISO(d), available });
    }
    return out;
  }, [monthCursor, minDate, maxDate]);

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : null;

  async function confirm() {
    if (!selectedDate || !selectedTime) return;
    setSaving(true);
    try {
      await onConfirm({ date: selectedDate, time: selectedTime, location: shelter.address });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, borderRadius: 22 }}>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--coral-soft)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 17 }}>📍</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Pickup happens at {shelter.name}</div>
          <div className="muted" style={{ marginTop: 1 }}>{shelter.address}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className="iconbtn" disabled={!canGoPrev} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
          style={{ opacity: canGoPrev ? 1 : .3, width: 32, height: 32, fontSize: 13 }}>‹</button>
        <span className="sp" />
        <b style={{ fontSize: 14 }}>{monthLabel}</b>
        <span className="sp" />
        <button type="button" className="iconbtn" disabled={!canGoNext} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
          style={{ opacity: canGoNext ? 1 : .3, width: 32, height: 32, fontSize: 13 }}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAY_HEAD.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "var(--ink-3)", padding: "2px 0" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} />;
          const isSelected = c.iso === selectedDate;
          return (
            <button
              key={i}
              type="button"
              disabled={!c.available}
              onClick={() => { setSelectedDate(c.iso); setSelectedTime(null); }}
              style={{
                aspectRatio: "1", borderRadius: 12, fontSize: 13, fontWeight: 800,
                background: isSelected ? "var(--coral)" : c.available ? "#fff" : "transparent",
                color: isSelected ? "#fff" : c.available ? "var(--ink)" : "var(--ink-3)",
                boxShadow: c.available && !isSelected ? "var(--shadow)" : "none",
                opacity: c.available ? 1 : .35,
                cursor: c.available ? "pointer" : "not-allowed",
                transition: "transform .12s ease",
              }}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 11.5 }}>Closed Sundays &amp; Mondays · earliest pickup is {LEAD_DAYS} days out</p>

      {selectedDate && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 9 }}>{selectedLabel}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIME_SLOTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTime(t)}
                style={{
                  padding: "9px 14px", borderRadius: 100, fontSize: 13, fontWeight: 800,
                  background: selectedTime === t ? "var(--coral)" : "#fff",
                  color: selectedTime === t ? "#fff" : "var(--ink-2)",
                  boxShadow: "var(--shadow)", border: "2px solid transparent",
                  borderColor: selectedTime === t ? "var(--coral)" : "transparent",
                  transition: "transform .12s ease",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {selectedDate && selectedTime && (
        <motion.button
          type="button" className="btn" disabled={saving} onClick={confirm}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ width: "100%", marginTop: 16 }}
        >
          {saving ? "Scheduling…" : `Schedule for ${selectedLabel} · ${selectedTime}`}
        </motion.button>
      )}
    </div>
  );
}
