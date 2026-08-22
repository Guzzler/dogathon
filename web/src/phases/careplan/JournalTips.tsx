import { useState } from "react";
import type { JournalEntry, Tip } from "./types";

interface JournalTipsProps {
  entries: JournalEntry[];
  dayInFoster: number;
  dogName: string;
  onAdd: (entry: Omit<JournalEntry, "id" | "createdAt" | "dayInFoster">) => void;
  onToggleStar: (id: string) => void;
  tips: Tip[];
  pinnedTipId: string;
}

type Mode = "note" | "photo" | "ask";

interface AskEntry {
  kind: "ask";
  id: string;
  createdAt: string;
  question: string;
  answer: string;
  citedTip?: Tip;
}

const SWATCH_COLORS = ["#C4955A", "#2D5A3D", "#726A5E", "#A84034", "#2F7A4B"];

const CATEGORY_ORDER = [
  "Adjustment",
  "Crate training",
  "Biting & teething",
  "Feeding",
  "Behavior",
  "Adoption prep",
];

function askAbout(dogName: string, question: string, tips: Tip[]): { text: string; citedTip?: Tip } {
  const q = question.toLowerCase();
  if (/bit|nip|mouth/.test(q)) {
    return {
      text: `For a puppy ${dogName}'s age, biting is almost always teething. Try the wet-towel trick and disengage briefly when hands get mouthy — hands stop being fun when they leave.`,
      citedTip: tips.find((t) => t.id === "tip-biting-teething"),
    };
  }
  if (/eat|food|hungry|meal/.test(q)) {
    return {
      text: `Warm the food, add a spoon of low-sodium broth, or top with a bit of wet food. If ${dogName} skips more than 24 hours, call the vet or shelter.`,
      citedTip: tips.find((t) => t.id === "tip-not-eating"),
    };
  }
  if (/crate|kennel/.test(q)) {
    return {
      text: `Feed every meal inside the crate with the door open — ${dogName} walks in for the food and out on their own. Within a week, the crate becomes 'the good place.'`,
      citedTip: tips.find((t) => t.id === "tip-crate"),
    };
  }
  if (/scare|afraid|hide|fear/.test(q)) {
    return {
      text: `Fear in the first two weeks is normal. Don't force exposure — let ${dogName} retreat, reward calm approaches with high-value treats, and go at their pace.`,
      citedTip: tips.find((t) => t.id === "tip-scared"),
    };
  }
  return {
    text: `We don't have a canned answer for that yet. In the real app this would call an LLM with ${dogName}'s profile + week phase as context. For the prototype, browse the tips library below or check with your shelter contact.`,
  };
}

export function JournalTips({
  entries,
  dayInFoster,
  dogName,
  onAdd,
  onToggleStar,
  tips,
  pinnedTipId,
}: JournalTipsProps) {
  const [mode, setMode] = useState<Mode>("note");
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [asks, setAsks] = useState<AskEntry[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  function submit() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (mode === "note") {
      if (!text.trim()) return;
      onAdd({ kind: "note", text: text.trim(), starred: false });
      setText("");
    } else if (mode === "photo") {
      const color = SWATCH_COLORS[Math.floor(Math.random() * SWATCH_COLORS.length)];
      onAdd({
        kind: "photo",
        imageColor: color,
        caption: caption.trim() || undefined,
        starred: false,
      });
      setCaption("");
    } else {
      if (!text.trim()) return;
      const { text: answer, citedTip } = askAbout(dogName, text.trim(), tips);
      setAsks((prev) => [
        {
          kind: "ask",
          id: `q-${Date.now()}`,
          createdAt: `Day ${dayInFoster} · ${time}`,
          question: text.trim(),
          answer,
          citedTip,
        },
        ...prev,
      ]);
      setText("");
    }
  }

  // Interleave journal entries + ask entries by insertion time (Date.now() suffix in id).
  type FeedItem =
    | (JournalEntry & { _sort: number; _kind: "journal" })
    | (AskEntry & { _sort: number; _kind: "ask" });
  const feed: FeedItem[] = [
    ...entries.map((e) => ({ ...e, _sort: Number(e.id.split("-")[1]) || 0, _kind: "journal" as const })),
    ...asks.map((a) => ({ ...a, _sort: Number(a.id.split("-")[1]) || 0, _kind: "ask" as const })),
  ].sort((a, b) => b._sort - a._sort);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: tips.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  const placeholder =
    mode === "note"
      ? `Something about ${dogName} today…`
      : mode === "photo"
        ? "Photo caption (optional)"
        : `Ask anything about ${dogName}…`;

  const buttonLabel = mode === "note" ? "Log note" : mode === "photo" ? "Add photo" : "Ask";
  const useText = mode !== "photo";
  const composerValue = useText ? text : caption;
  const setComposerValue = useText ? setText : setCaption;
  const canSubmit = mode === "photo" ? true : composerValue.trim().length > 0;

  return (
    <div className="cp-journal-tips">
      <section className="cp-composer-card">
        <div className="cp-composer-modes" role="tablist">
          {(["note", "ask", "photo"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`cp-composer-mode ${mode === m ? "cp-composer-mode--active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "note" ? "Log note" : m === "ask" ? `Ask about ${dogName}` : "Photo"}
            </button>
          ))}
        </div>
        <textarea
          className="cp-composer__textarea"
          placeholder={placeholder}
          value={composerValue}
          rows={mode === "photo" ? 1 : 2}
          onChange={(e) => setComposerValue(e.target.value)}
        />
        <button
          className={`cp-btn ${mode === "ask" ? "cp-btn--primary" : "cp-btn--primary"}`}
          onClick={submit}
          disabled={!canSubmit}
        >
          {buttonLabel}
        </button>
      </section>

      <ul className="cp-journal-list">
        {feed.map((item) => {
          if (item._kind === "ask") {
            return (
              <li key={item.id} className="cp-feed-item cp-feed-item--ask">
                <div className="cp-feed-item__row">
                  <span className="cp-feed-item__tag cp-feed-item__tag--ask">You asked</span>
                  <span className="cp-mini-meta">{item.createdAt}</span>
                </div>
                <p className="cp-feed-item__question">{item.question}</p>
                <div className="cp-feed-item__answer">
                  <p className="cp-eyebrow">Suggested</p>
                  <p>{item.answer}</p>
                  {item.citedTip && (
                    <p className="cp-mini-meta">Cited: <strong>{item.citedTip.title}</strong></p>
                  )}
                </div>
              </li>
            );
          }
          const e = item;
          return (
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
          );
        })}
      </ul>

      <section className="cp-tip-library">
        <button
          type="button"
          className="cp-tip-library__toggle"
          onClick={() => setLibraryOpen((v) => !v)}
          aria-expanded={libraryOpen}
        >
          {libraryOpen ? "▾" : "▸"} Browse care library ({tips.length})
        </button>
        {libraryOpen && (
          <div className="cp-tip-library__body">
            {grouped.map(({ category, items }) => (
              <section key={category} className="cp-tip-group">
                <h3 className="cp-tip-group__title">{category}</h3>
                <ul className="cp-tip-list">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      className={`cp-tip-card cp-tip-card--${t.urgency} ${t.id === pinnedTipId ? "cp-tip-card--pinned" : ""}`}
                    >
                      {t.id === pinnedTipId && <p className="cp-eyebrow">Pinned this week</p>}
                      <h4>{t.title}</h4>
                      <p>{t.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
