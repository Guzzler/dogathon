import { NavLink } from "react-router-dom";

/**
 * The shelter side's two surfaces. Rendered inside the staff gate, not in `ShelterLayout`, so
 * a signed-out or non-staff visitor never sees navigation to screens they can't open.
 */
export function ShelterNav() {
  return (
    <nav className="shelter__nav" aria-label="Shelter sections">
      <NavLink end to="/shelter" className={({ isActive }) => `shelter__tab${isActive ? " is-on" : ""}`}>
        Applications
      </NavLink>
      <NavLink to="/shelter/dogs" className={({ isActive }) => `shelter__tab${isActive ? " is-on" : ""}`}>
        Our dogs
      </NavLink>
    </nav>
  );
}
