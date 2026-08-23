import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { normalizeDog } from "../../lib/dog";

/**
 * The coordinator chat gets its own screen rather than a panel wedged into the
 * Match page. Embedded, it was a scroller inside a scroller: the thread had a few
 * hundred pixels to work with, the page kept moving underneath it, and long
 * answers ran under the tab bar. Full screen, there's exactly one thing scrolling.
 */
export function MatchChatView() {
  const navigate = useNavigate();
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  const raw = dogs.find((d) => d.id === foster?.matchedDogId);
  const dog = raw ? normalizeDog(raw) : null;

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster?.pickup || !dog) {
    return (
      <div className="screen pad" style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>💬</div>
        <h3 style={{ marginTop: 14 }}>Nothing to talk about yet</h3>
        <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
          Once your pickup is scheduled you can message the shelter here.
        </p>
        <button className="btn outline sm" style={{ margin: "20px auto 0" }} onClick={() => navigate("/match")}>
          Back to Match
        </button>
      </div>
    );
  }

  const pickupDateLabel = new Date(foster.pickup.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      className="screen chat-screen"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
    >
      <div className="chat-screen__bar">
        <button
          type="button"
          className="chat-screen__back"
          onClick={() => navigate("/match")}
          aria-label="Back to Match"
        >
          ‹
        </button>
        <div className="chat-screen__title">
          <div className="chat-screen__name">{dog.shelter.name}</div>
          <div className="chat-screen__sub">
            Pickup {pickupDateLabel} · {foster.pickup.time}
          </div>
        </div>
      </div>

      <AgentChatPanel
        variant="full"
        activityMode="minimal"
        placeholder="Ask about parking, what to bring…"
        emptyState={`You're confirmed for ${pickupDateLabel} at ${foster.pickup.time}. Ask us anything before the day.`}
        quickActions={[
          {
            label: "What should I bring?",
            message: `I'm picking up ${dog.name} on ${pickupDateLabel} at ${foster.pickup.time}. What should I bring?`,
          },
          {
            label: "How long does it take?",
            message: `How long should I set aside for the ${dog.name} pickup appointment?`,
          },
          {
            label: "Parking?",
            message: `Where should I park for pickup at ${dog.shelter.name}?`,
          },
        ]}
      />
    </motion.div>
  );
}
