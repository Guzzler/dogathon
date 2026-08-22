import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface DayOption {
  day: number;
  label: string;
  dateLabel?: string;
}

interface Props {
  day: number;
  onSetDay: (day: number) => void;
  dayOptions: DayOption[];
  experience: "beginner" | "experienced";
  onSetExperience: (v: "beginner" | "experienced") => void;
}

/**
 * Sibling of DemoShelterPanel. Fixed to the bottom-right and visually distinct so
 * nobody confuses it with real app UI. Lets the demo driver jump to different
 * days-in-foster and swap the foster's experience level, so the same Care Plan
 * screen can show what care looks like on Day 1, Week 2, Week 6, etc.
 */
export function DemoCarePanel({ day, onSetDay, dayOptions, experience, onSetExperience }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .96 }}
            style={{
              width: 270, background: "#211A15", color: "#fff", borderRadius: 18, padding: 16,
              boxShadow: "0 14px 40px rgba(0,0,0,.35)", border: "2px dashed rgba(255,255,255,.25)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13 }}>🎬 Demo: care timeline</div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 4, lineHeight: 1.4 }}>
              Not part of the real app — jump to different days to preview how the care plan
              evolves over the foster period.
            </p>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginBottom: 2 }}>
                Day in foster
              </div>
              {dayOptions.map((opt) => {
                const active = opt.day === day;
                return (
                  <button
                    key={opt.day}
                    type="button"
                    onClick={() => onSetDay(opt.day)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, width: "100%", textAlign: "left",
                      padding: "8px 10px", borderRadius: 10,
                      background: active ? "var(--sage, #4A7C50)" : "rgba(255,255,255,.06)",
                      color: active ? "#0F2A20" : "#fff",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{opt.label}</span>
                    {opt.dateLabel && (
                      <span style={{ fontSize: 11, opacity: 0.75 }}>{opt.dateLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginBottom: 2 }}>
                Foster experience
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["beginner", "experienced"] as const).map((lvl) => {
                  const active = experience === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onSetExperience(lvl)}
                      style={{
                        flex: 1, padding: "8px 10px", borderRadius: 10,
                        background: active ? "var(--sage, #4A7C50)" : "rgba(255,255,255,.06)",
                        color: active ? "#0F2A20" : "#fff",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                        fontSize: 12, fontWeight: 800, textTransform: "capitalize",
                      }}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
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
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        🎬 {open ? "Close demo" : "Demo controls"}
      </button>
    </div>
  );
}
