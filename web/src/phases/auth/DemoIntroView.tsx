import { motion } from "motion/react";

const SEEN_KEY = "pawthway.demoIntroSeen.v1";
const DEMO_KEY = "pawthway.demoMode.v1";

export const demoIntroSeen = () => localStorage.getItem(SEEN_KEY) === "1";

function choose(demo: boolean) {
  localStorage.setItem(SEEN_KEY, "1");
  if (demo) localStorage.setItem(DEMO_KEY, "1");
  else localStorage.removeItem(DEMO_KEY);
  // DEMO_MODE is read once at module load, so a full reload is what makes it take effect.
  window.location.assign("/");
}

/** Shown once, right after sign-in, so a demo visitor knows the dogs are real and the
 *  shelter-approval steps can be skipped via the demo controls. */
export function DemoIntroView() {
  return (
    <div className="screen">
      <div className="scroll pad" style={{ display: "flex", flexDirection: "column", paddingTop: 40 }}>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 style={{ fontSize: 26 }}>You're in demo mode</h1>
          <p className="sub" style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.6 }}>
            All dogs on the listing are real dogs available for fostering from SF SPCA, as of
            August 23rd, 2025. The usual app flow requires the shelter to approve your
            application — that's overridable with demo controls, so feel free to use them to
            go through the whole flow.
          </p>
        </motion.div>
      </div>

      <motion.div className="pad safe-b" initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .15 }} style={{ paddingTop: 12 }}>
        <button className="btn" onClick={() => choose(true)}>Continue In Demo Mode</button>
        <button className="btn outline" style={{ marginTop: 9 }} onClick={() => choose(false)}>
          Non-Demo Mode
        </button>
      </motion.div>
    </div>
  );
}
