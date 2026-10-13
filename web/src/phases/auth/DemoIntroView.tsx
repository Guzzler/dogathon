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

/**
 * Shown once, right after sign-in, so a visitor knows the dogs are real and what the one
 * opt-in control does (PH-33). It used to promise that shelter approval was "overridable with
 * demo controls" — but `DemoShelterPanel` only renders with no application, which a signed-in
 * foster always has, so the hosted app never showed what this screen offered. The only thing
 * `DEMO_MODE` still turns on for a signed-in foster is Care Plan's day controls.
 */
export function DemoIntroView() {
  return (
    <div className="screen">
      <div className="scroll pad" style={{ display: "flex", flexDirection: "column", paddingTop: 40 }}>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 style={{ fontSize: 26 }}>Before you start</h1>
          <p className="sub" style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.6 }}>
            The dogs here are real — they come from the SF SPCA's public adoption listings, so
            some may have been adopted since.
          </p>
          <p className="sub" style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.6 }}>
            Applying goes to the shelter, and the shelter answers it: they approve your
            application and confirm your pickup. Nothing here skips that step.
          </p>
          <p className="sub" style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.6 }}>
            Day controls are optional: once a pickup is confirmed, they let Care Plan jump
            ahead through the days of a foster so you can see what each stage looks like.
          </p>
        </motion.div>
      </div>

      <motion.div className="pad safe-b" initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: .15 }} style={{ paddingTop: 12 }}>
        <button className="btn" onClick={() => choose(true)}>Show Care Plan's day controls</button>
        <button className="btn outline" style={{ marginTop: 9 }} onClick={() => choose(false)}>
          Continue without them
        </button>
      </motion.div>
    </div>
  );
}
