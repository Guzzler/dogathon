import { useState } from "react";
import type { Tip } from "./types";

interface TipsProps {
  tips: Tip[];
  pinnedTipId: string;
  dogName: string;
}

const CATEGORY_ORDER = [
  "Adjustment",
  "Crate training",
  "Biting & teething",
  "Feeding",
  "Behavior",
  "Adoption prep",
];

export function Tips({ tips, pinnedTipId, dogName }: TipsProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; citedTip?: Tip } | null>(null);

  function ask() {
    if (!question.trim()) return;
    const q = question.toLowerCase();
    let cited: Tip | undefined;
    let text = `Great question — here's what we'd suggest for ${dogName}.`;
    if (/bit|nip|mouth/.test(q)) {
      cited = tips.find((t) => t.id === "tip-biting-teething");
      text = `For a puppy Marty's age, biting is almost always teething. Try the wet-towel trick and disengage briefly when hands get mouthy — hands stop being fun when they leave.`;
    } else if (/eat|food|hungry|meal/.test(q)) {
      cited = tips.find((t) => t.id === "tip-not-eating");
      text = `Warm the food, add a spoon of low-sodium broth, or top with a bit of wet food. If Marty skips more than 24 hours, call the vet or shelter.`;
    } else if (/crate|kennel/.test(q)) {
      cited = tips.find((t) => t.id === "tip-crate");
      text = `Feed every meal inside the crate with the door open — Marty walks in for the food and out on his own. Within a week, the crate becomes 'the good place.'`;
    } else if (/scare|afraid|hide|fear/.test(q)) {
      cited = tips.find((t) => t.id === "tip-scared");
      text = `Fear in the first two weeks is normal. Don't force exposure — let Marty retreat, reward calm approaches with high-value treats, and go at his pace.`;
    } else {
      text = `We don't have a canned answer for that yet. In the real app this would call an LLM with Marty's profile + week phase as context. For the prototype, browse the tips below or check with your shelter contact.`;
    }
    setAnswer({ text, citedTip: cited });
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: tips.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="cp-tips">
      <header className="cp-view-header">
        <h2>Tips & ask anything</h2>
        <p className="cp-mini-meta">
          Answers are scoped to {dogName}'s age, breed, and where you are in the foster timeline.
        </p>
      </header>

      <section className="cp-ask">
        <textarea
          className="cp-composer__textarea"
          placeholder={`Ask anything about ${dogName}…`}
          value={question}
          rows={2}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="cp-btn cp-btn--primary" onClick={ask} disabled={!question.trim()}>
          Ask
        </button>
        {answer && (
          <article className="cp-answer">
            <p className="cp-eyebrow">Answer</p>
            <p>{answer.text}</p>
            {answer.citedTip && (
              <p className="cp-mini-meta">
                Cited: <strong>{answer.citedTip.title}</strong>
              </p>
            )}
          </article>
        )}
      </section>

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
  );
}
