import { NavLink, Outlet } from "react-router-dom";
import { pawthwayTheme, themeVars } from "../brand";

const PHASES: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Hub", end: true },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/discovery", label: "Discovery" },
  { to: "/match", label: "Match" },
  { to: "/care-plan", label: "Care Plan" },
  { to: "/post-foster", label: "Post Foster" },
];

export function Layout() {
  return (
    <div className="pw-app" style={themeVars(pawthwayTheme)}>
      <header className="pw-nav">
        <div className="pw-nav__brand">
          <span className="pw-nav__mark" aria-hidden="true">
            🐾
          </span>
          <div>
            <p className="pw-nav__name">{pawthwayTheme.name}</p>
            <p className="pw-nav__tagline">{pawthwayTheme.tagline}</p>
          </div>
        </div>
        <nav className="pw-nav__links">
          {PHASES.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
              className={({ isActive }) => `pw-nav__link ${isActive ? "pw-nav__link--active" : ""}`}
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="pw-main">
        <Outlet />
      </main>
    </div>
  );
}
