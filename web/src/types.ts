export type EventKind =
  | "text"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "turn_end"
  | "error";

export interface AgentEvent {
  kind: EventKind;
  text: string;
  name?: string;
  args?: Record<string, unknown>;
  is_error?: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
  dangerous: boolean;
}

export interface ToolCallState {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  dangerous: boolean;
  status: "pending_approval" | "running" | "done" | "error";
  result?: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  toolCalls?: ToolCallState[];
  errored?: boolean;
}

export interface HealthInfo {
  anthropic_key_set: boolean;
  arcade_available: boolean;
  tool_count: number;
}
