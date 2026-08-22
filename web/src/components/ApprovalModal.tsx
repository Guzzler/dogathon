import type { ToolCallState } from "../types";

interface Props {
  call: ToolCallState;
  onDecide: (approved: boolean) => void;
  deciding: boolean;
}

export function ApprovalModal({ call, onDecide, deciding }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Approve tool call?</h3>
        <p className="modal__tool">{call.name}</p>
        <pre className="modal__args">{JSON.stringify(call.args, null, 2)}</pre>
        <div className="modal__actions">
          <button
            className="btn btn--deny"
            disabled={deciding}
            onClick={() => onDecide(false)}
          >
            Deny
          </button>
          <button
            className="btn btn--approve"
            disabled={deciding}
            onClick={() => onDecide(true)}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
