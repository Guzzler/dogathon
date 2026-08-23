import { Markdown } from "../lib/markdown";
import type { Turn } from "../types";
import { ToolCallCard } from "./ToolCallCard";

export type ActivityMode = "detailed" | "minimal";

export function TurnView({
  turn,
  onRetry,
  activityMode = "detailed",
}: {
  turn: Turn;
  onRetry?: () => void;
  activityMode?: ActivityMode;
}) {
  if (turn.role === "user") {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble">{turn.text}</div>
      </div>
    );
  }

  const calls = turn.toolCalls ?? [];
  const working = calls.some((c) => c.status === "running" || c.status === "pending_approval");

  // In the coordinator chat the fiction is that you're messaging the shelter, so
  // a list of function calls breaks it. Show one quiet line while something is in
  // flight, then let the answer stand on its own.
  const activity =
    activityMode === "minimal" ? (
      working && !turn.text ? (
        <div className="msg__working">Checking your details…</div>
      ) : null
    ) : calls.length > 0 ? (
      <div className="msg__activity">
        {calls.map((call) => (
          <ToolCallCard key={call.callId} call={call} />
        ))}
      </div>
    ) : null;

  return (
    <div className="msg msg--agent">
      {activity}

      {turn.text && (
        <div className="msg__bubble">
          <Markdown text={turn.text} />
        </div>
      )}

      {turn.error && (
        <div className="msg__error" role="alert">
          <span className="msg__error-icon" aria-hidden="true">!</span>
          <div className="msg__error-body">
            <p>{turn.error.message}</p>
            {onRetry && turn.error.code !== "auth" && (
              <button type="button" className="msg__retry" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
