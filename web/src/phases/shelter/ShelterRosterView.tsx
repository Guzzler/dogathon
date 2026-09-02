import { useMemo, useState } from "react";
import { useMyShelters } from "../../hooks/useStaffShelters";
import { useShelterDogs } from "../../hooks/useShelterDogs";
import { addShelterDog, relistDog, retireDog } from "../../lib/shelterRoster";
import { normalizeDog, dogPhotoOrNull } from "../../lib/dog";
import {
  DOG_STATUS_LABELS,
  EMPTY_DOG_FORM,
  rosterAction,
  validateDogForm,
  type DogFormValues,
  type TriState,
} from "../../lib/shelterDog";
import type { Dog, DogSize } from "../../types";

/**
 * The shelter's own roster (RS-6) -- M3's "second source adapter". A staff member adds a dog
 * by hand into exactly the shape `scripts/shelters/sfspca.py`'s `to_dog()` produces, so a
 * typed dog and a scraped one are indistinguishable everywhere downstream, and retires one
 * without deleting anything.
 *
 * `shelter_id` is never typed: it comes from the shelter this staff member actually belongs
 * to. `firestore.rules` refuses anything else besides, but the form shouldn't offer a field
 * whose only use would be to attempt that.
 */
export function ShelterRosterView() {
  const shelters = useMyShelters();
  const [shelterId, setShelterId] = useState<string | null>(shelters[0]?.id ?? null);
  const active = shelters.find((s) => s.id === shelterId) ?? shelters[0];
  const { result, retry } = useShelterDogs(active?.id ?? null);
  const [adding, setAdding] = useState(false);

  const dogs = result.state === "ready" ? result.dogs : [];
  const listed = dogs.filter((d) => d.status === "available");
  const rest = dogs.filter((d) => d.status !== "available");

  return (
    <div className="screen shelter__home">
      <header className="pad shelter__header">
        <h1>Our dogs</h1>
        <p className="muted">
          {active ? active.name : "No shelter"}
          {result.state === "ready" ? ` · ${listed.length} listed, ${rest.length} not listed` : ""}
        </p>
        {shelters.length > 1 && (
          <div className="shelter__switch">
            {shelters.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`shelter__chip${s.id === active?.id ? " is-on" : ""}`}
                onClick={() => setShelterId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {result.state === "loading" && (
        <div className="pad shelter__state">
          <p className="muted">Loading your roster…</p>
        </div>
      )}

      {result.state === "error" && (
        <div className="pad shelter__state">
          <h2>Couldn&rsquo;t load your roster.</h2>
          <p className="sub">
            {result.code === "permission-denied"
              ? "Your account isn't authorised to read this shelter's dogs."
              : "Something went wrong reaching the database. Check your connection and try again."}
          </p>
          <button type="button" className="btn outline" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {result.state === "ready" && active && (
        <div className="pad shelter__roster">
          {adding ? (
            <AddDogForm shelterId={active.id} onDone={() => setAdding(false)} />
          ) : (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              Add a dog
            </button>
          )}

          {dogs.length === 0 && (
            <div className="shelter__state">
              <h2>No dogs on your roster yet.</h2>
              {/* A shelter whose dogs came from the scrape sees them here too -- an empty list
                  means this shelter has no records at all, which is a normal day one. */}
              <p className="sub">Dogs you add here show up for fosters in Discovery straight away.</p>
            </div>
          )}

          {listed.length > 0 && (
            <section>
              <h2 className="shelter__section">Listed</h2>
              <DogRows dogs={listed} />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <h2 className="shelter__section">Not listed</h2>
              <DogRows dogs={rest} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DogRows({ dogs }: { dogs: Dog[] }) {
  return (
    <ul className="shelter__list">
      {dogs.map((dog) => (
        <li key={dog.id}>
          <DogRow dog={dog} />
        </li>
      ))}
    </ul>
  );
}

function DogRow({ dog }: { dog: Dog }) {
  const rich = useMemo(() => normalizeDog(dog), [dog]);
  const photo = dogPhotoOrNull(rich, 200, 200);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const action = rosterAction(dog.status);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await work();
    } catch {
      // The live subscription puts the row back the way the database has it; all this needs
      // to say is that the write didn't land.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shelter__dog">
      {/* Never the placedog stand-in for a hand-entered dog -- see dogPhotoOrNull(). A blank
          tile reads as "no photo yet"; a stock photo of another animal reads as this dog. */}
      {photo ? (
        <div className="shelter__dog-photo" style={{ backgroundImage: `url(${photo})` }} />
      ) : (
        <div className="shelter__dog-photo is-empty" aria-hidden="true">
          🐾
        </div>
      )}
      <div className="shelter__dog-main">
        <strong>{dog.name}</strong>
        <span className="muted">
          {dog.breed} · {rich.ageLabel}
        </span>
        <span className="shelter__pill shelter__pill--dog">{DOG_STATUS_LABELS[dog.status]}</span>
        {failed && <span className="shelter__failed">That didn&rsquo;t save. Try again.</span>}
      </div>
      {action === "retire" && (
        <button type="button" className="btn outline" disabled={busy} onClick={() => run(() => retireDog(dog.id))}>
          Retire
        </button>
      )}
      {action === "relist" && (
        <button type="button" className="btn outline" disabled={busy} onClick={() => run(() => relistDog(dog.id))}>
          List again
        </button>
      )}
    </div>
  );
}

const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: "unknown", label: "Not tested" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function AddDogForm({ shelterId, onDone }: { shelterId: string; onDone: () => void }) {
  const [values, setValues] = useState<DogFormValues>(EMPTY_DOG_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const set = <K extends keyof DogFormValues>(key: K, value: DogFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateDogForm(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailed(null);
    try {
      await addShelterDog(values, shelterId);
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Couldn't save that dog. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="shelter__form" onSubmit={submit} noValidate>
      <h2 className="shelter__section">Add a dog</h2>
      {/* Said out loud, because it's the difference between this surface and a spreadsheet:
          anything left blank stays blank on the dog's profile rather than being guessed at. */}
      <p className="muted">
        Only what you actually know. Anything left blank shows as &ldquo;not recorded&rdquo; rather than
        being filled in for you.
      </p>

      <Field label="Name" error={errors.name}>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
      </Field>
      <Field label="Breed" error={errors.breed}>
        <input
          value={values.breed}
          onChange={(e) => set("breed", e.target.value)}
          placeholder="Mixed breed"
          maxLength={80}
        />
      </Field>

      <div className="shelter__form-row">
        <Field label="Age (years)" error={errors.ageYears}>
          <input inputMode="decimal" value={values.ageYears} onChange={(e) => set("ageYears", e.target.value)} />
        </Field>
        <Field label="Weight (lbs)" error={errors.weightLbs} hint="Optional">
          <input inputMode="decimal" value={values.weightLbs} onChange={(e) => set("weightLbs", e.target.value)} />
        </Field>
        <Field label="Size" error={errors.size} hint="Derived from weight if blank">
          <select value={values.size} onChange={(e) => set("size", e.target.value as "" | DogSize)}>
            <option value="">—</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </Field>
      </div>

      <div className="shelter__form-row">
        <Field label="Energy" error={errors.energy} hint="0 couch potato – 4 zoomies">
          <select value={values.energy} onChange={(e) => set("energy", e.target.value)}>
            <option value="">Not recorded</option>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected foster stay" error={errors.fosterWeeks} hint="Weeks, 1–16">
          <input inputMode="numeric" value={values.fosterWeeks} onChange={(e) => set("fosterWeeks", e.target.value)} />
        </Field>
      </div>

      <div className="shelter__form-row">
        <Tri label="Good with kids" value={values.goodWithKids} onChange={(v) => set("goodWithKids", v)} />
        <Tri label="Good with dogs" value={values.goodWithDogs} onChange={(v) => set("goodWithDogs", v)} />
        <Tri label="Good with cats" value={values.goodWithCats} onChange={(v) => set("goodWithCats", v)} />
      </div>

      <Field label="Photo link" error={errors.photoUrl} hint="An https:// link to a photo. Blank is fine.">
        <input
          value={values.photoUrl}
          onChange={(e) => set("photoUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <Field label="Write-up" error={errors.notes} hint="What a foster should know about them.">
        <textarea rows={4} value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={600} />
      </Field>

      {failed && <p className="shelter__failed">{failed}</p>}

      <div className="shelter__actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : "Add to roster"}
        </button>
        <button type="button" className="btn outline" disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`shelter__field${error ? " has-error" : ""}`}>
      <span className="shelter__label">{label}</span>
      {children}
      {error ? <span className="shelter__error">{error}</span> : hint ? <span className="muted">{hint}</span> : null}
    </label>
  );
}

function Tri({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as TriState)}>
        {TRI_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
