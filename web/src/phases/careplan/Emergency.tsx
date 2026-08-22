import type { DogProfile, EmergencyContact, MedicalSummary } from "./types";

interface EmergencyProps {
  dog: DogProfile;
  summary: MedicalSummary;
  contacts: EmergencyContact[];
}

function VetMap({ nearest }: { nearest?: EmergencyContact }) {
  return (
    <svg className="cp-map" viewBox="0 0 400 240" role="img" aria-label="Nearest vet map">
      {/* Base map background */}
      <rect x="0" y="0" width="400" height="240" fill="#e6ecf0" />

      {/* Park (green area) */}
      <path
        d="M 20 20 L 130 20 L 150 60 L 130 110 L 40 100 Z"
        fill="#c8e6c9"
        stroke="#a5d6a7"
        strokeWidth="0.8"
      />
      <text x="75" y="65" fontSize="9" fill="#4a7c50" fontWeight="600" fontFamily="system-ui">Presidio Park</text>

      {/* Water body */}
      <path
        d="M 0 200 Q 80 180 160 195 T 320 200 L 400 210 L 400 240 L 0 240 Z"
        fill="#a9d3ec"
      />
      <text x="200" y="230" fontSize="9" fill="#3b6a8a" fontWeight="600" fontFamily="system-ui" textAnchor="middle">Bay</text>

      {/* Streets (white ribbons with subtle outline) */}
      {/* Horizontal streets */}
      <line x1="0" y1="55" x2="400" y2="55" stroke="#c9d1d6" strokeWidth="6" />
      <line x1="0" y1="55" x2="400" y2="55" stroke="#ffffff" strokeWidth="4" />

      <line x1="0" y1="120" x2="400" y2="120" stroke="#c9d1d6" strokeWidth="8" />
      <line x1="0" y1="120" x2="400" y2="120" stroke="#ffffff" strokeWidth="6" />

      <line x1="0" y1="165" x2="400" y2="165" stroke="#c9d1d6" strokeWidth="5" />
      <line x1="0" y1="165" x2="400" y2="165" stroke="#ffffff" strokeWidth="3" />

      {/* Vertical streets */}
      <line x1="70" y1="0" x2="70" y2="200" stroke="#c9d1d6" strokeWidth="5" />
      <line x1="70" y1="0" x2="70" y2="200" stroke="#ffffff" strokeWidth="3" />

      <line x1="170" y1="0" x2="170" y2="200" stroke="#c9d1d6" strokeWidth="6" />
      <line x1="170" y1="0" x2="170" y2="200" stroke="#ffffff" strokeWidth="4" />

      <line x1="260" y1="0" x2="260" y2="200" stroke="#c9d1d6" strokeWidth="5" />
      <line x1="260" y1="0" x2="260" y2="200" stroke="#ffffff" strokeWidth="3" />

      <line x1="330" y1="0" x2="330" y2="200" stroke="#c9d1d6" strokeWidth="6" />
      <line x1="330" y1="0" x2="330" y2="200" stroke="#ffffff" strokeWidth="4" />

      {/* Building blocks */}
      <rect x="180" y="65" width="30" height="20" fill="#dee3e7" />
      <rect x="215" y="65" width="20" height="20" fill="#dee3e7" />
      <rect x="180" y="130" width="30" height="12" fill="#dee3e7" />
      <rect x="215" y="130" width="25" height="12" fill="#dee3e7" />
      <rect x="80" y="130" width="30" height="12" fill="#dee3e7" />
      <rect x="270" y="65" width="45" height="20" fill="#dee3e7" />
      <rect x="270" y="130" width="45" height="12" fill="#dee3e7" />
      <rect x="340" y="65" width="30" height="20" fill="#dee3e7" />
      <rect x="340" y="130" width="30" height="12" fill="#dee3e7" />

      {/* Route from user to vet (blue dashed) */}
      <path
        d="M 100 175 L 100 120 L 260 120 L 260 70"
        stroke="#4285f4"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 100 175 L 100 120 L 260 120 L 260 70"
        stroke="#ffffff"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="0 4"
        fill="none"
      />

      {/* User location (Google-style blue dot with accuracy ring) */}
      <g transform="translate(100,175)">
        <circle r="18" fill="#4285f4" fillOpacity="0.15" />
        <circle r="7" fill="#ffffff" />
        <circle r="5" fill="#4285f4" />
      </g>
      <text x="100" y="200" textAnchor="middle" fontSize="10" fontWeight="700" fill="#202124" fontFamily="system-ui">You</text>

      {/* Vet marker (Google-style red teardrop) */}
      <g transform="translate(260,58)">
        <path
          d="M 0 12 C -10 12 -14 3 -14 -4 C -14 -13 -6 -20 0 -20 C 6 -20 14 -13 14 -4 C 14 3 10 12 0 12 Z"
          fill="#ea4335"
          stroke="#b31412"
          strokeWidth="0.6"
        />
        <circle cy="-6" r="5" fill="#ffffff" />
        <circle cy="-6" r="2.5" fill="#ea4335" />
      </g>

      {/* Distance chip on route */}
      {nearest?.distanceMi != null && (
        <g transform="translate(180,110)">
          <rect x="-32" y="-11" width="64" height="20" rx="10" fill="#ffffff" stroke="#dadce0" strokeWidth="1" />
          <text textAnchor="middle" y="3" fontSize="11" fontWeight="700" fill="#202124" fontFamily="system-ui">
            {nearest.distanceMi} mi · 4 min
          </text>
        </g>
      )}

      {/* Scale bar */}
      <g transform="translate(20,215)">
        <line x1="0" y1="0" x2="40" y2="0" stroke="#5f6368" strokeWidth="2" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#5f6368" strokeWidth="2" />
        <line x1="40" y1="-3" x2="40" y2="3" stroke="#5f6368" strokeWidth="2" />
        <text x="20" y="-6" textAnchor="middle" fontSize="9" fill="#5f6368" fontFamily="system-ui">0.5 mi</text>
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
      <header className="cp-phase-banner cp-phase-banner--danger">
        <p className="cp-eyebrow">{dog.name} · {dog.weightLbs} lbs</p>
        <h2 className="cp-phase-name">Emergency</h2>
        <p className="cp-banner-meta">
          24-hour vet, poison control, and {dog.name}'s medical summary — ready to read out.
        </p>
      </header>

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
          Call Vet Now — {nearest.phone}
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
            <strong>Poison Control</strong>
            <span className="cp-mini-meta">{poison.phone}</span>
          </a>
        )}
        <button className="cp-emergency-action">
          <strong>What to do now</strong>
          <span className="cp-mini-meta">Triage guide</span>
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
