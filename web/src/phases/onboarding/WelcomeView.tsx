import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { LogoLockup } from "../../components/Logo";
import { patchFoster } from "../../hooks/useFoster";

/** First thing a brand-new foster sees — the app opens here, not on the Hub. */
export function WelcomeView() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function start() {
    setSaving(true);
    try {
      // Only the name here — intake stays empty, which is what the gate checks.
      await patchFoster({ name: name.trim() });
      navigate("/onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="pad" style={{ paddingTop: 26 }}>
        <span className="chip coral" style={{ fontWeight: 800 }}>Foster mode</span>
      </div>

      <div className="scroll pad" style={{ display: "flex", flexDirection: "column", paddingTop: 26 }}>
        <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 style={{ fontSize: 40, lineHeight: 1.1 }}>Ready to find your new foster buddy?</h1>
          <p className="sub" style={{ marginTop: 16, fontSize: 16 }}>
            A few quick questions and we'll match you with dogs waiting at shelters near you.
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: .15, type: "spring", stiffness: 190, damping: 16 }}
          style={{ alignSelf: "center", margin: "auto 0", animation: "float 4.5s ease-in-out infinite" }}
        >
          <LogoLockup size={116} />
        </motion.div>

        <motion.label
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .25 }}
          style={{ display: "block", marginTop: "auto" }}
        >
          <span className="cglabel">First, what should we call you?</span>
          <input
            className="namefield" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your first name" autoComplete="given-name" maxLength={40}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) start(); }}
          />
        </motion.label>
      </div>

      <motion.div className="pad safe-b" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .3 }} style={{ paddingTop: 16 }}>
        <p className="muted" style={{ textAlign: "center", marginBottom: 14 }}>
          We'll help you find the right match
        </p>
        <button className="btn" disabled={!name.trim() || saving} onClick={start}>
          {saving ? "One sec…" : "Let's go"}
        </button>
      </motion.div>
    </div>
  );
}
