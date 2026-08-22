import { useEffect, useRef, useState } from "react";
import { getHighlights } from "../api";
import { patchFoster } from "../hooks/useFoster";
import type { Foster } from "../types";

/**
 * Journal notes, condensed into adoption-profile tags by the agent.
 *
 * The result is cached on the foster document alongside the note count it was derived from,
 * so the model only runs when the foster has actually written something new — not on every
 * render of the adoption page. Failures are silent: the page keeps its own derived content.
 */
export function useAdoptionHighlights(foster: Foster | null, notes: string[]) {
  const cached = foster?.adoptionHighlights;
  const [pending, setPending] = useState(false);
  // `notes` is a fresh array every render, so key the effect on its contents instead —
  // otherwise a failed request would re-fire on every re-render.
  const key = notes.join("\u0000");
  const attempted = useRef<string | null>(null);

  const stale = notes.length > 0 && cached?.fromNoteCount !== notes.length;

  useEffect(() => {
    if (!stale || attempted.current === key) return;
    attempted.current = key;
    setPending(true);

    let cancelled = false;
    getHighlights(key.split("\u0000"))
      .then(({ tags, summary }) => {
        if (!cancelled && (tags.length || summary)) {
          patchFoster({ adoptionHighlights: { tags, summary, fromNoteCount: notes.length } });
        }
      })
      .catch(() => { /* agent unreachable — fall back to the page's own derived content */ })
      .finally(() => { if (!cancelled) setPending(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, key]);

  return {
    tags: cached?.tags ?? [],
    summary: cached?.summary ?? "",
    pending: pending && !cached?.tags?.length,
  };
}
