import { useMemo, useState } from "react";
import { useMyShelters } from "../../hooks/useStaffShelters";
import { useShelterApplications } from "../../hooks/useShelterApplications";
import { useDogs } from "../../hooks/useDogs";
import {
  PICKUP_NOTE_MAX,
  askForAnotherTime,
  setApplicationChecklist,
  setApplicationStatus,
  setPickupConfirmed,
  type HandoffDog,
} from "../../lib/applications";
import { relistDog } from "../../lib/shelterRoster";
import { DOG_STATUS_LABELS } from "../../lib/shelterDog";
import {
  STATUS_LABELS,
  applicationAge,
  canConfirmPickup,
  createdAtMillis,
  inboxError,
  isActionable,
  isLive,
  pickupHolder,
  pickupAskedToMove,
  pickupAwaitingShelter,
  splitByOwner,
  staffTransitions,
  withdrawnAfterHandoff,
} from "../../lib/applicationView";
import type { Application, ApplicationStatus, ChecklistItem, Dog } from "../../types";

/**
 * The shelter's application inbox (RS-5) -- the first surface on the shelter side that does
 * work rather than proving access.
 *
 * Master/detail in one route: a list of applications, and the selected one's checklist and
 * status controls beside it on a wide screen, below it on a narrow one. Staff tick the
 * `owner: "shelter"` steps here; the foster's own steps render read-only, because they live
 * on the foster's own document and this screen deliberately never writes there -- joining the
 * two copies by owner is RS-10.
 */
export function ShelterApplicationsView() {
  const shelters = useMyShelters();
  const [shelterId, setShelterId] = useState<string | null>(shelters[0]?.id ?? null);
  const active = shelters.find((s) => s.id === shelterId) ?? shelters[0];
  const { result, retry } = useShelterApplications(active?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applications = result.state === "ready" ? result.applications : [];
  // Falls back to the first row rather than trusting a stored selection: the list is a live
  // subscription, so the selected document can disappear out from under us.
  const selected = applications.find((a) => a.id === selectedId) ?? applications[0] ?? null;

  return (
    <div className="screen shelter__home">
      <header className="pad shelter__header">
        <h1>Applications</h1>
        <p className="muted">
          {active ? active.name : "No shelter"}
          {result.state === "ready" && applications.length > 0
            ? ` · ${applications.length} application${applications.length === 1 ? "" : "s"}`
            : ""}
        </p>
        {shelters.length > 1 && (
          <div className="shelter__switch">
            {shelters.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`shelter__chip${s.id === active?.id ? " is-on" : ""}`}
                onClick={() => {
                  setShelterId(s.id);
                  setSelectedId(null);
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {result.state === "loading" && (
        <div className="pad shelter__state">
          <p className="muted">Loading applications…</p>
        </div>
      )}

      {result.state === "error" && <InboxErrorState code={result.code} onRetry={retry} />}

      {result.state === "ready" && applications.length === 0 && (
        <div className="pad shelter__state">
          <h2>No applications yet.</h2>
          {/* An empty inbox is the expected state for a real shelter on day one, so it reads
              as a normal screen rather than as something that failed. */}
          <p className="sub">
            When someone applies to foster one of your dogs, their application shows up here.
          </p>
        </div>
      )}

      {result.state === "ready" && applications.length > 0 && (
        <div className="pad shelter__split">
          <ApplicationList
            applications={applications}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
          {selected && (
            <ApplicationDetail application={selected} applications={applications} onSelect={setSelectedId} />
          )}
        </div>
      )}
    </div>
  );
}

function InboxErrorState({ code, onRetry }: { code: string | undefined; onRetry: () => void }) {
  const copy = inboxError(code);
  return (
    <div className="pad shelter__state">
      <h2>{copy.title}</h2>
      <p className="sub">{copy.body}</p>
      {copy.retryable && (
        <button type="button" className="btn outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * A dog can legitimately be missing: the roster import replaces rather than appends, so an
 * application can outlive the listing it was opened against. Fall back to the id, which is at
 * least something staff can search for, rather than rendering an empty name.
 *
 * Returns the dog too (RS-17): the inbox's answers carry its status so a confirmed pickup can
 * take it off the roster in the same write. A missing dog is `null`, and the answer is then the
 * plain application update it always was.
 */
function useApplicationDog(dogId: string): { name: string; dog: Dog | null } {
  const { dogs } = useDogs();
  return useMemo(() => {
    const dog = dogs.find((d) => d.id === dogId) ?? null;
    return { name: dog?.name ?? dogId, dog };
  }, [dogs, dogId]);
}

function DogName({ dogId }: { dogId: string }) {
  return <>{useApplicationDog(dogId).name}</>;
}

const handoffDog = (dog: Dog | null): HandoffDog | null => (dog ? { id: dog.id, status: dog.status } : null);

function StatusPill({ status }: { status: ApplicationStatus }) {
  return <span className={`shelter__pill shelter__pill--${status}`}>{STATUS_LABELS[status]}</span>;
}

function ApplicationList({
  applications,
  selectedId,
  onSelect,
}: {
  applications: Application[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Read once when the list mounts rather than on every render: `Date.now()` during render is
  // an impure call, and an age that reads "3 days ago" does not need to tick.
  const [now] = useState(() => Date.now());
  return (
    <ul className="shelter__list">
      {applications.map((app) => (
        <li key={app.id}>
          <button
            type="button"
            className={`shelter__row${app.id === selectedId ? " is-on" : ""}`}
            onClick={() => onSelect(app.id)}
          >
            <span className="shelter__row-main">
              {/* fosterName is denormalised onto the application for exactly this, and reads
                  "(deleted account)" once PH-15's redaction has run -- a real state, rendered
                  as it is rather than hidden. */}
              <strong>{app.fosterName}</strong>
              <span className="muted">
                <DogName dogId={app.dogId} />
              </span>
            </span>
            <span className="shelter__row-meta">
              <StatusPill status={app.status} />
              {/* RS-18: the dog went home with another foster, so this row is waiting on an
                  answer that can't be "confirm". It replaces the pickup pills -- "Pickup
                  requested" would invite the one action this application no longer has -- and is
                  a state about the dog, not an alarm. */}
              {isLive(app.status) && pickupHolder(app, applications) ? (
                <span className="shelter__pill shelter__pill--dog">Dog placed with another foster</span>
              ) : (
                <>
                  {/* RS-14: the one pickup state that is waiting on the shelter. */}
                  {pickupAwaitingShelter(app) && (
                    <span className="shelter__pill shelter__pill--pickup">Pickup requested</span>
                  )}
                  {/* RS-15: answered, but not agreed -- the foster's move, so it wears no alarm. */}
                  {pickupAskedToMove(app) && (
                    <span className="shelter__pill shelter__pill--pickup-moved">Asked for another time</span>
                  )}
                </>
              )}
              <span className="muted">{applicationAge(createdAtMillis(app), now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ApplicationDetail({ application, applications, onSelect }: {
  application: Application;
  applications: Application[];
  onSelect: (id: string) => void;
}) {
  const { name: dogName, dog } = useApplicationDog(application.dogId);
  // RS-18: another live application on this dog already holds a confirmed pickup.
  const holder = isLive(application.status) ? pickupHolder(application, applications) : null;
  // Whether this application holds the confirmation an answer would take back -- what decides
  // if declining it relists the dog (`handoffStatus`'s `confirmedHere`).
  const wasConfirmed = Boolean(application.pickupConfirmedAt);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const checklist = application.checklist ?? [];
  const { shelter, foster } = splitByOwner(checklist);
  const actionable = isActionable(application.status);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await work();
    } catch {
      // The live subscription reverts the optimistic render on its own; all this needs to do
      // is say the write didn't land, rather than leaving a tick that silently undid itself.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (item: ChecklistItem) =>
    run(() =>
      setApplicationChecklist(
        application.id,
        checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
      ),
    );

  return (
    <section className="shelter__detail">
      <div className="shelter__detail-head">
        <h2>{application.fosterName}</h2>
        <p className="muted">
          Applied to foster {dogName} · <StatusPill status={application.status} />
        </p>
      </div>

      <h3>Your steps</h3>
      {shelter.length === 0 ? (
        <p className="muted">This application has no shelter-owned steps.</p>
      ) : (
        <ul className="shelter__checks">
          {shelter.map((item) => (
            <li key={item.id}>
              <label className="shelter__check">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={busy || !actionable}
                  onChange={() => toggle(item)}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <h3>The foster&rsquo;s steps</h3>
      {/* Read-only, and said out loud: these live on the foster's own document, which this
          screen neither reads nor writes. Until RS-10 joins the two copies by owner, what
          shows here is the application's copy, which the foster's own ticks don't reach. */}
      <p className="muted">Tracked on the foster&rsquo;s side &mdash; shown here for context.</p>
      <ul className="shelter__checks">
        {foster.map((item) => (
          <li key={item.id}>
            <span className="shelter__check is-locked">
              <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
              <span>{item.label}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3>Pickup</h3>
      {holder && (
        <p className="shelter__handoff-note">
          {dogName} is going home with{" "}
          <button type="button" className="shelter__link" onClick={() => onSelect(holder.id)}>
            {holder.fosterName}
          </button>
          . Decline this application, or take that confirmation back first.
        </p>
      )}
      <PickupSection application={application} dog={dog} dogName={dogName} held={Boolean(holder)} busy={busy} run={run} />

      <h3>Status</h3>
      {actionable ? (
        <div className="shelter__actions">
          {staffTransitions(application.status).map((next) => (
            <button
              key={next}
              type="button"
              // Approving is the decision this screen exists to make, so it carries the
              // primary weight; declining is deliberate but quiet, and "in review" is
              // bookkeeping. Three identical buttons made all three look equally routine.
              className={`btn ${next === "approved" ? "" : "outline"} shelter__action--${next}`}
              disabled={busy}
              onClick={() => run(() => setApplicationStatus(application.id, next, handoffDog(dog), wasConfirmed))}
            >
              Mark {STATUS_LABELS[next].toLowerCase()}
            </button>
          ))}
        </div>
      ) : (
        // withdrawn is the foster's to set (the foster branch of applications' update rule),
        // so there is nothing here for a shelter to do -- and a button would only fail the write.
        <p className="muted">This application was withdrawn by the foster.</p>
      )}

      {/* RS-17. The foster can undo a confirmed handoff by withdrawing, but can't write the dog,
          so the one party who can is told -- here, on the record that explains why. */}
      {withdrawnAfterHandoff(application, dog?.status) && (
        <div className="shelter__notice">
          <p>
            {application.fosterName} withdrew after pickup was confirmed; {dogName} is still marked in
            foster.
          </p>
          <button
            type="button"
            className="btn outline"
            disabled={busy}
            onClick={() => run(() => relistDog(application.dogId))}
          >
            List again
          </button>
        </div>
      )}

      {failed && (
        <p className="shelter__failed">That didn&rsquo;t save. Check your connection and try again.</p>
      )}
    </section>
  );
}

/**
 * RS-14. The foster's requested slot, and the only place it can be answered. Before this the
 * request was written only to the foster's own document, which no shelter can read, so every
 * "pickup requested" was a promise with no addressee.
 *
 * Confirming stamps `pickupConfirmedAt`; the foster's Match screen reads it back and says
 * "confirmed" only while the slot it holds still matches this one. If the foster changes the
 * request, their write clears the stamp and the row asks again -- nobody here has to notice.
 *
 * RS-15 gave the shelter its second answer, **Ask for another time**: before it, a shelter that
 * couldn't make the slot could only stay silent. It stamps `pickupDeclinedAt` with an optional
 * note the foster sees attributed to this shelter, and leaves the slot as it is so they can see
 * which one. There is no counter-slot picker on purpose -- a second writer of `pickup` is the
 * drift RS-14 designed out -- so a better time goes in the note, in words.
 */
function PickupSection({ application, dog, dogName, held, busy, run }: {
  application: Application;
  dog: Dog | null;
  dogName: string;
  /** RS-18: another application on this dog holds the confirmation, so this one can't take it. */
  held: boolean;
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const pickup = application.pickup;
  if (!pickup) return <p className="muted">No pickup requested yet.</p>;

  const date = new Date(pickup.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const confirmed = Boolean(application.pickupConfirmedAt);
  const declined = !confirmed && Boolean(application.pickupDeclinedAt);
  const handoff = handoffDog(dog);

  const sendAsk = () =>
    run(async () => {
      await askForAnotherTime(application.id, note, handoff, confirmed);
      setAsking(false);
      setNote("");
    });

  return (
    <div className="shelter__pickup">
      <p>
        <strong>{date}</strong> · {pickup.time}
        <span className="muted"> · {pickup.location}</span>
      </p>
      <p className="muted">
        {confirmed
          ? "You confirmed this time. The foster sees it as confirmed."
          : declined
            ? "You asked the foster for another time. Their new request shows here when they pick one."
            : "The foster asked for this time. Nothing is booked until you confirm it."}
      </p>
      {declined && application.pickupNote && (
        <p className="shelter__pickup-note">&ldquo;{application.pickupNote}&rdquo;</p>
      )}
      {/* RS-17: confirming moves only an `available` dog. Anything else is a decision staff made
          earlier, and the button must not read as though it overrules it. A dog held by another
          application (RS-18) is the one case where there is no button to overrule anything with,
          so the line above the section says what to do instead. */}
      {canConfirmPickup(application) && !confirmed && !held && dog && dog.status !== "available" && (
        <p className="muted shelter__handoff-note">
          {dogName} is marked {DOG_STATUS_LABELS[dog.status].toLowerCase()} &mdash; confirming won&rsquo;t change that.
        </p>
      )}
      {canConfirmPickup(application) && (
        asking ? (
          <div className="shelter__form">
            <label className="shelter__field">
              <span className="shelter__label">Note to the foster (optional)</span>
              <textarea
                rows={3}
                maxLength={PICKUP_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. We're short-staffed that Saturday. Any weekday afternoon works."
              />
              <span className="muted">
                They see this word for word, signed as your shelter. {PICKUP_NOTE_MAX - note.length} characters left.
              </span>
            </label>
            <div className="shelter__actions">
              <button type="button" className="btn" disabled={busy} onClick={sendAsk}>
                Send
              </button>
              <button type="button" className="btn outline" disabled={busy} onClick={() => setAsking(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="shelter__actions">
            {confirmed ? (
              <button
                type="button"
                className="btn outline"
                disabled={busy}
                onClick={() => run(() => setPickupConfirmed(application.id, false, handoff, confirmed))}
              >
                Undo confirmation
              </button>
            ) : held ? null : (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => run(() => setPickupConfirmed(application.id, true, handoff))}
              >
                Confirm pickup
              </button>
            )}
            {!declined && (
              <button type="button" className="btn outline" disabled={busy} onClick={() => setAsking(true)}>
                Ask for another time
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
