import type { AgentEvent, EventKind, HealthInfo, ToolInfo } from "./types";
import { auth } from "./auth";

// Local dev goes through the Vite proxy (/api -> 127.0.0.1:8000). A
// production build points straight at the deployed Cloud Run agent, since
// Firebase Hosting doesn't run the Python backend.
const AGENT_BASE = import.meta.env.VITE_AGENT_URL || "/api";

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
    return new ChatError("auth", "Your session has expired. Sign in again to pick this back up.");
  }
  if (status === 429) {
    return new ChatError("rate_limit", "That's a lot of questions at once — give it a minute and try again.");
  }
  if (status >= 500) {
    return new ChatError("upstream", "The assistant is having trouble right now. Try again in a moment.");
  }
  return new ChatError("unknown", "Something went wrong. Try again in a moment.");
}

/**
 * The agent's tools reach Firestore through the Admin SDK, which bypasses the security
 * rules, so this token is the only thing telling the backend whose journey it may touch.
 * It carries the uid, which is why nothing here sends a foster id any more.
 *
 * Every surface that talks to the agent sits behind applying, and applying needs an
 * account — so no signed-in user here means a broken session, not an ordinary state.
 */
async function authHeader(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) throw new ChatError("auth", "Sign in to talk to your shelter coordinator.");
  try {
    // Cached until it's close to expiring and refreshed after that, so per-call is fine.
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    throw new ChatError("auth", "Couldn't confirm your sign-in. Sign in again to pick this back up.");
  }
}

async function json<T>(path: string, init?: RequestInit, authed = false): Promise<T> {
  const res = await fetch(`${AGENT_BASE}${path}`, {
    ...init,
    // After the spread, not before: the header is what authorises the call and no
    // caller gets to drop it by passing its own headers.
    headers: { "Content-Type": "application/json", ...(authed ? await authHeader() : {}) },
  });
  if (!res.ok) throw describeStatus(res.status);
  return res.json();
}

export const getHealth = () => json<HealthInfo>("/health");
/** Compresses journal notes into short adoption-profile tags. */
export const getHighlights = (notes: string[]) =>
  json<{ tags: string[]; summary: string }>("/highlights", {
    method: "POST",
    body: JSON.stringify({ notes }),
  }, true);
export const getTools = () => json<ToolInfo[]>("/tools");
export const resetChat = () =>
  json<{ ok: boolean }>("/reset", { method: "POST", body: "{}" }, true);
export const sendApproval = (approved: boolean) =>
  json<{ ok: boolean }>("/approve", {
    method: "POST",
    body: JSON.stringify({ approved }),
  }, true);

/** Streams SSE frames from POST /api/chat, calling onEvent as each one parses. */
export async function streamChat(
  message: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Outside the try: a missing sign-in is already a ChatError the panel can render,
  // and calling it a network failure would send the foster to check their wifi.
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };

  let res: Response;
  try {
    res = await fetch(`${AGENT_BASE}/chat`, {
      method: "POST",
      headers,
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
