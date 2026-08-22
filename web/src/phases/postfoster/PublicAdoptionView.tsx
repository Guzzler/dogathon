import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useDogs } from "../../hooks/useDogs";
import { useFoster } from "../../hooks/useFoster";
import { useCareScheduleBlocks, useJournalEntries } from "../../hooks/useJournal";
import { daysSincePickup } from "../careplan/data";
import { buildAdoptionProfile } from "../../lib/adoption";
import { normalizeDog } from "../../lib/dog";
import { PawMark, Wordmark } from "../../components/Logo";
import { AdoptionProfileBody as AdoptionBody } from "./AdoptionProfile";

/**
 * The shared link. Read-only, no foster controls, and deliberately outside the onboarding
 * gate so someone who's never used Pawthway can open it.
 */
export function PublicAdoptionView() {
  const { id = "" } = useParams();
  const { dogs, loading } = useDogs();
  const { foster } = useFoster();
  const journal = useJournalEntries();
  const schedule = useCareScheduleBlocks();

  // A shared link should show what the foster logged, not empty states — but only when this
  // dog is actually the one they fostered.
  const isTheirFoster = foster?.matchedDogId === id;

  const raw = dogs.find((d) => d.id === id);
  const dog = useMemo(() => (raw ? normalizeDog(raw) : null), [raw]);
  const profile = useMemo(
    () => (dog
      ? buildAdoptionProfile(dog, isTheirFoster ? foster : null, [],
          isTheirFoster ? journal : [], isTheirFoster ? schedule : [],
          daysSincePickup(foster?.pickup?.date ?? ""))
      : null),
    [dog, foster, journal, schedule, isTheirFoster],
  );

  if (loading) return <p className="pw-loading">Loading…</p>;
  if (!dog || !profile) {
    return (
      <div className="pw-page pw-page--narrow">
        <h1>Profile not found</h1>
        <p className="pw-muted">This adoption page may have been taken down.</p>
      </div>
    );
  }

  return (
    <div className="pw-page">
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <PawMark size={24} />
        <Wordmark size={18} />
        <span className="sp" />
        <span className="chip" style={{ fontWeight: 800, fontSize: 11.5 }}>Adoption profile</span>
      </div>

      <AdoptionBody dog={dog} profile={profile}
        tags={isTheirFoster ? foster?.adoptionHighlights?.tags ?? [] : []}
        summary={isTheirFoster ? foster?.adoptionHighlights?.summary ?? "" : ""} />

      <div className="card" style={{ marginTop: 22, padding: 17, textAlign: "center" }}>
        <p className="sub" style={{ fontSize: 14 }}>
          Interested in fostering a dog like {dog.name}?
        </p>
        <Link className="btn btn--primary" style={{ marginTop: 12 }} to="/">Explore Pawthway</Link>
      </div>
    </div>
  );
}
