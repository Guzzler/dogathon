/**
 * Who "you" are, until there's real auth.
 *
 * Every visitor used to share the single seeded `fosters/annie` document, so one
 * person applying for a dog moved everyone else's journey with them. Instead each
 * browser mints its own random id on first load and keeps its journey under
 * `fosters/<id>`.
 *
 * This is identity, NOT authentication. An id is an unguessable handle -- anyone
 * who learns one can read and write that journey, and clearing site data loses it
 * for good. It's the right amount of machinery for a demo with no accounts, and
 * it must be replaced with real auth (and rules that check `request.auth.uid`)
 * before anyone stores anything they'd mind a stranger seeing.
 */
const KEY = "pawthway.fosterId.v1";

/** Matches the id pattern allowed by firestore.rules -- keep the two in sync. */
export const FOSTER_ID_PATTERN = /^f_[a-f0-9]{20}$/;

/** The seeded demo foster. Reachable on purpose via `?foster=annie`. */
export const DEMO_FOSTER_ID = "annie";

function mint(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `f_${hex}`;
}

function resolve(): string {
  try {
    // `?foster=<id>` pins a specific journey: how you get back to the seeded demo,
    // and how two devices can share one for a walkthrough. `?foster=new` hands the
    // device to someone else -- the only way to start over without clearing
    // storage, since the app has no account switcher yet.
    const requested = new URLSearchParams(window.location.search).get("foster");
    if (requested === "new") {
      const fresh = mint();
      localStorage.setItem(KEY, fresh);
      return fresh;
    }
    if (requested && (requested === DEMO_FOSTER_ID || FOSTER_ID_PATTERN.test(requested))) {
      localStorage.setItem(KEY, requested);
      return requested;
    }

    const stored = localStorage.getItem(KEY);
    if (stored && (stored === DEMO_FOSTER_ID || FOSTER_ID_PATTERN.test(stored))) return stored;

    const fresh = mint();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private mode with storage blocked: still isolated for this page's lifetime,
    // just not across reloads. Better than silently sharing one journey.
    return mint();
  }
}

/** Read once at startup so every hook and request agrees within a session. */
export const FOSTER_ID = resolve();

/** Abandons this journey and starts a new one. The old doc is left untouched. */
export function startNewJourney(): string {
  const fresh = mint();
  try {
    localStorage.setItem(KEY, fresh);
  } catch { /* storage blocked — the reload below still lands somewhere sane */ }
  return fresh;
}
