import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { normalizeDog, photoUrl, type RichDog } from "../../lib/dog";
import { scoreDog } from "../../lib/matching";

const STAGES = ["Applied", "Under review", "Approved", "Pickup"];

export function SavedView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs, loading: dogsLoading } = useDogs();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "applied" ? "applied" : "saved";

  if (loading || dogsLoading) return <p className="pw-loading">Loading…</p>;

  const byId = (id: string) => {
    const raw = dogs.find(d => d.id === id);
    return raw ? normalizeDog(raw) : null;
  };

  const liked = (foster?.likedDogIds ?? []).map(byId).filter(Boolean) as RichDog[];
  const matched = foster?.matchedDogId ? byId(foster.matchedDogId) : null;
  const saved = liked.filter(d => d.id !== foster?.matchedDogId);

  return (
    <div className="screen">
      <div className="topbar"><h3>Your dogs</h3></div>

      <div className="tabs">
        {([["saved", `Saved (${saved.length})`], ["applied", `Applications (${matched ? 1 : 0})`]] as const).map(([k, l]) => (
          <button key={k} data-on={tab === k} onClick={() => setParams(k === "saved" ? {} : { tab: "applied" })}>
            {l}
            {tab === k && <motion.span layoutId="tab-ul" className="ul" />}
          </button>
        ))}
      </div>

      <div className="scroll pad" style={{ paddingTop: 16 }}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {tab === "saved" ? (
            saved.length === 0
              ? <Empty emoji="🐾" title="Nothing saved yet"
                  body="Swipe right on a pup, or tap Save on their profile, and they'll wait for you here."
                  cta={{ label: "Find dogs", to: "/discovery" }} />
              : saved.map((d, i) => <SavedCard key={d.id} d={d} i={i} />)
          ) : (
            !matched
              ? <Empty emoji="📋" title="No application yet"
                  body="When you apply to foster a dog, you'll track the shelter's response here."
                  cta={{ label: "See saved dogs", to: "/saved" }} />
              : <AppliedCard d={matched} onOpenMatch={() => navigate("/match")} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function SavedCard({ d, i }: { d: RichDog; i: number }) {
  const navigate = useNavigate();
  const { foster } = useFoster();

  const remove = () => patchFoster({ likedDogIds: (foster?.likedDogIds ?? []).filter(x => x !== d.id) });
  // Applying is what commits the foster to a dog — it sets matchedDogId and advances the
  // phase, which is exactly what the Match view (Sharang's) reads.
  const apply = () => patchFoster({ matchedDogId: d.id, phase: "match" });

  return (
    <motion.div layout initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * .05 }}
      className="card" style={{ padding: 13, marginBottom: 12, borderRadius: 22 }}>
      <button onClick={() => navigate(`/dog/${d.id}`)} style={{ display: "flex", gap: 13, alignItems: "center", width: "100%", textAlign: "left" }}>
        <div style={{ width: 68, height: 68, borderRadius: 17, flexShrink: 0, background: `var(--cream-2) url(${photoUrl(d.photoId, 300, 300)}) center/cover` }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row">
            <span style={{ fontWeight: 800, fontSize: 16 }}>{d.name}</span>
            <span className="sp" />
            <span className="chip sage" style={{ fontSize: 11.5 }}>{scoreDog(d, foster?.intake)}%</span>
          </div>
          <div className="muted" style={{ marginTop: 2 }}>{d.breed} · {d.ageLabel}</div>
          <div className="muted" style={{ marginTop: 3 }}>{d.shelter.short}</div>
        </div>
      </button>
      <div className="row" style={{ gap: 9, marginTop: 12 }}>
        <button className="btn outline sm" style={{ flex: 1 }} onClick={remove}>Remove</button>
        <button className="btn sm" style={{ flex: 1.5 }} onClick={apply}>Apply to foster</button>
      </div>
    </motion.div>
  );
}

function AppliedCard({ d, onOpenMatch }: { d: RichDog; onOpenMatch: () => void }) {
  const navigate = useNavigate();
  const { foster } = useFoster();

  // Progress mirrors the Match phase's own checklist rather than inventing a second source.
  const approval = foster?.approvalChecklist ?? [];
  const approved = approval.length > 0 && approval.every(c => c.done);
  const activeIdx = foster?.pickup ? 3 : approved ? 2 : 1;

  const withdraw = () => patchFoster({ matchedDogId: null, phase: "discovery" });

  return (
    <motion.div layout initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="card" style={{ padding: 15, borderRadius: 22 }}>
      <button onClick={() => navigate(`/dog/${d.id}`)} style={{ display: "flex", gap: 13, alignItems: "center", width: "100%", textAlign: "left" }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, flexShrink: 0, background: `var(--cream-2) url(${photoUrl(d.photoId, 300, 300)}) center/cover` }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{d.name}</div>
          <div className="muted" style={{ marginTop: 2 }}>{d.shelter.short}</div>
        </div>
      </button>

      <div className={`chip ${approved ? "sage" : "butter"}`} style={{ marginTop: 12, fontWeight: 800 }}>
        {approved ? "✓ Approved — schedule pickup" : "⏳ Waiting for approval"}
      </div>

      <div className="tl">
        {STAGES.map((label, n) => (
          <div key={label} className="tl-step" data-done={n < activeIdx} data-now={n === activeIdx}>
            <span className="tl-dot">{n < activeIdx ? "✓" : ""}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 14, lineHeight: 1.5 }}>
        {approved
          ? `${d.shelter.short} approved you. Finish home prep and lock in a pickup time.`
          : `${d.shelter.short} works through the approval checklist with you — open Match to see what's outstanding.`}
      </p>

      <button className="btn sm" style={{ width: "100%", marginTop: 12 }} onClick={onOpenMatch}>
        Open Match checklist
      </button>
      <button className="btn ghost sm" style={{ width: "100%", marginTop: 4 }} onClick={withdraw}>
        Withdraw application
      </button>
    </motion.div>
  );
}

function Empty({ emoji, title, body, cta }: { emoji: string; title: string; body: string; cta: { label: string; to: string } }) {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center", padding: "56px 20px" }}>
      <div style={{ fontSize: 44 }}>{emoji}</div>
      <h3 style={{ marginTop: 14 }}>{title}</h3>
      <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>{body}</p>
      <button className="btn outline sm" style={{ margin: "20px auto 0" }} onClick={() => navigate(cta.to)}>{cta.label}</button>
    </div>
  );
}
