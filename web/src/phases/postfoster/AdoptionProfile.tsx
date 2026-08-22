import { useState } from "react";
import { motion } from "motion/react";
import type { AdoptionProfile } from "../../lib/adoption";
import { ENERGY_WORD, sizeLabel, type RichDog } from "../../lib/dog";

/** The adoption page itself. Rendered for the foster and, read-only, for a shared link. */
export function AdoptionProfileBody({ dog, profile, tags = [], tagsPending }: {
  dog: RichDog; profile: AdoptionProfile; tags?: string[]; tagsPending?: boolean;
}) {
  const [hero, setHero] = useState(0);
  const shot = profile.photos[hero];

  return (
    <>
      <div className="ap-gallery">
        {/* Journal photos are colour swatches until real upload exists, so handle both. */}
        {shot?.url ? (
          <motion.img key={hero} src={shot.url} alt={shot.caption ?? dog.name}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ap-hero" />
        ) : (
          <motion.div key={hero} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="ap-hero ap-hero--swatch" style={{ background: shot?.color ?? "var(--cream-2)" }}>
            <span>📷</span>
          </motion.div>
        )}
        {shot?.caption && <p className="ap-caption">{shot.caption}</p>}

        {profile.photos.length > 1 && (
          <div className="ap-thumbs">
            {profile.photos.map((p, i) => (
              <button key={(p.url ?? p.color ?? "") + i} onClick={() => setHero(i)} data-on={i === hero}
                className="ap-thumb"
                style={p.url ? { backgroundImage: `url(${p.url})` } : { background: p.color }}
                aria-label={`Photo ${i + 1}`} />
            ))}
          </div>
        )}
        {!profile.fromJournal.photos && <span className="ap-placeholder">Sample photos — journal photos will appear here</span>}
      </div>

      <h1 style={{ fontSize: 32, marginTop: 20 }}>{dog.name}</h1>
      <p className="sub" style={{ marginTop: 5, fontWeight: 700, color: "var(--ink-2)" }}>
        {dog.ageLabel} · {dog.breed} · {sizeLabel(dog.size)} · {profile.health.currentWeight}
      </p>
      <p className="sub" style={{ marginTop: 14 }}>{profile.summary}</p>

      {(tags.length > 0 || tagsPending) && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 9 }}>At a glance</div>
          {tagsPending ? (
            <span className="muted">Reading the journal…</span>
          ) : (
            <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
              {tags.map((t, i) => (
                <span key={t} className={`chip ${["coral", "sage", "butter"][i % 3]}`} style={{ fontWeight: 800 }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className="ap-note-hint" style={{ marginTop: 9, marginBottom: 0 }}>
            Pulled from your journal notes
          </p>
        </div>
      )}

      <Section title="Personality">
        {profile.personality.map((p) => (
          <div key={p.label} className="ap-row">
            <span className="chip coral" style={{ fontWeight: 800 }}>{p.label}</span>
            <p className="sub" style={{ fontSize: 14, marginTop: 7 }}>{p.text}</p>
          </div>
        ))}
      </Section>

      <Section title={`A day with ${dog.name}`}>
        <div className="card" style={{ padding: "4px 17px" }}>
          {profile.routine.map((r, i) => (
            <div key={r.when} className="ap-routine" data-last={i === profile.routine.length - 1}>
              <span className="ap-when">{r.when}</span>
              <p className="sub" style={{ fontSize: 14 }}>{r.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="House manners">
        <div className="card" style={{ padding: "4px 17px" }}>
          {profile.manners.map((m, i) => (
            <div key={m.label} className="ap-manner" data-last={i === profile.manners.length - 1}>
              <span className="ap-tick" data-good={m.good}>{m.good ? "✓" : "•"}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{m.label}</div>
                <div className="muted" style={{ marginTop: 2 }}>{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Health &amp; care" note={!profile.fromJournal.weight ? "From the shelter record — weigh-ins will update this" : undefined}>
        <div className="card" style={{ padding: "4px 17px" }}>
          <KV k="Current weight" v={profile.health.currentWeight} />
          {profile.health.startWeight && <KV k="At intake" v={profile.health.startWeight} />}
          {profile.health.trend && <KV k="Trend" v={profile.health.trend} />}
          <KV k="Energy level" v={ENERGY_WORD[dog.energyLevel]} />
          <KV k="Grooming" v={`${dog.groomingLevel === "low" ? "Low" : "High"} · ${dog.coatLength} coat`} last={!profile.health.vetVisits.length} />
          {profile.health.vetVisits.map((v, i) => (
            <KV key={v.date + i} k={`Vet · ${v.date}`} v={v.note} last={i === profile.health.vetVisits.length - 1} />
          ))}
        </div>
      </Section>

      <Section title="What we've worked on" note={!profile.fromJournal.notes ? "Sample entries — your journal notes will appear here" : undefined}>
        <div className="ap-timeline">
          {profile.highlights.map((h, i) => (
            <div key={h.date + i} className="ap-tl-item">
              <span className="ap-tl-dot" />
              <div>
                <span className="ap-tl-date">{h.date}</span>
                <p className="sub" style={{ fontSize: 14, marginTop: 3 }}>{h.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The ideal home">
        <div className="card" style={{ padding: "14px 17px" }}>
          {profile.idealHome.map((h) => (
            <div key={h} className="row" style={{ gap: 9, padding: "5px 0", alignItems: "flex-start" }}>
              <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 13, lineHeight: 1.5 }}>›</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{h}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="A note from the foster">
        <div className="card ap-note">
          <p className="sub" style={{ fontSize: 14.5, fontStyle: "italic" }}>{profile.fosterNote}</p>
        </div>
      </Section>

      <div className="card ap-shelter">
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{dog.shelter.name}</div>
        <div className="muted" style={{ marginTop: 2 }}>{dog.shelter.address}</div>
        <p className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Adoption enquiries go through the shelter. They'll arrange a meet-and-greet.
        </p>
      </div>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div className="eyebrow" style={{ marginBottom: note ? 4 : 11 }} dangerouslySetInnerHTML={{ __html: title }} />
      {note && <p className="ap-note-hint">{note}</p>}
      {children}
    </div>
  );
}

function KV({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className="row" style={{ gap: 12, padding: "12px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span className="muted" style={{ fontWeight: 700, flexShrink: 0 }}>{k}</span>
      <span className="sp" />
      <span style={{ fontSize: 14, fontWeight: 800, textAlign: "right" }}>{v}</span>
    </div>
  );
}
