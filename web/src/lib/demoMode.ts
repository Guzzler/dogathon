/**
 * The demo panels stand in for systems this app doesn't own -- the shelter's
 * review dashboard, the passage of time during a foster. They're useful when
 * showing the app off and confusing when you're actually using it, so they're
 * off unless you ask for them.
 *
 * Turn on with `?demo=1`, off with `?demo=0`. The choice sticks (localStorage)
 * so it survives navigation, because the panels are per-phase and you'd
 * otherwise lose them the moment you moved screens.
 */
const KEY = "pawthway.demoMode.v1";

function read(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1" || param === "true") {
      localStorage.setItem(KEY, "1");
      return true;
    }
    if (param === "0" || param === "false") {
      localStorage.removeItem(KEY);
      return false;
    }
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const DEMO_MODE = read();
