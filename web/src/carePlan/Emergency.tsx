import type { DogProfile, EmergencyContact, MedicalSummary } from "./types";

interface EmergencyProps {
  dog: DogProfile;
  summary: MedicalSummary;
  contacts: EmergencyContact[];
}

function VetMap({ nearest }: { nearest?: EmergencyContact }) {
  return (
    <svg className="cp-map" viewBox="0 0 320 160" role="img" aria-label="Nearest vet map">
      <defs>
        <pattern id="cp-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(45,90,61,0.08)" strokeWidth="1" />
        </pattern>
        <linearGradient id="cp-road" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(196,149,90,0.25)" />
          <stop offset="1" stopColor="rgba(45,90,61,0.25)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="160" fill="#f4efe4" />
      <rect x="0" y="0" width="320" height="160" fill="url(#cp-grid)" />
      <path d="M 60 130 Q 160 60 260 40" stroke="url(#cp-road)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="6 8" />

      <g transform="translate(60,130)">
        <circle r="9" fill="var(--color-evergreen)" />
        <circle r="4" fill="#fff" />
        <text y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)">You</text>
      </g>

      <g transform="translate(260,40)">
        <path d="M 0 -14 C -8 -14 -12 -6 -12 0 C -12 8 0 18 0 18 C 0 18 12 8 12 0 C 12 -6 8 -14 0 -14 Z" fill="var(--color-danger)" />
        <circle cy="-2" r="4" fill="#fff" />
        {nearest && (
          <text y="-22" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)">
            {nearest.distanceMi ? `${nearest.distanceMi} mi` : "Nearest 24h"}
          </text>
        )}
      </g>
    </svg>
  );
}

export function Emergency({ dog, summary, contacts }: EmergencyProps) {
  const nearest = contacts.find((c) => c.distanceMi != null) ?? contacts[0];
  const poison = contacts.find((c) => /poison/i.test(c.role));
  const other = contacts.filter((c) => c !== nearest && c !== poison);

  return (
    <div className="cp-emergency">
      <div className="cp-emergency-banner">
        <span className="cp-emergency-banner__pulse" aria-hidden="true" />
        <span>EMERGENCY MODE</span>
      </div>

      <section className="cp-emergency-map-card">
        <VetMap nearest={nearest} />
        <div className="cp-emergency-nearest">
          <div>
            <p className="cp-eyebrow">Nearest 24-hour vet</p>
            <h3 className="cp-emergency-nearest__name">{nearest.name}</h3>
            <p className="cp-mini-meta">
              {nearest.distanceMi ? `${nearest.distanceMi} mi away` : "Distance unknown"} · {nearest.hours}
            </p>
          </div>
        </div>
        <a className="cp-btn cp-btn--danger cp-btn--full" href={`tel:${nearest.phone.replace(/\D/g, "")}`}>
          📞 Call Vet Now — {nearest.phone}
        </a>
      </section>

      <section className="cp-card">
        <h3 className="cp-card__title">{dog.name}'s medical summary</h3>
        <dl className="cp-med-summary">
          <div>
            <dt>Vaccines</dt>
            <dd>{summary.vaccines.join(" · ")}</dd>
          </div>
          <div>
            <dt>Allergies</dt>
            <dd>{summary.allergies.join(" · ")}</dd>
          </div>
          <div>
            <dt>Medications</dt>
            <dd>{summary.medications.join(" · ")}</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{dog.weightLbs} lbs · {dog.breed}, {dog.ageMonths} mo</dd>
          </div>
        </dl>
      </section>

      <section className="cp-emergency-actions">
        {poison && (
          <a className="cp-emergency-action" href={`tel:${poison.phone.replace(/\D/g, "")}`}>
            <span className="cp-emergency-action__icon">☎️</span>
            <span>
              <strong>Poison Control</strong>
              <span className="cp-mini-meta">{poison.phone}</span>
            </span>
          </a>
        )}
        <button className="cp-emergency-action">
          <span className="cp-emergency-action__icon">❓</span>
          <span>
            <strong>What to do now</strong>
            <span className="cp-mini-meta">Triage guide</span>
          </span>
        </button>
      </section>

      {other.length > 0 && (
        <section className="cp-card">
          <h3 className="cp-card__title">Other contacts</h3>
          <ul className="cp-contact-list">
            {other.map((c) => (
              <li key={c.name} className="cp-contact-item">
                <div>
                  <p className="cp-contact-name">{c.name}</p>
                  <p className="cp-mini-meta">{c.role} · {c.hours}</p>
                </div>
                <a className="cp-btn cp-btn--ghost" href={`tel:${c.phone.replace(/\D/g, "")}`}>{c.phone}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
