import type { ExperienceLevel, TaskState, TaskTemplate } from "./types";

interface ChecklistProps {
  tasks: TaskTemplate[];
  taskState: Record<string, TaskState>;
  onToggle: (id: string) => void;
  experience: ExperienceLevel;
}

const KIND_LABEL: Record<TaskTemplate["kind"], string> = {
  feeding: "Feeding",
  walk: "Walk",
  med: "Meds",
  weigh: "Weigh-in",
  crate: "Crate",
  enrich: "Enrichment",
  setup: "Setup",
  train: "Training",
};

export function Checklist({ tasks, taskState, onToggle, experience }: ChecklistProps) {
  return (
    <div className="cp-checklist">
      <header className="cp-view-header">
        <h2>Checklist</h2>
        <p className="cp-mini-meta">
          Tasks composed from Marty's care plan for this week. Tap a circle to complete.
        </p>
      </header>

      <ul className="cp-task-list cp-task-list--full">
        {tasks.map((task) => {
          const done = !!taskState[task.id]?.completedAt;
          return (
            <li key={task.id} className={`cp-task cp-task--full ${done ? "cp-task--done" : ""}`}>
              <button
                className="cp-check"
                aria-pressed={done}
                onClick={() => onToggle(task.id)}
              >
                {done ? "✓" : ""}
              </button>
              <div className="cp-task__body">
                <div className="cp-task__row">
                  <p className="cp-task__title">{task.title}</p>
                  <span className="cp-kind-chip">{KIND_LABEL[task.kind]}</span>
                </div>
                {experience === "beginner" && (
                  <p className="cp-task__why">{task.why}</p>
                )}
                <p className="cp-mini-meta">
                  {task.cadence === "daily" ? "Repeats daily" : task.cadence === "weekly" ? "Repeats weekly" : "One-time setup"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
