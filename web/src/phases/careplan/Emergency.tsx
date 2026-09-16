import type { DogProfile, EmergencyContact, MedicalSummary } from "./types";

/**
 * The screen a foster opens when something is wrong, and therefore the screen with the least
 * room for a plausible guess (PH-18).
 *
 * What used to be here: a hand-drawn SVG street map labelled "Presidio Park" and "Bay", with a
 * blue route, a "You" dot and a chip reading "1.2 mi · 4 min" — a picture of nowhere, with a
 * travel time nobody computed — above a headline card for a 24-hour vet whose distance and
 * "Open now" were fixed constants. All of it is gone rather than relabelled: a map that is not
 * of where you are cannot be captioned into honesty.
 *
 * What is left either came from the shelter's own record (the dog, its weight, its shelter) or
 * is true for every caller in the country (the two poison lines). Nothing on this screen is
 * derived from a location the app does not know.
 */

interface EmergencyProps {
  dog: DogProfile;
  /**
   * Absent unless the app actually holds a medical record for this dog. A vaccination list
   * and "Allergies: None reported" that came from a template are claims about a specific
   * animal, on the screen someone opens when something is wrong.
   */
  summary?: MedicalSummary;
  contacts: EmergencyContact[];
}

function telHref(phone: string) {
  return `tel:${phone.replace(/\D/g, "")}`;
}

export function Emergency({ dog, summary, contacts }: EmergencyProps) {
  // Categories the data states, not substrings of display copy. The old
  // `contacts.find((c) => c.distanceMi != null) ?? contacts[0]` meant that deleting the one
  // invented vet row would have promoted Pet Poison Helpline into a card headed "Nearest
  // 24-hour vet" with a *Call Vet Now* button — the fallback biting precisely because the two
  // honest rows are the ones that survive.
  const nearest = contacts.find((c) => c.kind === "vet");
  const poison = contacts.filter((c) => c.kind === "poison");
  const other = contacts.filter((c) => c !== nearest && !poison.includes(c));

  return (
    <div className="cp-emergency">
      <header className="cp-phase-banner cp-phase-banner--danger">
        <p className="cp-eyebrow">
          {dog.name}
          {dog.weightLbs != null && ` · ${dog.weightLbs} lbs`}
        </p>
        <h2 className="cp-phase-name">Emergency</h2>
        <p className="cp-banner-meta">
          Poison control, {dog.name}'s record, and who to tell — ready to read out.
        </p>
      </header>

      {nearest ? (
        <section className="cp-emergency-nearest-card">
          <div className="cp-emergency-nearest">
            <p className="cp-eyebrow">Nearest 24-hour vet</p>
            <h3 className="cp-emergency-nearest__name">{nearest.name}</h3>
            <p className="cp-mini-meta">
              {nearest.distanceMi != null ? `${nearest.distanceMi} mi away` : "Distance unknown"}
              {nearest.hours ? ` · ${nearest.hours}` : ""}
            </p>
          </div>
          <a className="cp-btn cp-btn--danger cp-btn--full" href={telHref(nearest.phone)}>
            Call Vet Now — {nearest.phone}
          </a>
        </section>
      ) : (
        <section className="cp-card">
          <h3 className="cp-card__title">No 24-hour vet on file</h3>
          <p className="cp-mini-meta">
            Pawthway doesn't know where you are, so it can't tell you which emergency clinic is
            closest. Search for a 24-hour animal hospital near you, and keep the poison lines
            below to hand — those answer from anywhere.
          </p>
        </section>
      )}

      <section className="cp-card">
        <h3 className="cp-card__title">{dog.name}'s medical summary</h3>
        <dl className="cp-med-summary">
          <div>
            <dt>Vaccines</dt>
            <dd>{summary ? summary.vaccines.join(" · ") : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Allergies</dt>
            <dd>{summary ? summary.allergies.join(" · ") : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Medications</dt>
            <dd>{summary ? summary.medications.join(" · ") : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>
              {dog.weightLbs != null ? `${dog.weightLbs} lbs` : "Not recorded"} · {dog.breed},{" "}
              {dog.ageMonths} mo
            </dd>
          </div>
        </dl>
      </section>

      {poison.length > 0 && (
        <section className="cp-emergency-actions">
          {poison.map((c) => (
            <a key={c.name} className="cp-emergency-action" href={telHref(c.phone)}>
              <strong>{c.name}</strong>
              <span className="cp-mini-meta">
                {c.phone}
                {c.hours ? ` · ${c.hours}` : ""}
              </span>
            </a>
          ))}
        </section>
      )}

      {dog.shelter && (
        <section className="cp-card">
          <h3 className="cp-card__title">Who else to tell</h3>
          {/* No call action, deliberately. A `Shelter` is {id, name, short, address, lat, lng}
              and nothing in this app holds a shelter phone number; adding the field would mean
              filling it, which is the defect this screen was cleaned of. The address is real. */}
          <p className="cp-contact-name">{dog.shelter.name}</p>
          <p className="cp-mini-meta">
            {dog.shelter.address} · {dog.name} is their dog — tell them what happened once{" "}
            {dog.name} is safe.
          </p>
        </section>
      )}

      {other.length > 0 && (
        <section className="cp-card">
          <h3 className="cp-card__title">Other contacts</h3>
          <ul className="cp-contact-list">
            {other.map((c) => (
              <li key={c.name} className="cp-contact-item">
                <div>
                  <p className="cp-contact-name">{c.name}</p>
                  <p className="cp-mini-meta">{c.role}{c.hours ? ` · ${c.hours}` : ""}</p>
                </div>
                <a className="cp-btn cp-btn--ghost" href={telHref(c.phone)}>{c.phone}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
