import { patchFoster, useFoster } from "../../hooks/useFoster";
import { useDogs } from "../../hooks/useDogs";
import { AgentChatPanel } from "../../components/AgentChatPanel";

export function PostFosterView() {
  const { foster, loading } = useFoster();
  const { dogs } = useDogs();

  const dog = dogs.find((d) => d.id === foster?.matchedDogId);

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!foster || !foster.matchedDogId) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>No foster journey yet</h1>
        <p className="pw-muted">Match with a dog and finish the Care Plan first.</p>
      </div>
    );
  }

  async function markComplete() {
    await patchFoster({ phase: "complete" });
  }

  return (
    <div className="pw-page">
      <h1>Send {dog?.name ?? "your foster"} home adoption-ready</h1>
      <p className="pw-subtitle">
        Ask the agent to draft an adoption profile from the care log, then approve sending it to the shelter.
      </p>

      {foster.readyForAdoption && (
        <div className="pw-banner pw-banner--success">
          🎉 {dog?.name ?? "This dog"}'s adoption profile is with the shelter. Thank you for fostering!
        </div>
      )}

      <div className="care-tips-drawer">
        <AgentChatPanel
          placeholder="e.g. send the adoption profile to the shelter"
          emptyState="Ask the agent to draft an adoption profile from the weigh-ins, notes, and photos you've logged -- then approve sending it to the shelter."
          quickActions={[
            {
              label: "Draft adoption profile",
              message: `Generate an adoption profile for ${dog?.name ?? "my foster dog"} using their care log, and show me the draft.`,
            },
            {
              label: "Send to shelter",
              message: `Send ${dog?.name ?? "my foster dog"}'s adoption profile to the shelter now.`,
            },
          ]}
        />
      </div>

      {!foster.readyForAdoption && (
        <button className="btn btn--ghost" onClick={markComplete}>
          Mark journey complete
        </button>
      )}
    </div>
  );
}
