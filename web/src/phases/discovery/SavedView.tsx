import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useApplication } from "../../hooks/useApplication";
import { useDogs } from "../../hooks/useDogs";
import { normalizeDog, thumbBackground, type RichDog } from "../../lib/dog";
import { scoreDog } from "../../lib/matching";
import { activeApplication, applicationStage, fosterWindow } from "../../lib/foster";
import { SignInToApply, needsAccountToApply } from "../../components/SignInToApply";
import { composeApprovalChecklist } from "../../lib/applicationView";
import { createApplication } from "../../lib/applications";
import { fosterDocId } from "../../lib/session";

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
  const active = activeApplication(foster);
  const activeDog = active ? byId(active.dogId) : null;

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
              : (<>
                  {active && activeDog && <BlockedNotice dogName={activeDog.name} phase={active.phase} />}
                  {saved.map((d, i) => <SavedCard key={d.id} d={d} i={i} blocked={!!active} />)}
                </>)
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

function BlockedNotice({ dogName, phase }: { dogName: string; phase: "match" | "care_plan" }) {
  const navigate = useNavigate();
  const stage = applicationStage({ dogId: "", phase });
  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="card" style={{ padding: 15, marginBottom: 14, borderRadius: 20, background: "var(--butter-soft)", boxShadow: "none" }}>
      <div className="row" style={{ gap: 9, alignItems: "flex-start" }}>
        <span style={{ fontSize: 17, lineHeight: 1.2 }}>{phase === "care_plan" ? "🏠" : "⏳"}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "#8A6516" }}>
            {phase === "care_plan" ? `${dogName} is in your care` : `Your application for ${dogName} is open`}
          </div>
          <p className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Pawthway supports one foster at a time, so applying is paused. These stay saved for
            when {dogName} heads home.
          </p>
          <button className="btn outline sm" style={{ marginTop: 11 }} onClick={() => navigate(stage.to)}>
            {stage.cta}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SavedCard({ d, i, blocked }: { d: RichDog; i: number; blocked: boolean }) {
  const navigate = useNavigate();
  const { foster } = useFoster();
  const [needsAccount, setNeedsAccount] = useState(false);

  const remove = () => patchFoster({ likedDogIds: (foster?.likedDogIds ?? []).filter(x => x !== d.id) });
  // Applying is what commits the foster to a dog — it sets matchedDogId and advances the
  // phase, which is exactly what the Match view (Sharang's) reads. It's also where a guest
  // has to become an account: everything past here needs a shelter to be able to reach them.
  const apply = async () => {
    if (needsAccountToApply()) {
      setNeedsAccount(true);
      return;
    }
    await patchFoster({ matchedDogId: d.id, phase: "match" });
    const fosterId = fosterDocId();
    if (fosterId) {
      await createApplication({
        fosterId, fosterName: foster?.name ?? "", dogId: d.id, shelterId: d.shelter_id,
      });
    }
    navigate("/match");
  };

  return (
    <motion.div layout initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * .05 }}
      className="card" style={{ padding: 13, marginBottom: 12, borderRadius: 22 }}>
      <button onClick={() => navigate(`/dog/${d.id}`)} style={{ display: "flex", gap: 13, alignItems: "center", width: "100%", textAlign: "left" }}>
        <div style={{ width: 68, height: 68, borderRadius: 17, flexShrink: 0, background: thumbBackground(d, 300, 300) }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row">
            <span style={{ fontWeight: 800, fontSize: 16 }}>{d.name}</span>
            <span className="sp" />
            <span className="chip sage" style={{ fontSize: 11.5 }}>{scoreDog(d, foster?.intake)}%</span>
          </div>
          <div className="muted" style={{ marginTop: 2 }}>{d.breed} · {d.ageLabel}</div>
          <div className="muted" style={{ marginTop: 3 }}>{d.shelter.short} · 🗓️ {d.fosterLength}</div>
        </div>
      </button>
      <div className="row" style={{ gap: 9, marginTop: 12 }}>
        <button className="btn outline sm" style={{ flex: 1 }} onClick={remove}>Remove</button>
        <button className="btn sm" style={{ flex: 1.5 }} onClick={apply} disabled={blocked}
          title={blocked ? "You already have a foster in progress" : undefined}>
          Apply to foster
        </button>
      </div>

      <AnimatePresence>
        {needsAccount && <SignInToApply dogName={d.name} onClose={() => setNeedsAccount(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function AppliedCard({ d, onOpenMatch }: { d: RichDog; onOpenMatch: () => void }) {
  const navigate = useNavigate();
  const { foster } = useFoster();
  const { application } = useApplication(d.id);

  // Progress mirrors the Match phase's own checklist rather than inventing a second source --
  // including the join, so this timeline and the Match view can't disagree about whether the
  // shelter has finished its half.
  const win = fosterWindow(d.fosterWeeks, d.fosterLength, foster?.pickup?.date);
  const approval = composeApprovalChecklist(foster?.approvalChecklist ?? [], application?.checklist ?? null);
  const approved = approval.length > 0 && approval.every(c => c.done);
  const activeIdx = foster?.pickup ? 3 : approved ? 2 : 1;

  const withdraw = () => patchFoster({ matchedDogId: null, phase: "discovery" });

  return (
    <motion.div layout initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="card" style={{ padding: 15, borderRadius: 22 }}>
      <button onClick={() => navigate(`/dog/${d.id}`)} style={{ display: "flex", gap: 13, alignItems: "center", width: "100%", textAlign: "left" }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, flexShrink: 0, background: thumbBackground(d, 300, 300) }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{d.name}</div>
          <div className="muted" style={{ marginTop: 2 }}>{d.shelter.short} · 🗓️ {win.total}</div>
        </div>
      </button>

      <div className="row" style={{ gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <span className={`chip ${approved ? "sage" : "butter"}`} style={{ fontWeight: 800 }}>
          {approved ? "✓ Approved — schedule pickup" : "⏳ Waiting for approval"}
        </span>
        {win.started && <span className="chip coral" style={{ fontWeight: 800 }}>⏳ {win.leftLabel}</span>}
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
