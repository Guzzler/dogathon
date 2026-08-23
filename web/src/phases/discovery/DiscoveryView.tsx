import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import MapView from "../../components/MapView";
import SwipeDeck from "../../components/SwipeDeck";
import DogGrow from "../../components/DogGrow";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { ENERGY_WORD, normalizeDog, type RichDog } from "../../lib/dog";
import { prefs, scoreDog, useMyLocation } from "../../lib/matching";
import { PawMark, Wordmark } from "../../components/Logo";

const sizeWord = (v: number) => (v < 33 ? "Small" : v < 67 ? "Medium" : "Large");

export function DiscoveryView() {
  const navigate = useNavigate();
  const { foster, loading: fosterLoading } = useFoster();
  const { dogs, loading: dogsLoading } = useDogs();
  const [view, setView] = useState<"map" | "swipe">("map");
  const [filters, setFilters] = useState(false);
  const [q, setQ] = useState("");
  const { pos, real } = useMyLocation();

  const intake = foster?.intake;
  const scoreOf = (d: RichDog) => scoreDog(d, intake);

  const available = useMemo(
    () => dogs.filter(d => d.status === "available").map(normalizeDog),
    [dogs]
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return available
      .filter(d => scoreOf(d) >= 45)
      .filter(d => !needle || [d.name, d.breed, d.shelter.name, d.shelter.address].some(f => f.toLowerCase().includes(needle)))
      .sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [available, intake, q]); // eslint-disable-line

  const queue = useMemo(() => {
    const seen = new Set([...(foster?.likedDogIds ?? []), ...(foster?.passedDogIds ?? [])]);
    return matches.filter(d => !seen.has(d.id));
  }, [matches, foster?.likedDogIds, foster?.passedDogIds]);

  // Liking saves the dog. Committing to a match happens explicitly from Saved → Apply to
  // foster, which is what sets matchedDogId and moves the foster into the Match phase.
  const like = (id: string) => patchFoster({
    likedDogIds: [...new Set([...(foster?.likedDogIds ?? []), id])],
    passedDogIds: (foster?.passedDogIds ?? []).filter(x => x !== id),
  });
  const pass = (id: string) => patchFoster({
    passedDogIds: [...new Set([...(foster?.passedDogIds ?? []), id])],
    likedDogIds: (foster?.likedDogIds ?? []).filter(x => x !== id),
  });
  const undo = (id: string) => patchFoster({
    likedDogIds: (foster?.likedDogIds ?? []).filter(x => x !== id),
    passedDogIds: (foster?.passedDogIds ?? []).filter(x => x !== id),
  });

  // The map is expensive and meaningless without pins, so nothing renders until the roster
  // resolves. An empty roster is a real outcome, not an error — say so plainly.
  if (fosterLoading || dogsLoading) return <FindingDogs />;
  if (!available.length) return <NoDogsNearby />;

  return (
    <div className="screen">
      <div className="topbar" style={{ paddingBottom: 10 }}>
        <PawMark size={26} />
        <Wordmark size={20} />
        <span className="sp" />
        <span className="chip sage" style={{ fontWeight: 800 }}>{matches.length} matches</span>
      </div>

      <div className="pad" style={{ paddingBottom: 10 }}>
        <div className="seg" style={{ position: "relative" }}>
          <motion.span className="pill" layout transition={{ type: "spring", stiffness: 420, damping: 34 }}
            style={{ left: view === "map" ? 4 : "50%", width: "calc(50% - 4px)" }} />
          <button data-on={view === "map"} onClick={() => setView("map")}>🗺️ Map view</button>
          <button data-on={view === "swipe"} onClick={() => setView("swipe")}>⚡ Quick mode</button>
        </div>

        {view === "map" ? (
          <div className="row" style={{ gap: 10, marginTop: 11 }}>
            <label className="searchbar">
              🔍
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search dogs, breeds, shelters…"
                style={{ border: "none", outline: "none", background: "none", font: "inherit", color: "var(--ink)", flex: 1, minWidth: 0 }} />
              {q && <button onClick={() => setQ("")} style={{ color: "var(--ink-3)" }}>✕</button>}
            </label>
            <button className="iconbtn" onClick={() => setFilters(true)} aria-label="Filters">⚙</button>
          </div>
        ) : (
          <div className="row" style={{ gap: 10, marginTop: 9, justifyContent: "center" }}>
            <span className="muted">{queue.length} left · {real ? "near you" : "near San Francisco"}</span>
            <button className="chip" onClick={() => setFilters(true)} style={{ fontWeight: 800 }}>⚙ Filters</button>
          </div>
        )}
      </div>

      {view === "map" ? (
        <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex" }}>
          <MapView dogs={matches} me={pos} scoreOf={scoreOf} onOpen={id => navigate(`/dog/${id}`)} />
        </motion.div>
      ) : (
        <motion.div key="swipe" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }}
          style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <SwipeDeck dogs={queue} me={pos} scoreOf={scoreOf}
            onLike={like} onPass={pass} onUndo={undo} onOpen={id => navigate(`/dog/${id}`)} />
        </motion.div>
      )}

      <AnimatePresence>
        {filters && <FilterSheet onClose={() => setFilters(false)} />}
      </AnimatePresence>
    </div>
  );
}

function FilterSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { foster } = useFoster();
  const p = prefs(foster?.intake);

  const save = (patch: Record<string, number>) =>
    patchFoster({ intake: { ...foster?.intake, ...patch } });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(35,25,18,.4)", zIndex: 900 }} />
      <motion.div initial={{ y: 480 }} animate={{ y: 0 }} exit={{ y: 500 }}
        transition={{ type: "spring", stiffness: 330, damping: 33 }}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 901, background: "#fff",
          borderRadius: "28px 28px 0 0", padding: "12px 22px max(20px,env(safe-area-inset-bottom))",
          maxHeight: "88%", overflowY: "auto",
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line)", margin: "0 auto 14px" }} />
        <h3>Adjust your filters</h3>
        <p className="muted" style={{ marginTop: 5 }}>Straight from your questionnaire.</p>

        <div style={{ marginTop: 12 }}><DogGrow t={p.size / 100} /></div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 6, marginBottom: 2 }}>
          <span className="cglabel" style={{ margin: 0 }}>Size</span>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--coral)" }}>{sizeWord(p.size)}</span>
        </div>
        <input className="slider" type="range" min={0} max={100} value={p.size} aria-label="Size preference"
          onChange={e => save({ pref_size: +e.target.value })} />

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14, marginBottom: 2 }}>
          <span className="cglabel" style={{ margin: 0 }}>Energy</span>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--coral)" }}>{ENERGY_WORD[p.energy]}</span>
        </div>
        <input className="slider" type="range" min={0} max={4} value={p.energy} aria-label="Energy preference"
          onChange={e => save({ pref_energy: +e.target.value })} />

        <div className="divider" style={{ margin: "16px 0" }} />
        <button className="btn outline" onClick={() => navigate("/onboarding")}>Retake the questionnaire</button>
        <button className="btn ghost" style={{ marginTop: 4 }}
          onClick={() => { patchFoster({ likedDogIds: [], passedDogIds: [] }); onClose(); }}>
          Reset my swipes
        </button>
        <button className="btn" style={{ marginTop: 8 }} onClick={onClose}>Done</button>
      </motion.div>
    </>
  );
}

/** Shown while the roster resolves — the map stays out until there's something to pin. */
function FindingDogs() {
  return (
    <div className="screen discovery-state">
      <motion.div initial={{ scale: .85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}>
        <PawMark size={64} />
      </motion.div>
      <h2 style={{ marginTop: 20 }}>Finding dogs near you</h2>
      <p className="sub" style={{ marginTop: 8, maxWidth: 260 }}>
        Checking shelters in your area for dogs who need a foster.
      </p>
      <div className="discovery-state__bar"><i /></div>
    </div>
  );
}

/** An empty radius is an honest answer, not a failure. */
function NoDogsNearby() {
  return (
    <div className="screen discovery-state">
      <div style={{ fontSize: 44 }}>🐾</div>
      <h2 style={{ marginTop: 16 }}>No dogs nearby yet</h2>
      <p className="sub" style={{ marginTop: 8, maxWidth: 280 }}>
        There aren't any dogs listed near you right now. Shelters add new ones all the time —
        it's worth checking back.
      </p>
    </div>
  );
}
