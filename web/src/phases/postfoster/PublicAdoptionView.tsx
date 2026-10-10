import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useDogs } from "../../hooks/useDogs";
import { useFoster } from "../../hooks/useFoster";
import { useCareLog } from "../../hooks/useCareLog";
import { useCareScheduleBlocks, useJournalEntries } from "../../hooks/useJournal";
import { daysSincePickup } from "../careplan/data";
import { buildAdoptionProfile, withPublished, type AdoptionProfile } from "../../lib/adoption";
import { usePublishedProfile } from "../../lib/adoptionProfiles";
import { LOCAL_MODE } from "../../lib/localMode";
import { normalizeDog, type RichDog } from "../../lib/dog";
import { PawMark, Wordmark } from "../../components/Logo";
import { AdoptionProfileBody as AdoptionBody } from "./AdoptionProfile";

/**
 * The shared link. Read-only, no foster controls, and deliberately outside the onboarding
 * gate so someone who's never used Pawthway can open it.
 *
 * PH-32: it shows what the foster **published** to `adoptionProfiles/{dogId}`, laid over the
 * shelter's live record -- for everyone, the sender included, so the one person able to notice
 * an empty page sees exactly what the reader sees. It used to read the *viewer's* own foster
 * document, which only the sender could do: every recipient saw empty states that read as
 * nothing happened, and the sender saw a full page and had no way to know.
 *
 * `LOCAL_MODE` has no shared backend to publish to and no stranger to share with (the data is in
 * this browser's localStorage), so it keeps the own-data page it always had.
 */
export function PublicAdoptionView() {
  return LOCAL_MODE ? <LocalAdoptionView /> : <PublishedAdoptionView />;
}

function PublishedAdoptionView() {
  const { id = "" } = useParams();
  const { dogs, loading } = useDogs();
  const { published, loading: publishedLoading } = usePublishedProfile(id);

  const raw = dogs.find((d) => d.id === id);
  const dog = useMemo(() => (raw ? normalizeDog(raw) : null), [raw]);
  const profile = useMemo(
    () => (dog ? withPublished(buildAdoptionProfile(dog, null, [], [], []), published) : null),
    [dog, published],
  );

  if (loading || publishedLoading) return <p className="pw-loading">Loading…</p>;
  return (
    <PublicPage dog={dog} profile={profile}
      tags={published?.tags ?? []} summary={published?.summary ?? ""} />
  );
}

function LocalAdoptionView() {
  const { id = "" } = useParams();
  const { dogs, loading } = useDogs();
  const { foster } = useFoster();
  const { entries } = useCareLog();
  const journal = useJournalEntries();
  const schedule = useCareScheduleBlocks();
  const isTheirFoster = foster?.matchedDogId === id;

  const raw = dogs.find((d) => d.id === id);
  const dog = useMemo(() => (raw ? normalizeDog(raw) : null), [raw]);
  const profile = useMemo(
    () => (dog
      ? buildAdoptionProfile(dog, isTheirFoster ? foster : null, isTheirFoster ? entries : [],
          isTheirFoster ? journal : [], isTheirFoster ? schedule : [],
          daysSincePickup(foster?.pickup?.date ?? ""))
      : null),
    [dog, foster, entries, journal, schedule, isTheirFoster],
  );

  if (loading) return <p className="pw-loading">Loading…</p>;
  return (
    <PublicPage dog={dog} profile={profile}
      tags={isTheirFoster ? foster?.adoptionHighlights?.tags ?? [] : []}
      summary={isTheirFoster ? foster?.adoptionHighlights?.summary ?? "" : ""} />
  );
}

function PublicPage({ dog, profile, tags, summary }: {
  dog: RichDog | null; profile: AdoptionProfile | null; tags: string[]; summary: string;
}) {
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

      <AdoptionBody dog={dog} profile={profile} tags={tags} summary={summary} audience="reader" />

      <div className="card" style={{ marginTop: 22, padding: 17, textAlign: "center" }}>
        <p className="sub" style={{ fontSize: 14 }}>
          Interested in fostering a dog like {dog.name}?
        </p>
        <Link className="btn btn--primary" style={{ marginTop: 12 }} to="/">Explore Pawthway</Link>
      </div>
    </div>
  );
}
