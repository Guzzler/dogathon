import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { ENERGY_WORD, normalizeDog, dogPhotoOrNull, sizeLabel } from "../../lib/dog";
import { distanceMi, matchReasons, scoreDog, useMyLocation } from "../../lib/matching";
import { activeApplication, applicationStage } from "../../lib/foster";
import { SignInToApply, needsAccountToApply } from "../../components/SignInToApply";
import { createApplication } from "../../lib/applications";
import { fosterDocId } from "../../lib/session";

export function DogDetailView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { foster } = useFoster();
  const { dogs, loading } = useDogs();
  const { pos } = useMyLocation();
  const [contact, setContact] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);

  if (loading) return <p className="pw-loading">Loading…</p>;
  const raw = dogs.find(d => d.id === id);
  if (!raw) return <div className="screen pad" style={{ paddingTop: 40 }}><h2>Dog not found</h2></div>;

  const dog = normalizeDog(raw);
  const miles = distanceMi(pos, dog.shelter);
  const score = scoreDog(dog, foster?.intake);
  const reasons = matchReasons(dog, foster?.intake);
  const saved = (foster?.likedDogIds ?? []).includes(dog.id);
  const active = activeApplication(foster);
  const blocked = !!active && active.dogId !== dog.id;
  const isThisOne = active?.dogId === dog.id;
  const activeDogName = active ? dogs.find(d => d.id === active.dogId)?.name ?? "your foster dog" : "";

  const toggleSave = () => patchFoster(
    saved
      ? { likedDogIds: (foster?.likedDogIds ?? []).filter(x => x !== dog.id) }
      : { likedDogIds: [...new Set([...(foster?.likedDogIds ?? []), dog.id])] }
  );

  // "One foster at a time" is about the journey they already have, so that explanation wins
  // over the account prompt — being told to sign in first would only bury it.
  const startApply = () =>
    blocked || !needsAccountToApply() ? setContact(true) : setNeedsAccount(true);

  const apply = async () => {
    await patchFoster({
      likedDogIds: [...new Set([...(foster?.likedDogIds ?? []), dog.id])],
      matchedDogId: dog.id,
      phase: "match",
    });
    const fosterId = fosterDocId();
    if (fosterId) {
      await createApplication({
        fosterId, fosterName: foster?.name ?? "", dogId: dog.id, shelterId: raw.shelter_id,
      });
    }
    setContact(false);
    navigate("/match");
  };

  const photo = dogPhotoOrNull(dog, 800, 900);

  return (
    <div className="screen">
      <div className="scroll">
        <div style={{ position: "relative", height: 340, flexShrink: 0 }}>
          {photo ? (
            <img src={photo} alt={dog.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className="photo-empty" aria-label={`No photo of ${dog.name} yet`} role="img">🐾</div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--cream) 0%, var(--cream) 9%, rgba(255,247,241,0) 46%)" }} />
          <button className="iconbtn" onClick={() => navigate(-1)}
            style={{ position: "absolute", top: 16, left: 20, background: "rgba(255,255,255,.95)" }}>←</button>
        </div>

        <div className="pad" style={{ marginTop: -26, position: "relative", zIndex: 1 }}>
          <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="row">
              <h1 style={{ fontSize: 34 }}>{dog.name}</h1>
              <span className="sp" />
              <span className="chip" style={{ background: score >= 75 ? "var(--sage)" : "var(--cream-2)", color: score >= 75 ? "#fff" : "var(--ink-2)", fontWeight: 800, fontSize: 13 }}>
                {score}% match
              </span>
            </div>
            <p className="sub" style={{ marginTop: 4, fontWeight: 700, color: "var(--ink-2)" }}>
              {dog.ageLabel} · {dog.breed} · {sizeLabel(dog.size)}
            </p>
            <div className="row" style={{ gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              <span className="chip butter" style={{ fontWeight: 800 }}>
                🗓️ {dog.fosterLength} foster
              </span>
              {dog.in_foster_home && (
                <span className="chip sage" style={{ fontWeight: 800 }}>
                  🏠 Already in a foster home
                </span>
              )}
            </div>

            {reasons.length > 0 && (
              <Section title="Why you match">
                <div className="card" style={{ padding: "14px 17px", background: "var(--sage-soft)", boxShadow: "none" }}>
                  {reasons.map((r, n) => (
                    <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .06 * n }}
                      className="row" style={{ gap: 9, padding: "5px 0" }}>
                      <span style={{ color: "var(--sage)", fontWeight: 900, fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#3F7A63" }}>{r}</span>
                    </motion.div>
                  ))}
                </div>
              </Section>
            )}

            <Section title={`About ${dog.name}`}>
              <p className="sub">{dog.notes}</p>
              {dog.traitList.length > 0 && (
                <div className="row" style={{ gap: 7, marginTop: 13, flexWrap: "wrap" }}>
                  {dog.traitList.map((t, i) => <span key={t} className={`chip ${["coral", "sage", "butter"][i % 3]}`}>{t}</span>)}
                </div>
              )}
            </Section>

            <Section title="Requirements">
              <div className="card" style={{ padding: "4px 17px" }}>
                <Row k="Energy">
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 74, height: 7, borderRadius: 100, background: "var(--cream-2)", overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(dog.energyLevel / 4) * 100}%` }}
                        transition={{ delay: .2, duration: .5 }}
                        style={{ height: "100%", borderRadius: 100, background: "var(--coral)" }} />
                    </div>
                    <b style={{ fontSize: 13.5 }}>{ENERGY_WORD[dog.energyLevel]}</b>
                  </div>
                </Row>
                <Row k="Size"><b>{sizeLabel(dog.size)}{dog.weight_lbs != null && ` · ${dog.weight_lbs} lb`}</b></Row>
                {(dog.groomingLevel || dog.coatLength) && (
                  <Row k="Grooming"><b>
                    {[dog.groomingLevel && (dog.groomingLevel === "low" ? "Low" : "High"),
                      dog.coatLength && `${dog.coatLength} coat`].filter(Boolean).join(" · ")}
                  </b></Row>
                )}
                <Row k="Good with kids"><Yes ok={dog.good_with_kids} /></Row>
                <Row k="Good with dogs"><Yes ok={dog.good_with_dogs} /></Row>
                <Row k="Good with cats"><Yes ok={dog.goodWithCats} /></Row>
                <Row k="First-time friendly"><Yes ok={dog.energyLevel <= 2} /></Row>
                <Row k="Foster length"><b>{dog.fosterLength}</b></Row>
                {dog.needsList.length > 0 && <Row k="You'd need" last><b>{dog.needsList.join(", ")}</b></Row>}
              </div>
            </Section>

            <Section title="Find at">
              <div className="card" style={{ padding: 17, display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 15, background: "var(--coral-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Paw />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{dog.shelter.name}</div>
                  <div className="muted" style={{ marginTop: 2 }}>{miles.toFixed(1)} mi · {dog.shelter.address}</div>
                </div>
              </div>
            </Section>
          </motion.div>
        </div>
      </div>

      <div className="pad safe-b" style={{ paddingTop: 14, background: "linear-gradient(to top, var(--cream) 62%, transparent)" }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn outline" style={{ flex: 1 }} onClick={toggleSave}>{saved ? "♥ Saved" : "♡ Save"}</button>
          {isThisOne ? (
            <button className="btn" style={{ flex: 1.3 }} onClick={() => navigate(applicationStage(active).to)}>
              {applicationStage(active).cta}
            </button>
          ) : (
            <button className="btn" style={{ flex: 1.3 }} onClick={startApply}>Apply to foster</button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {needsAccount && (
          <SignInToApply dogName={dog.name} onClose={() => setNeedsAccount(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contact && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContact(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(35,25,18,.4)", zIndex: 900 }} />
            <motion.div initial={{ y: 340 }} animate={{ y: 0 }} exit={{ y: 360 }}
              transition={{ type: "spring", stiffness: 330, damping: 33 }}
              style={{
                position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 901, background: "#fff",
                borderRadius: "28px 28px 0 0", padding: "12px 22px max(22px,env(safe-area-inset-bottom))", textAlign: "center",
              }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line)", margin: "0 auto 18px" }} />
              <div style={{ fontSize: 34 }}>{blocked ? (active?.phase === "care_plan" ? "🏠" : "⏳") : "🐾"}</div>
              {blocked ? (
                <>
                  <h3 style={{ marginTop: 12 }}>One foster at a time</h3>
                  <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
                    {active?.phase === "care_plan"
                      ? `${activeDogName} is in your care right now.`
                      : `Your application for ${activeDogName} is still open.`}{" "}
                    {dog.name} stays saved — you can apply once that wraps up.
                  </p>
                  <button className="btn" style={{ marginTop: 20 }}
                    onClick={() => navigate(applicationStage(active!).to)}>
                    {applicationStage(active!).cta}
                  </button>
                  <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => setContact(false)}>Close</button>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 12 }}>Apply to foster {dog.name}?</h3>
                  <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
                    This starts your approval checklist with {dog.shelter.short}. You can only
                    have one application open at a time.
                  </p>
                  <button className="btn" style={{ marginTop: 20 }} onClick={apply}>Yes, apply to foster</button>
                  <button className="btn ghost" style={{ marginTop: 4 }} onClick={() => setContact(false)}>Not yet</button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const Paw = () => (
  <svg viewBox="0 0 100 100" width="22" height="22" aria-hidden>
    <ellipse cx="35" cy="30" rx="11" ry="14" fill="var(--coral)" />
    <ellipse cx="65" cy="30" rx="11" ry="14" fill="var(--coral)" />
    <ellipse cx="16" cy="52" rx="10" ry="12.5" fill="var(--coral)" transform="rotate(-20 16 52)" />
    <ellipse cx="84" cy="52" rx="10" ry="12.5" fill="var(--coral)" transform="rotate(20 84 52)" />
    <path d="M50 48c13.5 0 23.5 10.5 23.5 21.5C73.5 79 65 84 50 84s-23.5-5-23.5-14.5C26.5 58.5 36.5 48 50 48Z" fill="var(--coral)" />
  </svg>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 11 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ k, children, last }: { k: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="row" style={{ gap: 12, padding: "13px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span className="muted" style={{ fontWeight: 700, flexShrink: 0 }}>{k}</span>
      <span className="sp" />
      <span style={{ fontSize: 14, textAlign: "right" }}>{children}</span>
    </div>
  );
}

/** Tri-state: null means the shelter never recorded it, which is not the same as "no". */
const Yes = ({ ok }: { ok: boolean | null | undefined }) => (
  <b style={{ color: ok ? "var(--sage)" : "var(--ink-3)" }}>
    {ok == null ? "Not recorded" : ok ? "Yes" : "Not yet"}
  </b>
);
