import { NavLink, Outlet, useLocation } from "react-router-dom";
import { pawthwayTheme, themeVars } from "../brand";
import { useFoster } from "../hooks/useFoster";
import { LOCAL_MODE } from "../lib/localMode";
import { hasOnboarded, journeyTabs } from "../lib/foster";
import { PawMark } from "./Logo";

/** Full-bleed screens own their own chrome, so the tab bar steps out of the way. */
const FULL_BLEED = [/^\/welcome/, /^\/onboarding/, /^\/dog\//, /^\/adoption\//];

export function Layout() {
  const { pathname } = useLocation();
  const { foster } = useFoster();
  // The visible steps follow the foster's phase, so the app reads as a journey.
  const tabs = journeyTabs(foster?.phase);
  const hideTabs = FULL_BLEED.some(re => re.test(pathname)) || !hasOnboarded(foster) || !tabs.length;
  const savedCount = foster?.likedDogIds?.length ?? 0;

  return (
    <div className="shell" style={themeVars(pawthwayTheme)}>
      <div className="phone pw-app">
        {LOCAL_MODE && <div className="local-banner">Local demo data — no Firebase config found</div>}
        <div className="phone-body">
          <Outlet />
        </div>
        {!hideTabs && (
          <nav className="tabbar">
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => `tabbar__link ${isActive ? "is-active" : ""}`}>
                <span className="tabbar__icon">
                  {t.icon === "paw" ? <PawMark size={17} color="currentColor" /> : t.icon}
                  {t.to === "/saved" && savedCount > 0 && <span className="tabbar__badge">{savedCount}</span>}
                </span>
                <span className="tabbar__label">{t.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
