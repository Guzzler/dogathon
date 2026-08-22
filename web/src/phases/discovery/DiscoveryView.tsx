import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import { FOSTER_ID, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { useSwipe } from "../../hooks/useSwipe";

export function DiscoveryView() {
  const navigate = useNavigate();
  const { foster, loading: fosterLoading } = useFoster();
  const { dogs, loading: dogsLoading } = useDogs();
  const [busy, setBusy] = useState(false);

  const queue = useMemo(() => {
    if (!foster) return [];
    const seen = new Set([...(foster.likedDogIds ?? []), ...(foster.passedDogIds ?? [])]);
    return dogs.filter((d) => d.status === "available" && !seen.has(d.id));
  }, [dogs, foster]);

  const current = queue[0];

  async function decide(liked: boolean) {
    if (!current || busy) return;
    setBusy(true);
    try {
      const field = liked ? "likedDogIds" : "passedDogIds";
      const ref = doc(firestore, "fosters", FOSTER_ID);
      const updates: Record<string, unknown> = { [field]: arrayUnion(current.id) };
      if (liked) {
        updates.matchedDogId = current.id;
        updates.phase = "match";
      }
      await updateDoc(ref, updates);
      if (liked) navigate("/match");
    } finally {
      setBusy(false);
    }
  }

  const { style, handlers } = useSwipe(decide);

  if (fosterLoading || dogsLoading) return <p className="pw-loading">Loading dogs…</p>;

  return (
    <div className="pw-page pw-page--narrow">
      <h1>Find your match</h1>
      <p className="pw-subtitle">Dogs from nearby shelters, matched to what you told us.</p>

      {!current ? (
        <div className="swipe-card">
          <h2>That's everyone for now</h2>
          <p className="pw-muted">Check back later for more dogs, or revisit a shelter directly.</p>
        </div>
      ) : (
        <>
          <div className="swipe-card swipe-card--dog" style={style} {...handlers}>
            <div className="swipe-card__photo" aria-hidden="true">
              🐕
            </div>
            <h2>{current.name}</h2>
            <p className="pw-muted">
              {current.breed} · {current.age_years} yrs · {current.weight_lbs} lbs
            </p>
            <p>{current.notes}</p>
            <div className="swipe-card__traits">
              {current.good_with_kids && <span className="badge badge--soft">Good with kids</span>}
              {current.good_with_dogs && <span className="badge badge--soft">Good with dogs</span>}
            </div>
          </div>

          <div className="swipe-actions">
            <button className="btn btn--deny" disabled={busy} onClick={() => decide(false)}>
              ✕ Pass
            </button>
            <button className="btn btn--approve" disabled={busy} onClick={() => decide(true)}>
              ♥ Like
            </button>
          </div>
          <p className="pw-muted pw-hint">{queue.length} more to see · drag the card, or use the buttons</p>
        </>
      )}
    </div>
  );
}
