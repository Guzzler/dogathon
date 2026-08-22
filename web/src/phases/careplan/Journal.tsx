import { useState } from "react";
import type { JournalEntry } from "./types";

interface JournalProps {
  entries: JournalEntry[];
  dayInFoster: number;
  dogName: string;
  onAdd: (entry: Omit<JournalEntry, "id" | "createdAt" | "dayInFoster">) => void;
  onToggleStar: (id: string) => void;
}

const SWATCH_COLORS = ["#C4955A", "#2D5A3D", "#726A5E", "#A84034", "#2F7A4B"];

export function Journal({ entries, dayInFoster, dogName, onAdd, onToggleStar }: JournalProps) {
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");

  const sorted = [...entries].sort((a, b) => b.dayInFoster - a.dayInFoster);

  function submitNote() {
    if (!text.trim()) return;
    onAdd({ kind: "note", text: text.trim(), starred: false });
    setText("");
  }

  function submitPhoto() {
    const color = SWATCH_COLORS[Math.floor(Math.random() * SWATCH_COLORS.length)];
    onAdd({
      kind: "photo",
      imageColor: color,
      caption: caption.trim() || undefined,
      starred: false,
    });
    setCaption("");
  }

  return (
    <div className="cp-journal">
      <header className="cp-view-header">
        <h2>Journal</h2>
        <p className="cp-mini-meta">
          Photos and notes from Day {dayInFoster}. Starred entries become part of {dogName}'s adoption profile.
        </p>
      </header>

      <section className="cp-composer">
        <textarea
          className="cp-composer__textarea"
          placeholder={`Something about ${dogName} today…`}
          value={text}
          rows={2}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="cp-btn cp-btn--primary" onClick={submitNote} disabled={!text.trim()}>
          Log note
        </button>
      </section>

      <section className="cp-composer">
        <input
          className="cp-composer__input"
          placeholder="Photo caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <button className="cp-btn cp-btn--ghost" onClick={submitPhoto}>
          + Add photo
        </button>
      </section>

      <ul className="cp-journal-list">
        {sorted.map((e) => (
          <li key={e.id} className={`cp-journal-entry cp-journal-entry--${e.kind}`}>
            {e.kind === "photo" && (
              <div
                className="cp-journal-photo"
                style={{ background: e.imageColor ?? "#C4955A" }}
                aria-label="Photo placeholder"
              >
                <span>{e.dayInFoster}</span>
              </div>
            )}
            <div className="cp-journal-entry__body">
              <div className="cp-journal-entry__row">
                <p className="cp-mini-meta">{e.createdAt}</p>
                <button
                  className={`cp-star ${e.starred ? "cp-star--on" : ""}`}
                  onClick={() => onToggleStar(e.id)}
                  aria-pressed={e.starred}
                  aria-label={e.starred ? "Unstar entry" : "Star entry"}
                >
                  ★
                </button>
              </div>
              {e.kind === "note" && <p className="cp-journal-text">{e.text}</p>}
              {e.kind === "photo" && e.caption && <p className="cp-journal-text">{e.caption}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
