import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { useCareLog } from "../../hooks/useCareLog";
import { useJournalEntries } from "../../hooks/useJournal";
import { useAdoptionHighlights } from "../../lib/highlights";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { buildAdoptionProfile } from "../../lib/adoption";
import { normalizeDog } from "../../lib/dog";
import { fosterWindow } from "../../lib/foster";
import { AdoptionProfileBody } from "./AdoptionProfile";

export function PostFosterView() {
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();
  const { entries } = useCareLog();
  const journal = useJournalEntries();
  const [sharing, setSharing] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const raw = dogs.find((d) => d.id === foster?.matchedDogId);
  const dog = useMemo(() => (raw ? normalizeDog(raw) : null), [raw]);
  const profile = useMemo(
    () => (dog ? buildAdoptionProfile(dog, foster, entries, journal) : null),
    [dog, foster, entries, journal],
  );
  const { tags, pending: tagsPending } = useAdoptionHighlights(foster, profile?.noteTexts ?? []);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster?.matchedDogId || !dog || !profile) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>No adoption page yet</h1>
        <p className="pw-muted">
          Once you've matched with a dog and started their Care Plan, their adoption page builds
          itself from what you log.
        </p>
      </div>
    );
  }

  const win = fosterWindow(dog.fosterWeeks, dog.fosterLength, foster.pickup?.date);
  const shareUrl = `${window.location.origin}/adoption/${dog.id}`;
  const journalCount = journal.length + entries.length;

  return (
    <div className="pw-page">
      <div className="row" style={{ gap: 10, marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <p className="hub-card__eyebrow" style={{ margin: 0 }}>Adoption page</p>
          <h1 style={{ fontSize: 27, marginTop: 3 }}>{dog.name}'s profile</h1>
        </div>
        <span className="sp" />
        <button className="iconbtn" onClick={() => setSharing(true)} aria-label="Share">↗</button>
      </div>

      <div className="row" style={{ gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        <span className="chip butter" style={{ fontWeight: 800 }}>🗓️ Fostered {win.total}</span>
        <span className={`chip ${journalCount ? "sage" : ""}`} style={{ fontWeight: 800 }}>
          📔 {journalCount ? `${journalCount} journal entries` : "Journal empty — using sample content"}
        </span>
      </div>

      {foster.readyForAdoption && (
        <div className="pw-banner pw-banner--success">
          🎉 {dog.name}'s adoption profile is with the shelter. Thank you for fostering!
        </div>
      )}

      <AdoptionProfileBody dog={dog} profile={profile} tags={tags} tagsPending={tagsPending} />

      <div style={{ marginTop: 28 }}>
        <button className="btn btn--primary" style={{ width: "100%" }} onClick={() => setSharing(true)}>
          Share {dog.name}'s page
        </button>
      </div>

      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Let the agent write it</div>
        <p className="ap-note-hint">
          The agent can turn your journal into a polished write-up and send it to {dog.shelter.short}.
        </p>
        {drafting ? (
          <div className="care-tips-drawer">
            <AgentChatPanel
              placeholder="e.g. send the adoption profile to the shelter"
              emptyState={`Ask the agent to draft ${dog.name}'s adoption profile from the weigh-ins, notes, and photos you've logged — then approve sending it to the shelter.`}
              quickActions={[
                { label: "Draft adoption profile", message: `Generate an adoption profile for ${dog.name} using their care log, and show me the draft.` },
                { label: "Send to shelter", message: `Send ${dog.name}'s adoption profile to the shelter now.` },
              ]}
            />
          </div>
        ) : (
          <button className="btn btn--ghost" style={{ width: "100%" }} onClick={() => setDrafting(true)}>
            Open the agent
          </button>
        )}
      </div>

      {!foster.readyForAdoption && (
        <button className="btn btn--ghost" style={{ width: "100%", marginTop: 10 }}
          onClick={() => patchFoster({ phase: "complete" })}>
          Mark journey complete
        </button>
      )}

      <AnimatePresence>
        {sharing && <ShareSheet dogName={dog.name} url={shareUrl} summary={profile.summary} onClose={() => setSharing(false)} />}
      </AnimatePresence>
    </div>
  );
}

function ShareSheet({ dogName, url, summary, onClose }: {
  dogName: string; url: string; summary: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const subject = `Meet ${dogName} — looking for a forever home`;
  const body = `${summary}\n\nRead ${dogName}'s full adoption page:\n${url}\n`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    // Only offered where the browser supports it; falls back to copy/email otherwise.
    try {
      await navigator.share({ title: subject, text: summary, url });
      onClose();
    } catch { /* dismissed */ }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(35,25,18,.4)", zIndex: 900 }} />
      <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 420 }}
        transition={{ type: "spring", stiffness: 330, damping: 33 }} className="sharesheet">
        <div className="sharesheet__grip" />
        <h3>Share {dogName}'s page</h3>
        <p className="muted" style={{ marginTop: 5 }}>
          Anyone with the link can read the profile — they don't need an account.
        </p>

        <div className="sharesheet__url">{url}</div>

        <button className="btn btn--primary" onClick={copy}>
          {copied ? "✓ Link copied" : "Copy link"}
        </button>
        <a className="btn btn--ghost" href={mailto}>Share by email</a>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button className="btn btn--ghost" onClick={nativeShare}>More sharing options</button>
        )}
        <button className="btn btn--ghost" onClick={onClose}>Done</button>
      </motion.div>
    </>
  );
}
