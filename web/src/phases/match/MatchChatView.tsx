import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { AgentChatPanel } from "../../components/AgentChatPanel";
import { normalizeDog } from "../../lib/dog";

/**
 * The pickup chat gets its own screen rather than a panel wedged into the
 * Match page. Embedded, it was a scroller inside a scroller: the thread had a few
 * hundred pixels to work with, the page kept moving underneath it, and long
 * answers ran under the tab bar. Full screen, there's exactly one thing scrolling.
 *
 * RS-14: this is Pawthway's assistant, **not the shelter**. It used to be titled with the
 * shelter's name and opened by telling the foster their slot was confirmed -- a model speaking as a real
 * organisation, confirming a slot that organisation had never seen. The shelter's name may
 * appear as the topic; it is never the speaker. Whether the shelter confirmed is on the Match
 * screen, which reads the shelter's own write.
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
          Once you've requested a pickup, you can ask Pawthway's assistant about the day here.
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
          <div className="chat-screen__name">Pawthway assistant</div>
          <div className="chat-screen__sub">
            About your pickup request at {dog.shelter.short} · {pickupDateLabel}
          </div>
        </div>
      </div>

      <AgentChatPanel
              phase="match"
        variant="full"
        activityMode="minimal"
        placeholder="Ask about parking, what to bring…"
        emptyState={`You've asked ${dog.shelter.short} for ${pickupDateLabel} at ${foster.pickup.time}. I'm Pawthway's assistant, not the shelter — I can help you get ready, but messages here don't reach them. Whether they've confirmed shows on the Match screen.`}
        quickActions={[
          {
            label: "What should I bring?",
            message: `I've asked to pick up ${dog.name} on ${pickupDateLabel} at ${foster.pickup.time}. What should I bring?`,
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
