import type { ToolCallState } from "../types";

const STATUS_LABEL: Record<ToolCallState["status"], string> = {
  pending_approval: "waiting for approval",
  running: "running",
  done: "done",
  error: "failed",
};

export function ToolCallCard({ call }: { call: ToolCallState }) {
  return (
    <div className={`tool-card tool-card--${call.status}`}>
      <div className="tool-card__head">
        <span className="tool-card__name">{call.name}</span>
        <span className="tool-card__status">{STATUS_LABEL[call.status]}</span>
      </div>
      {Object.keys(call.args).length > 0 && (
        <pre className="tool-card__args">{JSON.stringify(call.args, null, 2)}</pre>
      )}
      {call.result && <pre className="tool-card__result">{call.result}</pre>}
    </div>
  );
}
