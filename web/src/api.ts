import type { AgentEvent, EventKind, HealthInfo, ToolInfo } from "./types";

// Local dev goes through the Vite proxy (/api -> 127.0.0.1:8000). A
// production build points straight at the deployed Cloud Run agent, since
// Firebase Hosting doesn't run the Python backend.
const AGENT_BASE = import.meta.env.VITE_AGENT_URL || "/api";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AGENT_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const getHealth = () => json<HealthInfo>("/health");
/** Compresses journal notes into short adoption-profile tags. */
export const getHighlights = (notes: string[]) =>
  json<{ tags: string[]; summary: string }>("/highlights", {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
export const getTools = () => json<ToolInfo[]>("/tools");
export const resetChat = () => json<{ ok: boolean }>("/reset", { method: "POST" });
export const sendApproval = (approved: boolean) =>
  json<{ ok: boolean }>("/approve", {
    method: "POST",
    body: JSON.stringify({ approved }),
  });

/**
 * A failure worth showing someone. `code` is what the UI branches on; `message`
 * is already written for a foster to read, so components render it directly
 * rather than composing their own copy from a status number.
 */
export type ChatErrorCode = "network" | "auth" | "rate_limit" | "upstream" | "unknown";

export class ChatError extends Error {
  code: ChatErrorCode;

  constructor(code: ChatErrorCode, message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

function describeStatus(status: number): ChatError {
  if (status === 401 || status === 403) {
    return new ChatError("auth", "The assistant isn't set up correctly right now. The team has been notified.");
  }
  if (status === 429) {
    return new ChatError("rate_limit", "Lots of people are asking questions right now. Try again in a moment.");
  }
  if (status >= 500) {
    return new ChatError("upstream", "The assistant is having trouble right now. Try again in a moment.");
  }
  return new ChatError("unknown", "Something went wrong. Try again in a moment.");
}

/** Streams SSE frames from POST /api/chat, calling onEvent as each one parses. */
export async function streamChat(
  message: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (err) {
    // An aborted request isn't a failure — the caller navigated away or sent again.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ChatError("network", "Couldn't reach the assistant. Check your connection and try again.");
  }

  if (!res.ok || !res.body) throw describeStatus(res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      onEvent(parseFrame(frame));
    }
  }
}

function parseFrame(frame: string): AgentEvent {
  let kind: EventKind = "text";
  let data = "{}";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) kind = line.slice(7).trim() as EventKind;
    else if (line.startsWith("data: ")) data = line.slice(6);
  }
  return { kind, ...JSON.parse(data) };
}
