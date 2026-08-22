import { useState } from "react";
import type { Turn } from "../types";
import { ToolCallCard } from "./ToolCallCard";

export function TurnView({ turn }: { turn: Turn }) {
  const [showThinking, setShowThinking] = useState(false);

  if (turn.role === "user") {
    return (
      <div className="turn turn--user">
        <div className="bubble bubble--user">{turn.text}</div>
      </div>
    );
  }

  return (
    <div className={`turn turn--assistant ${turn.errored ? "turn--error" : ""}`}>
      {turn.thinking && (
        <button className="thinking-toggle" onClick={() => setShowThinking((v) => !v)}>
          {showThinking ? "hide thinking" : "show thinking"}
        </button>
      )}
      {showThinking && turn.thinking && (
        <pre className="thinking-block">{turn.thinking}</pre>
      )}

      {(turn.toolCalls ?? []).map((call) => (
        <ToolCallCard key={call.callId} call={call} />
      ))}

      {turn.text && <div className="bubble bubble--assistant">{turn.text}</div>}
    </div>
  );
}
