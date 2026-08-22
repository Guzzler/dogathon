import type { AgentEvent, EventKind, HealthInfo, ToolInfo } from "./types";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const getHealth = () => json<HealthInfo>("/health");
export const getTools = () => json<ToolInfo[]>("/tools");
export const resetChat = () => json<{ ok: boolean }>("/reset", { method: "POST" });
export const sendApproval = (approved: boolean) =>
  json<{ ok: boolean }>("/approve", {
    method: "POST",
    body: JSON.stringify({ approved }),
  });

/** Streams SSE frames from POST /api/chat, calling onEvent as each one parses. */
export async function streamChat(
  message: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`chat -> ${res.status}`);

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
