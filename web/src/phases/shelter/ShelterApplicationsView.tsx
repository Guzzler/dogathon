import { useMemo, useState } from "react";
import { useMyShelters } from "../../hooks/useStaffShelters";
import { useShelterApplications } from "../../hooks/useShelterApplications";
import { useDogs } from "../../hooks/useDogs";
import { setApplicationChecklist, setApplicationStatus } from "../../lib/applications";
import {
  STATUS_LABELS,
  applicationAge,
  createdAtMillis,
  inboxError,
  isActionable,
  splitByOwner,
  staffTransitions,
} from "../../lib/applicationView";
import type { Application, ApplicationStatus, ChecklistItem } from "../../types";

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
          {selected && <ApplicationDetail application={selected} />}
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
 */
function useDogName(dogId: string): string {
  const { dogs } = useDogs();
  return useMemo(() => dogs.find((d) => d.id === dogId)?.name ?? dogId, [dogs, dogId]);
}

function DogName({ dogId }: { dogId: string }) {
  return <>{useDogName(dogId)}</>;
}

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
              <span className="muted">{applicationAge(createdAtMillis(app), now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ApplicationDetail({ application }: { application: Application }) {
  const dogName = useDogName(application.dogId);
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

      <h3>Status</h3>
      {actionable ? (
        <div className="shelter__actions">
          {staffTransitions(application.status).map((next) => (
            <button
              key={next}
              type="button"
              className="btn outline"
              disabled={busy}
              onClick={() => run(() => setApplicationStatus(application.id, next))}
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

      {failed && (
        <p className="shelter__failed">That didn&rsquo;t save. Check your connection and try again.</p>
      )}
    </section>
  );
}
