import { NavLink } from "react-router-dom";
import { PawMark, Wordmark } from "../../components/Logo";

/**
 * The shelter side's two surfaces. Rendered inside the staff gate, not in `ShelterLayout`, so
 * a signed-out or non-staff visitor never sees navigation to screens they can't open.
 *
 * The lockup is the foster app's `.topbar` pattern -- paw, wordmark, then this surface's own
 * controls -- because staff and fosters are two halves of one product and should open the same
 * way. "Shelter" is spelled out beside it so nobody mistakes this for the foster journey.
 */
export function ShelterNav() {
  return (
    <header className="shelter__bar">
      <div className="shelter__bar-in">
        <div className="shelter__brand">
          <PawMark size={24} />
          <Wordmark size={18} />
          <span className="shelter__brand-role">Shelter</span>
        </div>
        <nav className="shelter__nav" aria-label="Shelter sections">
          <NavLink end to="/shelter" className={({ isActive }) => `shelter__tab${isActive ? " is-on" : ""}`}>
            Applications
          </NavLink>
          <NavLink to="/shelter/dogs" className={({ isActive }) => `shelter__tab${isActive ? " is-on" : ""}`}>
            Our dogs
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
