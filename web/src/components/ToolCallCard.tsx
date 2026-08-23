import { useState } from "react";
import { toolLabel } from "../lib/toolLabels";
import type { ToolCallState } from "../types";

/**
 * One line of "here's what I'm doing", not a debug dump. The raw arguments and
 * result are still one tap away for anyone who wants them, but a foster reading
 * their pickup details shouldn't have to scroll past a wall of JSON to find the
 * answer.
 */
export function ToolCallCard({ call }: { call: ToolCallState }) {
  const [open, setOpen] = useState(false);
  const { text, icon } = toolLabel(call.name, call.status);
  const hasDetail = Object.keys(call.args).length > 0 || Boolean(call.result);

  return (
    <div className={`activity activity--${call.status}`}>
      <button
        type="button"
        className="activity__row"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
      >
        <span className="activity__icon" aria-hidden="true">
          {call.status === "error" ? "⚠️" : icon}
        </span>
        <span className="activity__text">
          {call.status === "error" ? `Couldn't ${text.toLowerCase()}` : text}
          {call.status === "pending_approval" && " — needs your OK"}
        </span>
        {call.status === "running" && <span className="activity__spinner" aria-hidden="true" />}
        {call.status === "done" && <span className="activity__check" aria-hidden="true">✓</span>}
        {hasDetail && <span className="activity__chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>}
      </button>

      {open && hasDetail && (
        <div className="activity__detail">
          {Object.keys(call.args).length > 0 && (
            <pre>{JSON.stringify(call.args, null, 2)}</pre>
          )}
          {call.result && <pre>{call.result}</pre>}
        </div>
      )}
    </div>
  );
}
