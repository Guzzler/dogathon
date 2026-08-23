import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { AUTH_AVAILABLE, signInWithGoogle } from "../auth";
import { fosterDocId } from "../lib/session";

/**
 * Browsing is open to anyone; applying isn't.
 *
 * Applying is the moment the journey stops being private to this browser: a shelter has to
 * be able to reach a real person about a real dog, and everything after it (pickup, the care
 * journal, the adoption profile) is written by the agent, whose backend can only tell whose
 * journey is whose from a signed-in token.
 *
 * Not gated when Firebase isn't configured (`web/.env` missing): there is no account to sign
 * in to and no Firestore to protect — the journey is localStorage either way — and a fresh
 * clone has to be able to walk the whole product. See LOCAL_MODE in lib/localMode.ts.
 */
export const needsAccountToApply = () => fosterDocId() === null && AUTH_AVAILABLE;

export function SignInToApply({ dogName, onClose }: { dogName: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      // A dismissed popup is a decision, not a failure.
      if (!code.includes("popup-closed") && !code.includes("cancelled-popup")) {
        setError("Couldn't sign in. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Portalled for the same reason AccountSheet is: the tab bar's backdrop-filter would
  // otherwise trap a fixed-position child inside the 64px bar.
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(35,25,18,.4)", zIndex: 900 }} />
      <motion.div initial={{ y: 340 }} animate={{ y: 0 }} exit={{ y: 360 }}
        transition={{ type: "spring", stiffness: 330, damping: 33 }} className="sharesheet"
        style={{ textAlign: "center" }}>
        <div className="sharesheet__grip" />

        <div style={{ fontSize: 34 }}>🐾</div>
        <h3 style={{ marginTop: 12 }}>Let's make it official</h3>
        <p className="sub" style={{ marginTop: 8, fontSize: 14 }}>
          Applying for {dogName} means a shelter needs a way to reach you about pickup — and
          your checklist, journal and photos need somewhere safer than this browser to live.
        </p>

        <div className="account__upsell" style={{ textAlign: "left" }}>
          <p className="sub" style={{ fontSize: 13.5 }}>
            Signing in gives your journey a home you can open on any device. You'll answer the
            questionnaire once more on your new account — after that, {dogName} is waiting.
          </p>
        </div>

        {error && <p className="signin__error" style={{ marginTop: 12 }}>{error}</p>}

        <button className="btn btn--primary" style={{ marginTop: 12 }} disabled={busy} onClick={signIn}>
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={onClose}>
          Keep browsing
        </button>
      </motion.div>
    </>,
    document.body,
  );
}
