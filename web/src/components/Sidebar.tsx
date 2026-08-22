import type { HealthInfo, ToolInfo } from "../types";

interface Props {
  tools: ToolInfo[];
  health: HealthInfo | null;
  onReset: () => void;
}

export function Sidebar({ tools, health, onReset }: Props) {
  return (
    <aside className="sidebar">
      <h1 className="sidebar__title">dogathon agent</h1>

      {health && !health.anthropic_key_set && (
        <div className="banner banner--warn">
          ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart
          the backend.
        </div>
      )}

      <button className="btn btn--ghost" onClick={onReset}>
        New conversation
      </button>

      <h2 className="sidebar__subtitle">
        Tools {health ? `(${health.tool_count})` : ""}
      </h2>
      <ul className="tool-list">
        {tools.map((t) => (
          <li key={t.name} className="tool-list__item">
            <div className="tool-list__row">
              <span className="tool-list__name">{t.name}</span>
              {t.dangerous && <span className="badge badge--dangerous">approval</span>}
            </div>
            <span className="tool-list__desc">{t.description}</span>
          </li>
        ))}
      </ul>

      {health && (
        <div className={`banner ${health.arcade_available ? "banner--ok" : "banner--muted"}`}>
          Arcade toolkits: {health.arcade_available ? "loaded" : "not configured"}
        </div>
      )}
    </aside>
  );
}
