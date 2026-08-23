import { useState } from "react";
import { motion } from "motion/react";
import type { AdoptionProfile } from "../../lib/adoption";
import { sizeLabel, type RichDog } from "../../lib/dog";

/**
 * The adoption page. Every section states where its content came from — the foster's journal
 * or the shelter's record — and shows an empty state rather than filler when there's nothing
 * logged yet.
 */
export function AdoptionProfileBody({ dog, profile, tags = [], summary = "", tagsPending, noteEditor }: {
  dog: RichDog; profile: AdoptionProfile; tags?: string[]; summary?: string;
  tagsPending?: boolean;
  /** The foster's own view passes an editor; the public link doesn't. */
  noteEditor?: React.ReactNode;
}) {
  const [hero, setHero] = useState(0);
  const shot = profile.photos[Math.min(hero, profile.photos.length - 1)];

  return (
    <>
      <div className="ap-gallery">
          <motion.img key={hero} src={shot.url} alt={shot.caption ?? dog.name}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ap-hero" />
        <div className="row" style={{ gap: 8, marginTop: 9 }}>
          <span className="ap-src">{shot.source === "journal" ? "📔" : "🏠"} {shot.date}</span>
          {shot.caption && <span className="ap-caption">{shot.caption}</span>}
        </div>

        {profile.photos.length > 1 && (
          <div className="ap-thumbs">
            {profile.photos.map((p, i) => (
              <button key={p.url + i} onClick={() => setHero(i)} data-on={i === hero}
                className="ap-thumb"
                style={{ backgroundImage: `url(${p.url})` }}
                aria-label={`Photo ${i + 1}`} />
            ))}
          </div>
        )}
        {!profile.hasJournalPhotos && (
          <span className="ap-placeholder">Shelter photo only — photos added in the journal appear here too</span>
        )}
      </div>

      <h1 style={{ fontSize: 32, marginTop: 20 }}>{dog.name}</h1>
      <p className="sub" style={{ marginTop: 5, fontWeight: 700, color: "var(--ink-2)" }}>
        {dog.ageLabel} · {dog.breed} · {sizeLabel(dog.size)} · {profile.weight.value}
        {profile.weight.source === "shelter" && <span className="ap-src"> · intake weight</span>}
      </p>

      <Section
        title="Foster Parent Notes"
        src={profile.journalNotes.length
          ? `Summarised from all ${profile.journalNotes.length} journal entr${profile.journalNotes.length === 1 ? "y" : "ies"}, Day ${profile.journalNotes[0].day} to Day ${profile.journalNotes[profile.journalNotes.length - 1].day}`
          : undefined}
      >
        {!profile.journalNotes.length && !profile.hasJournalPhotos ? (
          <EmptyBlock icon="📔" title="Nothing logged yet"
            body={`Notes and photos the foster stars in ${dog.name}'s journal are summarised here.`} />
        ) : (
          <>
            {tagsPending && <span className="muted">Reading the journal…</span>}

            {tags.length > 0 && (
              <div className="row" style={{ gap: 7, flexWrap: "wrap", marginBottom: summary ? 14 : 0 }}>
                {tags.map((t, i) => (
                  <span key={t} className={`chip ${["coral", "sage", "butter"][i % 3]}`} style={{ fontWeight: 800 }}>{t}</span>
                ))}
              </div>
            )}

            {summary && (
              <div className="card ap-summary">
                <p className="sub" style={{ fontSize: 14.5 }}>{summary}</p>
              </div>
            )}

            {profile.journalNotes.length > 0 && (
              <>
                <p className="ap-note-hint" style={{ marginTop: 18, marginBottom: 10 }}>
                  In the foster's own words
                </p>
                <div className="ap-timeline">
                  {profile.journalNotes.map((h, i) => (
                    <div key={h.date + i} className="ap-tl-item">
                      <span className="ap-tl-dot" />
                      <div>
                        <span className="ap-tl-date">{h.date}</span>
                        <p className="sub" style={{ fontSize: 14, marginTop: 3 }}>{h.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Section>

      <Section title="A note from the foster">
        {profile.fosterNote && (
          <div className="card ap-note">
            <p className="sub" style={{ fontSize: 14.5, fontStyle: "italic" }}>{profile.fosterNote}</p>
          </div>
        )}
        {noteEditor}
        {!profile.fosterNote && !noteEditor && (
          <EmptyBlock icon="✍️" title="Not written yet"
            body="The foster hasn't added their note. This is the part adopters read first, so it's worth writing." />
        )}
      </Section>

      <Section
        title="Health &amp; care record"
        src={profile.careDone.length
          ? `${profile.careDone.length} of ${profile.careDone.length + profile.careOutstanding} care items completed`
          : "Nothing ticked off in the Care Plan yet"}
      >
        {profile.careDone.length || profile.milestones.length ? (
          <>
            {profile.careDone.length > 0 && (
              <div className="card" style={{ padding: "13px 17px" }}>
                {profile.careDone.map((c) => (
                  <div key={c.label} className="row" style={{ gap: 10, padding: "5px 0", alignItems: "flex-start" }}>
                    <span className="ap-tick" data-good="true">✓</span>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</span>
                      <span className="ap-src"> · {c.block}</span>
                    </div>
                  </div>
                ))}
                {profile.careOutstanding > 0 && (
                  <p className="muted" style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--line)" }}>
                    {profile.careOutstanding} still outstanding
                  </p>
                )}
              </div>
            )}

            {profile.milestones.length > 0 && (
              <>
                <p className="ap-note-hint" style={{ marginTop: 16, marginBottom: 10 }}>Timeline</p>
                <div className="card" style={{ padding: "4px 17px" }}>
                  {profile.milestones.map((m, i) => (
                    <KV key={m.title + i} k={`Day ${m.day} · ${m.title}`}
                      v={m.weight ? `${m.weight} lb` : m.note ?? "—"}
                      last={i === profile.milestones.length - 1} />
                  ))}
                </div>
              </>
            )}

            <p className="ap-note-hint" style={{ marginTop: 16, marginBottom: 10 }}>Medical</p>
            <div className="card" style={{ padding: "4px 17px" }}>
              <KV k="Vaccines" v={profile.medical.vaccines.join(", ")} />
              <KV k="Allergies" v={profile.medical.allergies.join(", ")} />
              <KV k="Medications" v={profile.medical.medications.join(", ")} last />
            </div>
          </>
        ) : (
          <EmptyBlock icon="⚖️" title="No health entries yet"
            body="Care items you tick off in the Care Plan show up here as you go." />
        )}
      </Section>

      <Section title={`${dog.shelter.short}'s record`} src="Recorded by the shelter, not observed in foster">
        <div className="card" style={{ padding: "4px 17px" }}>
          {profile.shelterFacts.map((f, i) => (
            <KV key={f.label} k={f.label} v={f.value} last={i === profile.shelterFacts.length - 1} />
          ))}
        </div>
        <p className="sub" style={{ marginTop: 13, fontSize: 14 }}>{profile.shelterNotes}</p>
      </Section>

      <Section title="Gets along with" src="From the shelter's record">
        <div className="row" style={{ gap: 10 }}>
          {profile.compatibility.map((c) => (
            <div key={c.label} className="card" style={{ flex: 1, padding: "14px 8px", textAlign: "center", borderRadius: 18, opacity: c.known ? 1 : .6 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{c.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: c.value === "Yes" ? "var(--sage)" : "var(--ink-3)" }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {profile.careNeeds.length > 0 && (
        <Section title="Care needs" src="From the shelter's record">
          <div className="card" style={{ padding: "14px 17px" }}>
            {profile.careNeeds.map((h) => (
              <div key={h} className="row" style={{ gap: 9, padding: "5px 0", alignItems: "flex-start" }}>
                <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 13, lineHeight: 1.5 }}>›</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{h}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

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

function Section({ title, src, children }: { title: string; src?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div className="eyebrow" style={{ marginBottom: src ? 3 : 11 }}>{title}</div>
      {src && <p className="ap-note-hint">{src}</p>}
      {children}
    </div>
  );
}

function EmptyBlock({ icon, title, body, tall }: { icon: string; title: string; body: string; tall?: boolean }) {
  return (
    <div className="ap-empty" data-tall={tall}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 7 }}>{title}</div>
      <p className="muted" style={{ marginTop: 5, lineHeight: 1.5, maxWidth: 280 }}>{body}</p>
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
