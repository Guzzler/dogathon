import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import DogGrow from "../../components/DogGrow";
import { patchFoster } from "../../hooks/useFoster";
import { ENERGY_WORD } from "../../lib/dog";
import type { FosterIntake } from "../../types";

const STEPS = 5;
const ENERGY_FACE = ["😴", "🙂", "🐕", "⚡", "🌪️"];
const SIZE_HINT = ["Under 25 lb", "25–45 lb", "45 lb and up"];
const sizeWord = (v: number) => (v < 33 ? "Small" : v < 67 ? "Medium" : "Large");

type Tag = "groomLow" | "groomHigh" | "kidsGood" | "adultsOnly" | "coatShort" | "coatLong" | "withDogs" | "withCats";
type Home = "apartment" | "townhouse" | "houseYard";

const HOMES: { v: Home; l: string; s: string }[] = [
  { v: "apartment", l: "Apartment", s: "Shared building, no yard" },
  { v: "townhouse", l: "Townhouse", s: "Stairs, maybe a small patio" },
  { v: "houseYard", l: "House (with yard)", s: "Fenced outdoor space" },
];

const GROUPS: { label: string; a: [Tag, string]; b: [Tag, string] }[] = [
  { label: "Grooming",   a: ["groomLow", "Low maintenance"], b: ["groomHigh", "Happy to groom"] },
  { label: "Kids",       a: ["kidsGood", "Good with kids"],  b: ["adultsOnly", "Adults only"] },
  { label: "Coat",       a: ["coatShort", "Short coat"],     b: ["coatLong", "Long coat"] },
  { label: "Other pets", a: ["withDogs", "I have a dog"],    b: ["withCats", "I have a cat"] },
];

const TAG_LABEL: Record<Tag, string> = {
  groomLow: "Low grooming", groomHigh: "Happy to groom", kidsGood: "Good with kids",
  adultsOnly: "Adults only", coatShort: "Short coat", coatLong: "Long coat",
  withDogs: "Dog-friendly", withCats: "Cat-friendly",
};

export function OnboardingView() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);

  const [experience, setExperience] = useState<"first" | "experienced" | null>(null);
  const [sizePref, setSizePref] = useState(50);
  const [energyPref, setEnergyPref] = useState(2);
  const [home, setHome] = useState<Home | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [restrictions, setRestrictions] = useState("");

  const summary = i === STEPS;
  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); };
  const canNext = [!!experience, true, true, !!home, true, true][i];

  const toggleTag = (t: Tag) => {
    const g = GROUPS.find(x => x.a[0] === t || x.b[0] === t)!;
    const other = g.a[0] === t ? g.b[0] : g.a[0];
    setTags(p => (p.includes(t) ? p.filter(x => x !== t) : [...p.filter(x => x !== other), t]));
  };

  async function finish() {
    setSaving(true);
    try {
      // Written in both shapes: the six strings are what the agent's `get_foster()` reads,
      // the pref_* fields are what scoreDog() needs.
      const intake: FosterIntake = {
        living_arrangement: home === "apartment" ? "Apartment" : home === "townhouse" ? "Townhouse" : "House with yard",
        experience_level: experience === "first" ? "First-time foster" : "Experienced foster",
        time_availability: energyPref >= 3 ? "A lot (home most of the day)" : "A little (WFH some days)",
        size_preference: sizeWord(sizePref),
        energy_preference: ENERGY_WORD[energyPref],
        restrictions,
        pref_size: sizePref,
        pref_energy: energyPref,
        pref_home: home ?? undefined,
        pref_experience: experience ?? undefined,
        pref_tags: tags,
      };
      await patchFoster({ intake, phase: "discovery" });
      navigate("/discovery");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="topbar" style={{ paddingBottom: 6 }}>
        <button className="iconbtn" onClick={() => (i === 0 ? navigate("/") : go(i - 1))} aria-label="Back">←</button>
        <span className="sp" />
        <div className="dots">
          {Array.from({ length: STEPS }, (_, n) => <i key={n} data-on={n === i} data-done={n < i} />)}
        </div>
        <span className="sp" />
        <span style={{ width: 38 }} />
      </div>

      <div className="scroll pad" style={{ paddingTop: 18 }}>
        <motion.div key={i} initial={{ x: dir * 34, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ duration: .26, ease: "easeOut" }}>

          {i === 0 && (
            <Q title="First time fostering?" sub="Your answer helps us tailor your matches">
              <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 30 }}>
                <button className="pillopt" data-on={experience === "first"}
                  onClick={() => { setExperience("first"); setTimeout(() => go(1), 230); }}>
                  Yes, I'm new!<span className="ps">We'll keep it gentle and guided</span>
                </button>
                <button className="pillopt" data-on={experience === "experienced"}
                  onClick={() => { setExperience("experienced"); setTimeout(() => go(1), 230); }}>
                  I've fostered before<span className="ps">Show me the tougher cases too</span>
                </button>
              </div>
            </Q>
          )}

          {i === 1 && (
            <Q title="How big?" sub="Drag to pick your size preference">
              <div style={{ marginTop: 8 }}>
                <DogGrow t={sizePref / 100} />
                <div style={{ textAlign: "center", marginTop: 10, marginBottom: 6 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 600 }}>{sizeWord(sizePref)}</div>
                  <div className="muted">{SIZE_HINT[sizePref < 33 ? 0 : sizePref < 67 ? 1 : 2]}</div>
                </div>
                <input className="slider" type="range" min={0} max={100} value={sizePref} aria-label="Size preference"
                  onChange={e => setSizePref(+e.target.value)} />
                <div className="ticks">
                  {["Small", "Medium", "Large"].map((l, n) => (
                    <span key={l} data-on={(sizePref < 33 ? 0 : sizePref < 67 ? 1 : 2) === n}>{l}</span>
                  ))}
                </div>
              </div>
            </Q>
          )}

          {i === 2 && (
            <Q title="Energy level?" sub="What pace suits your lifestyle?">
              <div style={{ marginTop: 34 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px", marginBottom: 26 }}>
                  {ENERGY_FACE.map((f, n) => (
                    <motion.button key={n} onClick={() => setEnergyPref(n)} aria-label={ENERGY_WORD[n]}
                      animate={{ scale: energyPref === n ? 1.32 : 1, opacity: energyPref === n ? 1 : .38 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      style={{ fontSize: 27, lineHeight: 1 }}>{f}</motion.button>
                  ))}
                </div>
                <input className="slider" type="range" min={0} max={4} value={energyPref} aria-label="Energy preference"
                  onChange={e => setEnergyPref(+e.target.value)} />
                <div className="ticks"><span>Couch potato</span><span>Zoomies</span></div>
                <motion.div key={energyPref} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: "center", marginTop: 22 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 600 }}>{ENERGY_WORD[energyPref]}</div>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {["Short strolls and long naps", "A daily walk, then settle", "Walks, play and some training",
                      "Runs, hikes and real exercise", "An athlete who needs a job"][energyPref]}
                  </div>
                </motion.div>
              </div>
            </Q>
          )}

          {i === 3 && (
            <Q title="Where will your foster stay?" sub="Tap to select your living situation">
              <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 30 }}>
                {HOMES.map(h => (
                  <button key={h.v} className="pillopt" data-on={home === h.v}
                    onClick={() => { setHome(h.v); setTimeout(() => go(4), 230); }}>
                    {h.l}<span className="ps">{h.s}</span>
                  </button>
                ))}
              </div>
            </Q>
          )}

          {i === 4 && (
            <Q title="A few quick things…" sub="Tap all that apply — or skip any">
              <div style={{ marginTop: 26 }}>
                {GROUPS.map(g => (
                  <div className="cgroup" key={g.label}>
                    <div className="cglabel">{g.label}</div>
                    <div className="cgrow">
                      {[g.a, g.b].map(([tag, label]) => (
                        <button key={tag} data-on={tags.includes(tag)} onClick={() => toggleTag(tag)}>{label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="cgroup">
                  <div className="cglabel">Anything else?</div>
                  <textarea className="pw-textarea" rows={2} value={restrictions}
                    onChange={e => setRestrictions(e.target.value)}
                    placeholder="Allergies, HOA rules, anything hard-and-fast" />
                </div>
              </div>
            </Q>
          )}

          {summary && (
            <Summary chips={[
              sizeWord(sizePref),
              `${ENERGY_WORD[energyPref]} energy`,
              home === "apartment" ? "Apartment-friendly" : home === "townhouse" ? "Townhouse-friendly" : "Yard to run in",
              experience === "first" ? "First-time buddy" : "Experienced foster",
              ...tags.map(t => TAG_LABEL[t]),
            ]} />
          )}
        </motion.div>
      </div>

      <div className="pad safe-b" style={{ paddingTop: 14 }}>
        <button className="btn" disabled={!canNext || saving} onClick={() => (summary ? finish() : go(i + 1))}>
          {summary ? (saving ? "Saving…" : "Find my matches 🔍") : "Continue"}
        </button>
      </div>
    </div>
  );
}

function Q({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ textAlign: "center" }}>
        <h2>{title}</h2>
        <p className="sub" style={{ marginTop: 8, fontSize: 14.5 }}>{sub}</p>
      </div>
      {children}
    </>
  );
}

function Summary({ chips }: { chips: string[] }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 6 }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}
        style={{
          width: 62, height: 62, borderRadius: "50%", background: "var(--sage-soft)", color: "var(--sage)",
          display: "grid", placeItems: "center", fontSize: 30, margin: "0 auto 22px", fontWeight: 900,
        }}>✓</motion.div>
      <h2>Here's your ideal foster buddy</h2>
      <p className="sub" style={{ marginTop: 8, fontSize: 14.5 }}>Based on your answers</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center", marginTop: 26 }}>
        {chips.map((c, n) => (
          <motion.span key={c} className={`chip ${["coral", "sage", "butter"][n % 3]}`}
            initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: .08 + n * .055, type: "spring", stiffness: 300, damping: 18 }}
            style={{ padding: "9px 15px", fontSize: 13 }}>{c}</motion.span>
        ))}
      </div>
    </div>
  );
}
