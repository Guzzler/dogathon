import { useEffect, useRef, useState } from "react";
import { getHealth, getTools, resetChat, sendApproval, streamChat } from "./api";
import { ApprovalModal } from "./components/ApprovalModal";
import { Sidebar } from "./components/Sidebar";
import { TurnView } from "./components/TurnView";
import type { AgentEvent, HealthInfo, ToolCallState, ToolInfo, Turn } from "./types";
import "./App.css";

let nextCallId = 0;

export default function App() {
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
    getTools().then((list) => {
      setTools(list);
      dangerousNames.current = new Set(list.filter((t) => t.dangerous).map((t) => t.name));
    });
    getHealth().then(setHealth);
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

  return (
    <div className="app">
      <Sidebar tools={tools} health={health} onReset={handleReset} />

      <main className="chat">
        <div className="chat__scroll">
          {turns.length === 0 && (
            <div className="empty-state">
              Ask it to list available dogs, look one up, fetch a URL, or do
              some arithmetic — try "which dogs under 40 lbs are good with
              kids?"
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
