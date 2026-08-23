import { useState } from "react";
import { motion } from "motion/react";
import { AUTH_AVAILABLE, signInWithGoogle } from "../../auth";
import { continueAsGuest } from "../../lib/session";
import { LogoLockup } from "../../components/Logo";

/** The front door. Everything past this point belongs to a signed-in user or a guest. */
export function SignInView() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      // A closed popup isn't a failure worth shouting about.
      const code = (e as { code?: string })?.code ?? "";
      if (!code.includes("popup-closed") && !code.includes("cancelled-popup")) {
        setError("Couldn't sign in. Check the Firebase console has Google enabled for this domain.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="scroll pad" style={{ display: "flex", flexDirection: "column", paddingTop: 40 }}>
        <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 190, damping: 17 }}
          style={{ alignSelf: "center", marginTop: "auto" }}>
          <LogoLockup size={120} />
        </motion.div>

        <motion.p initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .15 }}
          className="sub" style={{ textAlign: "center", marginTop: 22, fontSize: 16, marginBottom: "auto" }}>
          Find a foster dog, keep a journal while they're with you, and send them home
          adoption-ready.
        </motion.p>
      </div>

      <motion.div className="pad safe-b" initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .25 }} style={{ paddingTop: 12 }}>
        {error && <p className="signin__error">{error}</p>}

        <button className="btn signin__google" onClick={google} disabled={!AUTH_AVAILABLE || busy}>
          <GoogleG /> {busy ? "Signing in…" : "Continue with Google"}
        </button>

        {!AUTH_AVAILABLE && (
          <p className="muted signin__note">
            Google sign-in needs Firebase config in <code>web/.env</code>. Without it you can
            still run the whole journey as a guest — it just stays on this device.
          </p>
        )}

        <button className="btn outline" style={{ marginTop: 9 }} onClick={continueAsGuest}>
          Continue As Guest
        </button>

        <p className="muted signin__fine">
          Guest data is stored on this device only. Signing in keeps your journey across devices.
        </p>
      </motion.div>
    </div>
  );
}

/** Google's mark, inlined — no external asset to load. */
function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.5-4.5 6.3l6.9 5.4c4.1-3.8 6.6-9.4 6.6-15z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.6C2.9 17 2 20.4 2 24s.9 7 2.4 10z" />
      <path fill="#EA4335" d="M24 10.3c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.6c1.8-5.3 6.7-9.3 12.5-9.3z" />
    </svg>
  );
}
