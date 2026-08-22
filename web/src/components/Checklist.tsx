import type { ChecklistItem } from "../types";

interface Props {
  title: string;
  items: ChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
}

export function Checklist({ title, items, onToggle }: Props) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="checklist-card">
      <div className="checklist-card__head">
        <h3>{title}</h3>
        <span className="checklist-card__count">
          {doneCount}/{items.length}
        </span>
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id} className="checklist__item">
            <label>
              <input type="checkbox" checked={item.done} onChange={(e) => onToggle(item.id, e.target.checked)} />
              <span className={`checklist__label ${item.done ? "checklist__label--done" : ""}`}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
