import { useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { dogPhotoOrNull, type RichDog } from "../lib/dog";
import { distanceMi } from "../lib/matching";

type Props = {
  dogs: RichDog[];
  me: { lat: number; lng: number };
  scoreOf: (d: RichDog) => number;
  onLike: (id: string) => void;
  onPass: (id: string) => void;
  onUndo: (id: string) => void;
  onOpen: (id: string) => void;
};

export default function SwipeDeck({ dogs, me, scoreOf, onLike, onPass, onUndo, onOpen }: Props) {
  const [flick, setFlick] = useState<1 | -1 | 0>(0);
  const [history, setHistory] = useState<string[]>([]);

  // The queue comes from Firestore, so a swipe removes the dog from `dogs` on the next
  // render — the top card is always index 0 rather than a locally tracked cursor.
  const top = dogs[0];
  const next = dogs[1];

  const advance = (dir: 1 | -1) => {
    if (!top) return;
    setFlick(dir);
    setHistory(h => [...h, top.id]);
    setTimeout(() => { if (dir === 1) onLike(top.id); else onPass(top.id); setFlick(0); }, 170);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    onUndo(last);
    setHistory(h => h.slice(0, -1));
  };

  if (!top) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 34, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 52 }}>🎉</div>
          <h2 style={{ marginTop: 14 }}>That's everyone!</h2>
          <p className="sub" style={{ marginTop: 10 }}>
            You've been through every dog that matches your filters. Check your saved list, or widen your filters.
          </p>
          {history.length > 0 && (
            <button className="btn outline sm" style={{ margin: "22px auto 0" }} onClick={undo}>↺ Undo last swipe</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", margin: "4px 20px 0" }}>
        {next && <CardShell key={next.id} dog={next} me={me} score={scoreOf(next)} behind />}
        <SwipeCard key={top.id} dog={top} me={me} score={scoreOf(top)} flick={flick}
          onSwipe={advance} onOpen={() => onOpen(top.id)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "16px 0 0" }}>
        <RoundBtn label="Pass" bg="#fff" fg="var(--ink-3)" size={62} onClick={() => advance(-1)}>✕</RoundBtn>
        <RoundBtn label="Undo last swipe" bg="#fff" fg={history.length ? "var(--butter)" : "var(--line)"} size={50}
          onClick={undo} disabled={!history.length}>↺</RoundBtn>
        <RoundBtn label="Like" bg="var(--coral)" fg="#fff" size={62} onClick={() => advance(1)}>♥</RoundBtn>
      </div>
      <div className="muted safe-b" style={{ textAlign: "center", paddingTop: 9, fontSize: 12 }}>
        Swipe, or tap the card to learn more
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function RoundBtn({ children, bg, fg, size, onClick, label, disabled }: any) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : .88 }} onClick={onClick} aria-label={label} disabled={disabled}
      style={{
        width: size, height: size, borderRadius: "50%", background: bg, color: fg,
        fontSize: size * .38, display: "grid", placeItems: "center",
        boxShadow: bg === "#fff" ? "var(--shadow)" : "0 6px 20px rgba(244,121,91,.4)",
      }}>{children}</motion.button>
  );
}

function SwipeCard({ dog, me, score, flick, onSwipe, onOpen }: {
  dog: RichDog; me: { lat: number; lng: number }; score: number; flick: 1 | -1 | 0;
  onSwipe: (d: 1 | -1) => void; onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const likeOp = useTransform(x, [30, 140], [0, 1]);
  const passOp = useTransform(x, [-140, -30], [1, 0]);

  return (
    <motion.div
      drag="x" dragElastic={.7} style={{ x, rotate, position: "absolute", inset: 0, cursor: "grab" }}
      initial={{ scale: .94, opacity: 0 }} animate={flick ? { x: flick * 520, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 700) onSwipe(1);
        else if (info.offset.x < -110 || info.velocity.x < -700) onSwipe(-1);
      }}
      onClick={() => { if (Math.abs(x.get()) < 6) onOpen(); }}
    >
      <CardShell dog={dog} me={me} score={score} />
      <motion.div style={{ ...stamp, left: 22, borderColor: "var(--sage)", color: "var(--sage)", opacity: likeOp, rotate: -14 }}>LIKE</motion.div>
      <motion.div style={{ ...stamp, right: 22, borderColor: "var(--ink-3)", color: "var(--ink-3)", opacity: passOp, rotate: 14 }}>PASS</motion.div>
    </motion.div>
  );
}

const stamp: any = {
  position: "absolute", top: 26, padding: "7px 16px", border: "3.5px solid", borderRadius: 12,
  fontWeight: 900, fontSize: 21, letterSpacing: ".06em", background: "rgba(255,255,255,.88)", zIndex: 3,
};

export function CardShell({ dog, me, score, behind }: {
  dog: RichDog; me: { lat: number; lng: number }; score: number; behind?: boolean;
}) {
  const miles = distanceMi(me, dog.shelter);
  const photo = dogPhotoOrNull(dog, 800, 1000);
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: 28, overflow: "hidden", background: "var(--cream-2)",
      boxShadow: behind ? "var(--shadow)" : "var(--shadow-lg)",
      transform: behind ? "scale(.93) translateY(14px)" : undefined,
      opacity: behind ? .55 : 1, pointerEvents: behind ? "none" : undefined,
    }}>
      {/* A dog with no photo gets an empty tile, never a stand-in of some other animal --
          see dogPhotoOrNull(). */}
      {photo ? (
        <img src={photo} alt={dog.name} draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }} />
      ) : (
        <div className="photo-empty" aria-label={`No photo of ${dog.name} yet`} role="img">🐾</div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,20,15,.86) 0%, rgba(28,20,15,.34) 32%, transparent 58%)" }} />

      {/* the card behind shows artwork only — its text would collide with the top card mid-swipe */}
      {!behind && (
        <>
          <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", gap: 8 }}>
            <span className="chip" style={{ background: "rgba(255,255,255,.94)", fontWeight: 800 }}>{dog.shelter.short}</span>
            <span className="sp" />
            <span className="chip" style={{ background: score >= 75 ? "var(--sage)" : "rgba(255,255,255,.94)", color: score >= 75 ? "#fff" : "var(--ink-2)", fontWeight: 800 }}>
              {score}% match
            </span>
          </div>

          <div style={{ position: "absolute", left: 20, right: 20, bottom: 20, color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <h2 style={{ color: "#fff", fontSize: 30 }}>{dog.name}</h2>
              <span style={{ fontWeight: 700, fontSize: 16, opacity: .92 }}>{dog.ageLabel}</span>
            </div>
            <div style={{ fontSize: 14, opacity: .88, marginTop: 3, fontWeight: 600 }}>
              {[dog.breed, dog.weight_lbs != null && `${dog.weight_lbs} lb`, `${miles.toFixed(1)} mi away`].filter(Boolean).join(" · ")}
            </div>
            <div style={{ fontSize: 13.5, opacity: .95, marginTop: 6, fontWeight: 800 }}>
              🗓️ {dog.fosterLength} foster
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
              {dog.traitList.slice(0, 3).map(t => (
                <span key={t} className="chip" style={{ background: "rgba(255,255,255,.2)", color: "#fff", backdropFilter: "blur(8px)", fontSize: 12 }}>{t}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
