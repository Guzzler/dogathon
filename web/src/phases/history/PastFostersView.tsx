import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDogs } from "../../hooks/useDogs";
import { useJourneys } from "../../hooks/useJourneys";
import { useAllCareLog } from "../../hooks/useCareLog";
import { unpublishAdoptionProfile } from "../../lib/adoptionProfiles";
import { fosterDocId } from "../../lib/session";
import { formatDay, journeyCareLog, millisOf, outcomeLabel, pastFosters, type PastFoster } from "../../lib/history";
import { Unrecorded } from "../../components/Unrecorded";
import type { CareLogEntry } from "../../types";

/**
 * Past fosters (PH-37). Every journey `leaveJourney` filed, readable by the foster who wrote it,
 * and -- the reason this screen is more than an archive -- the one place a foster can still reach
 * a page they published once the pointer has moved to another dog.
 *
 * **Nothing here is editable, and there is no re-publish** (decided 2026-10-13): a journey is what
 * was written while the dog was there, and a page is a snapshot taken at **Publish**. Taking a page
 * down is the one control an author needs to stay safe.
 */
export function PastFostersView() {
  const { journeys, applications, published, loading } = useJourneys();
  const { dogs, loading: dogsLoading } = useDogs();

  if (loading || dogsLoading) return <p className="pw-loading">Loading…</p>;
  const cards = pastFosters(journeys, dogs, applications, published);

  return (
    <div className="pw-page pw-page--narrow">
      <div>
        <p className="hub-card__eyebrow">Your history</p>
        <h1>Past fosters</h1>
      </div>
      {cards.length === 0 ? (
        <p className="pw-muted">
          When a foster ends — or you move on to another dog — what you wrote about them is kept here.
        </p>
      ) : (
        cards.map((c) => <PastFosterCard key={c.journey.id} card={c} />)
      )}
    </div>
  );
}

function DogName({ card }: { card: PastFoster }) {
  return card.dog ? <>{card.dog.name}</> : <>This dog's listing is no longer on file</>;
}

function PastFosterCard({ card }: { card: PastFoster }) {
  const notes = card.journey.journal?.length ?? 0;
  const filed = formatDay(millisOf(card.journey.archivedAt));
  return (
    <Link to={`/history/${card.journey.id}`} className="hub-card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
      <h2 style={{ fontSize: 19 }}><DogName card={card} /></h2>
      {card.dog && <p className="pw-muted" style={{ margin: 0 }}>{card.dog.breed} · {card.dog.ageLabel}</p>}
      {card.outcome && <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{outcomeLabel(card.outcome)}</p>}
      <div className="row" style={{ gap: 7, marginTop: 10, flexWrap: "wrap" }}>
        <span className="chip">📔 {notes === 1 ? "1 journal entry" : `${notes} journal entries`}</span>
        {card.published && <span className="chip sage">Adoption page published</span>}
        {filed && <span className="chip">Filed {filed}</span>}
      </div>
    </Link>
  );
}

export function PastFosterDetailView() {
  const { journeyId } = useParams();
  const { journeys, applications, published, loading } = useJourneys();
  const { dogs, loading: dogsLoading } = useDogs();
  const { entries, loading: logLoading } = useAllCareLog();

  if (loading || dogsLoading || logLoading) return <p className="pw-loading">Loading…</p>;
  const card = pastFosters(journeys, dogs, applications, published).find((c) => c.journey.id === journeyId);

  if (!card) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>Nothing filed here</h1>
        <p className="pw-muted">This foster isn't in your history on this device or account.</p>
        <Link className="btn btn--ghost" to="/history">All past fosters</Link>
      </div>
    );
  }

  const { journey } = card;
  const journal = [...(journey.journal ?? [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const health = journeyCareLog(entries, journey)
    .filter((e) => e.type === "weigh_in" || e.type === "vet_visit")
    .sort((a, b) => millisOf(a.created_at) - millisOf(b.created_at));

  return (
    <div className="pw-page pw-page--narrow">
      <div>
        <Link to="/history" className="pw-muted" style={{ fontSize: 13 }}>← Past fosters</Link>
        <p className="hub-card__eyebrow" style={{ marginTop: 10 }}>Past foster · read-only</p>
        <h1><DogName card={card} /></h1>
        {card.dog && <p className="pw-muted" style={{ margin: "4px 0 0" }}>{card.dog.breed} · {card.dog.ageLabel}</p>}
        {card.outcome && <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{outcomeLabel(card.outcome)}</p>}
      </div>

      {card.published && <PublishedPage dogId={journey.dogId} />}

      <section className="hub-card">
        <p className="hub-card__eyebrow">Your journal</p>
        {journal.length === 0 ? (
          <p className="pw-muted" style={{ margin: 0 }}>You didn't write any journal entries on this foster.</p>
        ) : (
          <div className="ap-timeline" style={{ marginTop: 10 }}>
            {journal.map((j) => (
              <div key={j.id} className="ap-tl-item">
                <span className="ap-tl-dot" />
                <div>
                  <span className="ap-tl-date">
                    {formatDay(Date.parse(j.createdAt)) ?? <Unrecorded what="Date" />}{j.starred ? " · ★" : ""}
                  </span>
                  {j.photoUrl && <img src={j.photoUrl} alt={j.caption ?? ""} style={{ display: "block", width: "100%", borderRadius: 12, marginTop: 6 }} />}
                  {(j.text || j.caption) && <p className="sub" style={{ fontSize: 14, marginTop: 3 }}>{j.text || j.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {health.length > 0 && (
        <section className="hub-card">
          <p className="hub-card__eyebrow">Weigh-ins and vet visits</p>
          {health.map((e) => <HealthRow key={e.id} entry={e} />)}
        </section>
      )}

      {journey.adoptionNote?.trim() && (
        <section className="hub-card">
          <p className="hub-card__eyebrow">Your note for adopters</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{journey.adoptionNote}</p>
        </section>
      )}
    </div>
  );
}

function HealthRow({ entry }: { entry: CareLogEntry }) {
  const when = formatDay(millisOf(entry.created_at));
  const label = entry.type === "weigh_in" ? `Weigh-in${entry.value ? ` · ${entry.value} lb` : ""}` : "Vet visit";
  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div className="pw-muted" style={{ fontSize: 13 }}>
        {when ?? <Unrecorded what="Date" />}{entry.note ? ` · ${entry.note}` : ""}
      </div>
    </div>
  );
}

/** The page this foster published about the dog, and the one control its author keeps. */
function PublishedPage({ dogId }: { dogId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = `${window.location.origin}/adoption/${dogId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function takeDown() {
    const uid = fosterDocId();
    if (!uid) return;
    setBusy(true);
    setFailed(false);
    try {
      // The live listener in `useJourneys` drops this section once the delete lands.
      await unpublishAdoptionProfile(dogId, uid);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="hub-card hub-card--dog">
      <p className="hub-card__eyebrow">Your adoption page is still up</p>
      <p style={{ margin: "0 0 10px" }}>
        Anyone with the link can read what you published. It doesn't change when you foster another dog.
      </p>
      <div className="sharesheet__url" style={{ wordBreak: "break-all" }}>{url}</div>
      {confirming ? (
        <div className="looking-actions">
          <button className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>Keep it up</button>
          <button className="btn btn--primary" onClick={takeDown} disabled={busy}>
            {busy ? "Taking it down…" : "Yes, take it down"}
          </button>
        </div>
      ) : (
        <div className="looking-actions">
          <button className="btn btn--primary" onClick={copy}>{copied ? "✓ Link copied" : "Copy link"}</button>
          <button className="btn btn--ghost" onClick={() => setConfirming(true)}>Take it down</button>
        </div>
      )}
      {failed && (
        <p role="alert" className="pw-muted" style={{ marginTop: 8 }}>
          That didn't go through, so the page is still up. Check your connection and try again.
        </p>
      )}
    </section>
  );
}
