import { useState } from "react";
import { toolConsequence, toolLabel } from "../lib/toolLabels";
import type { ToolCallState } from "../types";

interface Props {
  call: ToolCallState;
  onDecide: (approved: boolean) => void;
  deciding: boolean;
}

/**
 * "Approve tool call? send_adoption_profile_to_shelter" tells a foster nothing
 * about what they're agreeing to. Lead with the consequence in plain words and
 * keep the raw call underneath for anyone who wants to check it.
 */
export function ApprovalModal({ call, onDecide, deciding }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const { text, icon } = toolLabel(call.name, "running");

  return (
    <div className="approve-overlay" role="dialog" aria-modal="true" aria-labelledby="approve-title">
      <div className="approve">
        <div className="approve__icon" aria-hidden="true">{icon}</div>
        <h3 id="approve-title" className="approve__title">{text}?</h3>
        <p className="approve__body">{toolConsequence(call.name)}</p>

        {Object.keys(call.args).length > 0 && (
          <>
            <button type="button" className="approve__toggle" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "Hide details" : "Show details"}
            </button>
            {showRaw && <pre className="approve__raw">{JSON.stringify(call.args, null, 2)}</pre>}
          </>
        )}

        <div className="approve__actions">
          <button className="approve__btn approve__btn--deny" disabled={deciding} onClick={() => onDecide(false)}>
            Not now
          </button>
          <button className="approve__btn approve__btn--go" disabled={deciding} onClick={() => onDecide(true)}>
            {deciding ? "Working…" : "Yes, do it"}
          </button>
        </div>
      </div>
    </div>
  );
}
