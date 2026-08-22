import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ChecklistItem } from "../types";

interface Props {
  /** The shelter-owned approval steps, already filtered by the caller. */
  items: ChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
  onSetAll: (done: boolean) => void;
}

/**
 * Stands in for the shelter's own dashboard, which this hackathon scaffold
 * doesn't build. Fixed-position and visually distinct on purpose -- it should
 * never be mistaken for something a real foster would see.
 */
export function DemoShelterPanel({ items, onToggle, onSetAll }: Props) {
  const [open, setOpen] = useState(false);
  const allDone = items.length > 0 && items.every((i) => i.done);

  return (
    <div style={{ position: "fixed", right: 16, bottom: "var(--demo-panel-bottom, 16px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .96 }}
            style={{
              width: 250, background: "#211A15", color: "#fff", borderRadius: 18, padding: 16,
              boxShadow: "0 14px 40px rgba(0,0,0,.35)", border: "2px dashed rgba(255,255,255,.25)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13 }}>🎬 Demo: shelter side</div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 4, lineHeight: 1.4 }}>
              Not part of the real app -- stands in for the shelter reviewing your application, so
              you can drive the demo yourself.
            </p>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id, !item.done)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                    padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.06)",
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
                    background: item.done ? "var(--sage)" : "transparent", border: item.done ? "none" : "2px solid rgba(255,255,255,.35)",
                    fontSize: 11, color: "#fff",
                  }}>{item.done ? "✓" : ""}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, opacity: item.done ? .6 : 1, textDecoration: item.done ? "line-through" : "none" }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onSetAll(!allDone)}
              style={{
                width: "100%", marginTop: 12, padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 800,
                background: allDone ? "rgba(255,255,255,.1)" : "var(--sage)", color: allDone ? "rgba(255,255,255,.7)" : "#0F2A20",
              }}
            >
              {allDone ? "↺ Reset shelter review" : "✅ Approve everything"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 100,
          background: "#211A15", color: "#fff", fontSize: 12.5, fontWeight: 800,
          boxShadow: "0 8px 22px rgba(0,0,0,.28)", border: "2px dashed rgba(255,255,255,.3)",
        }}
      >
        🎬 {open ? "Close demo" : "Demo controls"}
      </button>
    </div>
  );
}
