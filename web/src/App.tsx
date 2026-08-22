import { useEffect, useRef, useState } from "react";
import { getHealth, getTools, resetChat, sendApproval, streamChat } from "./api";
import { sidekickTheme, themeVars } from "./brand";
import { CarePlan } from "./carePlan/CarePlan";
import { ApprovalModal } from "./components/ApprovalModal";
import { Sidebar } from "./components/Sidebar";
import { TurnView } from "./components/TurnView";
import type { AgentEvent, HealthInfo, ToolCallState, ToolInfo, Turn } from "./types";
import "./App.css";

let nextCallId = 0;

type AppMode = "chat" | "carePlan";

export default function App() {
  const [mode, setMode] = useState<AppMode>("chat");
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ToolCallState | null>(null);
  const [deciding, setDeciding] = useState(false);

  const dangerousNames = useRef<Set<string>>(new Set());
  const scrollAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${sidekickTheme.name} · rescue ops`;
    document.querySelector<HTMLLinkElement>("link[rel='icon']")?.setAttribute("href", sidekickTheme.logo.favicon);
    getTools()
      .then((list) => {
        setTools(list);
        dangerousNames.current = new Set(list.filter((t) => t.dangerous).map((t) => t.name));
      })
      .catch(() => setTools([]));
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pendingApproval]);

  function updateLastTurn(fn: (turn: Turn) => Turn) {
    setTurns((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }

  function handleEvent(event: AgentEvent) {
    switch (event.kind) {
      case "text":
        updateLastTurn((t) => ({ ...t, text: t.text + event.text }));
        break;

      case "thinking":
        updateLastTurn((t) => ({ ...t, thinking: (t.thinking ?? "") + event.text }));
        break;

      case "tool_call": {
        const dangerous = dangerousNames.current.has(event.name ?? "");
        const call: ToolCallState = {
          callId: String(nextCallId++),
          name: event.name ?? "",
          args: event.args ?? {},
          dangerous,
          status: dangerous ? "pending_approval" : "running",
        };
        updateLastTurn((t) => ({ ...t, toolCalls: [...(t.toolCalls ?? []), call] }));
        if (dangerous) setPendingApproval(call);
        break;
      }

      case "tool_result":
        updateLastTurn((t) => {
          const calls = [...(t.toolCalls ?? [])];
          for (let i = calls.length - 1; i >= 0; i--) {
            if (calls[i].status !== "done" && calls[i].status !== "error") {
              calls[i] = {
                ...calls[i],
                status: event.is_error ? "error" : "done",
                result: event.text,
              };
              break;
            }
          }
          return { ...t, toolCalls: calls };
        });
        break;

      case "error":
        updateLastTurn((t) => ({ ...t, text: t.text + `\n\n${event.text}`, errored: true }));
        break;

      case "turn_end":
        break;
    }
  }

  async function send(message: string) {
    if (!message.trim() || streaming) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: message }, { role: "assistant", text: "" }]);
    setStreaming(true);
    try {
      await streamChat(message, handleEvent);
    } catch (err) {
      updateLastTurn((t) => ({ ...t, text: t.text + `\n\nConnection error: ${err}`, errored: true }));
    } finally {
      setStreaming(false);
      setPendingApproval(null);
    }
  }

  async function decide(approved: boolean) {
    setDeciding(true);
    try {
      await sendApproval(approved);
      setPendingApproval(null);
    } finally {
      setDeciding(false);
    }
  }

  async function handleReset() {
    await resetChat();
    setTurns([]);
  }

  const claudeStatus = health === null ? "check" : health.anthropic_key_set ? "ready" : "offline";
  const arcadeStatus = health === null ? "check" : health.arcade_available ? "loaded" : "optional";
  const claudeStatusClass =
    health === null ? "status-pill--muted" : health.anthropic_key_set ? "status-pill--ok" : "status-pill--warn";
  const arcadeStatusClass = health?.arcade_available ? "status-pill--ok" : "status-pill--muted";

  if (mode === "carePlan") {
    return (
      <div style={themeVars(sidekickTheme)}>
        <CarePlan onExit={() => setMode("chat")} />
      </div>
    );
  }

  return (
    <div className="app" style={themeVars(sidekickTheme)}>
      <Sidebar brand={sidekickTheme} tools={tools} health={health} onReset={handleReset} />

      <main className="chat">
        <header className="chat-header">
          <div className="chat-header__identity">
            <img className="chat-header__mark" src={sidekickTheme.logo.mark} alt="" aria-hidden="true" />
            <div>
              <p className="chat-header__eyebrow">Rescue operations</p>
              <h1 className="chat-header__title">{sidekickTheme.name}</h1>
            </div>
          </div>
          <div className="chat-header__status" aria-label="System status">
            <button
              className="status-pill status-pill--ok"
              onClick={() => setMode("carePlan")}
              style={{ cursor: "pointer" }}
            >
              Foster Care Plan →
            </button>
            <span className={`status-pill ${claudeStatusClass}`}>
              Claude {claudeStatus}
            </span>
            <span className={`status-pill ${arcadeStatusClass}`}>
              Arcade {arcadeStatus}
            </span>
            <span className="status-pill status-pill--muted">{health?.tool_count ?? tools.length} tools</span>
          </div>
        </header>

        <div className="chat__scroll">
          {turns.length === 0 && (
            <div className="empty-state">
              <img
                className="empty-state__mark"
                src={sidekickTheme.logo.mark}
                alt=""
                aria-hidden="true"
              />
              <p>
                Intake, kennel changes, roster lookups, and approved follow-ups
                stay in one calm workspace.
              </p>
            </div>
          )}
          {turns.map((turn, i) => (
            <TurnView key={i} turn={turn} />
          ))}
          <div ref={scrollAnchor} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="composer__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={streaming ? "Working…" : "Message the agent…"}
            disabled={streaming}
            autoFocus
          />
          <button className="btn btn--primary" type="submit" disabled={streaming || !input.trim()}>
            Send
          </button>
        </form>
      </main>

      {pendingApproval && (
        <ApprovalModal call={pendingApproval} onDecide={decide} deciding={deciding} />
      )}
    </div>
  );
}
