import { useRef, useState } from "react";
import { sendApproval, streamChat } from "../api";
import { TurnView } from "./TurnView";
import { ApprovalModal } from "./ApprovalModal";
import type { AgentEvent, ToolCallState, Turn } from "../types";

let nextCallId = 0;

const DEFAULT_DANGEROUS = [
  "update_dog",
  "save_intake",
  "record_swipe",
  "update_checklist",
  "log_care_entry",
  "send_adoption_profile_to_shelter",
];

interface QuickAction {
  label: string;
  message: string;
}

interface Props {
  placeholder?: string;
  emptyState?: string;
  quickActions?: QuickAction[];
}

export function AgentChatPanel({ placeholder = "Ask a question…", emptyState, quickActions }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ToolCallState | null>(null);
  const [deciding, setDeciding] = useState(false);
  const dangerousNames = useRef<Set<string>>(new Set(DEFAULT_DANGEROUS));

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
              calls[i] = { ...calls[i], status: event.is_error ? "error" : "done", result: event.text };
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

  return (
    <div className="agent-panel">
      <div className="agent-panel__scroll">
        {turns.length === 0 && <p className="agent-panel__empty">{emptyState ?? "Ask anything."}</p>}
        {turns.map((turn, i) => (
          <TurnView key={i} turn={turn} />
        ))}
      </div>

      {quickActions && quickActions.length > 0 && (
        <div className="agent-panel__quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="btn btn--primary"
              type="button"
              disabled={streaming}
              onClick={() => send(action.message)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="agent-panel__composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="agent-panel__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? "Working…" : placeholder}
          disabled={streaming}
        />
        <button className="btn btn--ghost" type="submit" disabled={streaming || !input.trim()}>
          Send
        </button>
      </form>

      {pendingApproval && <ApprovalModal call={pendingApproval} onDecide={decide} deciding={deciding} />}
    </div>
  );
}
