import { NavLink, Outlet, useLocation } from "react-router-dom";
import { pawthwayTheme, themeVars } from "../brand";
import { useFoster } from "../hooks/useFoster";
import { LOCAL_MODE } from "../lib/localMode";
import { hasOnboarded } from "../lib/foster";
import { PawMark } from "./Logo";

const TABS = [
  { to: "/",           label: "Hub",     icon: "🏠", end: true },
  { to: "/discovery",  label: "Discover",icon: "paw" },
  { to: "/saved",      label: "Saved",   icon: "♥" },
  { to: "/match",      label: "Match",   icon: "📋" },
  { to: "/care-plan",  label: "Care",    icon: "🩺" },
  { to: "/post-foster",label: "Adopt",   icon: "🎉" },
];

/** Full-bleed screens own their own chrome, so the tab bar steps out of the way. */
const FULL_BLEED = [/^\/welcome/, /^\/onboarding/, /^\/dog\//];

export function Layout() {
  const { pathname } = useLocation();
  const { foster } = useFoster();
  const hideTabs = FULL_BLEED.some(re => re.test(pathname)) || !hasOnboarded(foster);
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
            {TABS.map(t => (
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
