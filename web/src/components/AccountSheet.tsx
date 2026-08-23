import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AUTH_AVAILABLE, signInWithGoogle, signOutOfPawthway } from "../auth";
import { clearGuestData } from "../lib/localMode";
import type { Session } from "../lib/session";

/** Identity and sign-out. A sheet rather than a route, so it stays out of the journey. */
export function AccountSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const isGuest = session.kind === "guest";

  async function upgrade() {
    setBusy(true);
    try { await signInWithGoogle(); onClose(); }
    catch { /* popup dismissed */ }
    finally { setBusy(false); }
  }

  // Portalled to <body>: the tab bar's backdrop-filter makes it a containing block for
  // fixed-position children, which would otherwise pin this sheet inside the 64px bar.
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(35,25,18,.4)", zIndex: 900 }} />
      <motion.div initial={{ y: 340 }} animate={{ y: 0 }} exit={{ y: 360 }}
        transition={{ type: "spring", stiffness: 330, damping: 33 }} className="sharesheet">
        <div className="sharesheet__grip" />

        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <Avatar session={session} size={44} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {session.kind === "user" ? session.name : "Guest"}
            </div>
            <div className="muted" style={{ marginTop: 2 }}>
              {session.kind === "user" ? session.email : "Saved on this device only"}
            </div>
          </div>
        </div>

        {isGuest && (
          <div className="account__upsell">
            <p className="sub" style={{ fontSize: 13.5 }}>
              Your journey lives in this browser — anyone else using it picks up where you left
              off. Sign in to make it yours and keep it across devices.
            </p>
            {!AUTH_AVAILABLE && (
              <p className="muted" style={{ marginTop: 7 }}>
                Needs Firebase config in <code>web/.env</code>.
              </p>
            )}
          </div>
        )}

        {isGuest && (
          <button className="btn btn--primary" style={{ marginTop: 12 }} disabled={!AUTH_AVAILABLE || busy}
            onClick={upgrade}>
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
        )}

        <button className="btn btn--ghost" style={{ marginTop: 8 }}
          onClick={async () => { await signOutOfPawthway(); onClose(); }}>
          {isGuest ? "Leave guest mode" : "Sign out"}
        </button>

        {isGuest && (confirmWipe ? (
          <div className="account__wipe">
            <p className="sub" style={{ fontSize: 13 }}>
              This erases the questionnaire, saved dogs, and journal on this device. It can't be
              undone.
            </p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setConfirmWipe(false)}>
                Keep it
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }}
                onClick={() => { clearGuestData(); onClose(); }}>
                Erase
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setConfirmWipe(true)}>
            Start fresh on this device
          </button>
        ))}

        <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
      </motion.div>
    </>,
    document.body,
  );
}

export function Avatar({ session, size = 26 }: { session: Session; size?: number }) {
  const photo = session.kind === "user" ? session.photoURL : null;
  const initial = session.kind === "user" ? (session.name.trim()[0] ?? "?").toUpperCase() : "G";

  if (photo) {
    return <img className="avatar" src={photo} alt="" width={size} height={size}
      style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar avatar--initial" style={{ width: size, height: size, fontSize: size * 0.44 }}>
      {initial}
    </span>
  );
}

/** Tab-bar entry that opens the sheet. Deliberately not a route. */
export function AccountTab({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tabbar__link tabbar__link--account" onClick={() => setOpen(true)}>
        <span className="tabbar__icon"><Avatar session={session} size={19} /></span>
        <span className="tabbar__label">{session.kind === "user" ? "You" : "Guest"}</span>
      </button>
      <AnimatePresence>
        {open && <AccountSheet session={session} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
