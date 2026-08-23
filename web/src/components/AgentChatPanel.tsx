import { useCallback, useEffect, useRef, useState } from "react";
import { ChatError, sendApproval, streamChat } from "../api";
import { TurnView, type ActivityMode } from "./TurnView";
import { ApprovalModal } from "./ApprovalModal";
import type { AgentEvent, ToolCallState, Turn } from "../types";

let nextCallId = 0;

// Mirrors `dangerous=True` in src/agent/builtin/ -- keep the two in sync, or the UI
// will prompt for a tool the server runs straight through (or worse, the reverse).
// Only things the shelter or the outside world sees belong here; the agent writing
// to the foster's own log or checklist is bookkeeping and shouldn't interrupt them.
const DEFAULT_DANGEROUS = [
  "update_dog",
  "save_intake",
  "record_swipe",
  "send_adoption_profile_to_shelter",
];

interface QuickAction {
  label: string;
  message: string;
}

interface Props {
  placeholder?: string;
  emptyState?: string;
  quickActions?: QuickAction[];
  /**
   * "detailed" shows each tool as a readable row — right where the agent's work
   * is the point. "minimal" collapses it to a single line, for the Match chat
   * that's framed as messaging a person.
   */
  activityMode?: ActivityMode;
  /**
   * "card" sits inside a page and caps its own height. "full" fills the screen
   * it's given — the thread is then the only thing that scrolls.
   */
  variant?: "card" | "full";
}

export function AgentChatPanel({
  placeholder = "Ask a question…",
  emptyState,
  quickActions,
  activityMode = "detailed",
  variant = "card",
}: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ToolCallState | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const dangerousNames = useRef<Set<string>>(new Set(DEFAULT_DANGEROUS));
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastMessage = useRef<string>("");
  // Follow the stream until the reader scrolls up themselves; then leave them be.
  const pinned = useRef(true);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Animated by hand rather than with `behavior:"smooth"`. Native smooth scrolling
   * is silently a no-op in some engines and gets cancelled by the surrounding
   * scroll container in others, which left the button hiding itself without ever
   * moving the view. A rAF tween always arrives.
   */
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = true;
    setAtBottom(true);

    const target = el.scrollHeight - el.clientHeight;
    const start = el.scrollTop;
    const distance = target - start;
    if (distance <= 0) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.scrollTop = target;
      return;
    }

    const duration = Math.min(420, 120 + distance * 0.25);
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic — quick off the mark, settles gently.
      el.scrollTop = start + distance * (1 - Math.pow(1 - p, 3));
      if (p < 1 && pinned.current) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  // Replies run taller than the panel, so without this the answer streams in below
  // the fold and you're left looking at the top of the message. Instant, not
  // smooth -- this fires on every token, and a smooth scroll would restart its
  // animation each time and never arrive.
  useEffect(() => {
    if (!pinned.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  // Position alone decides whether we're following, with no "was that us?" flag:
  // our own scroll always lands at the bottom (distance 0, still pinned), and
  // content growing doesn't fire a scroll event, so only the reader moving away
  // can unpin. An earlier flag-based version swallowed the reader's first scroll.
  function trackScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    pinned.current = distance < 48;
    setAtBottom(pinned.current);
  }

  function updateLastTurn(fn: (turn: Turn) => Turn) {
    setTurns((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }

  function handleEvent(event: AgentEvent) {
    switch (event.kind) {
      case "text":
        updateLastTurn((t) => ({ ...t, text: t.text + event.text }));
        break;
      case "thinking":
        updateLastTurn((t) => ({ ...t, thinking: (t.thinking ?? "") + event.text }));
        break;
      case "tool_call": {
        const dangerous = dangerousNames.current.has(event.name ?? "");
        const call: ToolCallState = {
          callId: String(nextCallId++),
          name: event.name ?? "",
          args: event.args ?? {},
          dangerous,
          status: dangerous ? "pending_approval" : "running",
        };
        updateLastTurn((t) => ({ ...t, toolCalls: [...(t.toolCalls ?? []), call] }));
        if (dangerous) setPendingApproval(call);
        break;
      }
      case "tool_result":
        updateLastTurn((t) => {
          const calls = [...(t.toolCalls ?? [])];
          for (let i = calls.length - 1; i >= 0; i--) {
            if (calls[i].status !== "done" && calls[i].status !== "error") {
              calls[i] = { ...calls[i], status: event.is_error ? "error" : "done", result: event.text };
              break;
            }
          }
          return { ...t, toolCalls: calls };
        });
        break;
      case "error":
        updateLastTurn((t) => ({
          ...t,
          error: { message: event.text, code: event.code ?? "unknown" },
          // A tool left mid-flight when the turn dies would otherwise spin forever.
          toolCalls: (t.toolCalls ?? []).map((c) =>
            c.status === "running" || c.status === "pending_approval" ? { ...c, status: "error" } : c,
          ),
        }));
        setPendingApproval(null);
        break;
      case "turn_end":
        break;
    }
  }

  async function run(message: string) {
    lastMessage.current = message;
    pinned.current = true;
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(message, handleEvent, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const error =
        err instanceof ChatError
          ? { message: err.message, code: err.code }
          : { message: "Something went wrong. Try again in a moment.", code: "unknown" };
      updateLastTurn((t) => ({ ...t, error }));
    } finally {
      if (abortRef.current === controller) {
        setStreaming(false);
        setPendingApproval(null);
        abortRef.current = null;
      }
    }
  }

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || streaming) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: trimmed }, { role: "assistant", text: "" }]);
    await run(trimmed);
  }

  /** Replaces the failed assistant turn in place, so retrying doesn't duplicate the question. */
  async function retry() {
    if (streaming || !lastMessage.current) return;
    setTurns((prev) => {
      const next = [...prev];
      next[next.length - 1] = { role: "assistant", text: "" };
      return next;
    });
    await run(lastMessage.current);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setPendingApproval(null);
  }

  async function decide(approved: boolean) {
    setDeciding(true);
    try {
      await sendApproval(approved);
      setPendingApproval(null);
    } catch {
      updateLastTurn((t) => ({
        ...t,
        error: { message: "Couldn't send your decision. Check your connection and try again.", code: "network" },
      }));
      setPendingApproval(null);
    } finally {
      setDeciding(false);
    }
  }

  const lastTurn = turns[turns.length - 1];
  const failed = Boolean(lastTurn?.error) && !streaming;
  // Nothing has come back yet — show a typing dot rather than an empty bubble.
  const awaitingFirstToken =
    streaming && lastTurn?.role === "assistant" && !lastTurn.text && !lastTurn.toolCalls?.length;

  return (
    <div className={`chat chat--${variant}`}>
      <div className="chat__scroll" ref={scrollRef} onScroll={trackScroll}>
        {turns.length === 0 ? (
          <div className="chat__empty">
            <p>{emptyState ?? "Ask anything."}</p>
          </div>
        ) : (
          <>
            {turns.map((turn, i) => (
              <TurnView
                key={i}
                turn={turn}
                activityMode={activityMode}
                onRetry={i === turns.length - 1 && failed ? retry : undefined}
              />
            ))}
            {awaitingFirstToken && (
              <div className="chat__typing" aria-label="Assistant is typing">
                <span /><span /><span />
              </div>
            )}
          </>
        )}
      </div>

      {!atBottom && turns.length > 0 && (
        <button type="button" className="chat__jump" onClick={() => scrollToBottom()}>
          ↓ Latest
        </button>
      )}

      {quickActions && quickActions.length > 0 && turns.length === 0 && (
        <div className="chat__suggestions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="chat__suggestion"
              type="button"
              disabled={streaming}
              onClick={() => send(action.message)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={streaming}
          aria-label="Message"
        />
        {streaming ? (
          <button className="chat__send chat__send--stop" type="button" onClick={stop} aria-label="Stop">
            ■
          </button>
        ) : (
          <button className="chat__send" type="submit" disabled={!input.trim()} aria-label="Send">
            ↑
          </button>
        )}
      </form>

      {pendingApproval && <ApprovalModal call={pendingApproval} onDecide={decide} deciding={deciding} />}
    </div>
  );
}
