/**
 * Who the app is acting as.
 *
 * Held in a module-level variable rather than only in React state because `patchFoster()`
 * and friends are plain functions called from ~20 places — they need to resolve the current
 * foster document synchronously, without threading a uid through every call site.
 */
export type Session =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "guest" }
  | { kind: "user"; uid: string; name: string; email: string | null; photoURL: string | null };

const GUEST_KEY = "pawthway.guest.v1";

let current: Session = { kind: "loading" };
const subscribers = new Set<(s: Session) => void>();

export function getSession(): Session {
  return current;
}

export function setSession(next: Session): void {
  current = next;
  subscribers.forEach((fn) => fn(next));
}

export function subscribeSession(fn: (s: Session) => void): () => void {
  subscribers.add(fn);
  fn(current);
  return () => subscribers.delete(fn);
}

/** Guest choice survives a reload, so the sign-in screen isn't a toll gate every visit. */
export const wasGuest = () => localStorage.getItem(GUEST_KEY) === "1";

export function continueAsGuest(): void {
  localStorage.setItem(GUEST_KEY, "1");
  setSession({ kind: "guest" });
}

export function clearGuest(): void {
  localStorage.removeItem(GUEST_KEY);
}

/**
 * The Firestore document id for the signed-in user, or null when this session's data lives
 * in localStorage instead. Callers branch on null rather than assuming a backend.
 */
export function fosterDocId(): string | null {
  return current.kind === "user" ? current.uid : null;
}

/** A display name for the greeting, before they've typed one in onboarding. */
export function sessionDisplayName(): string {
  return current.kind === "user" ? (current.name.split(" ")[0] ?? "") : "";
}
