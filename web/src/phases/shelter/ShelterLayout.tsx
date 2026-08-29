import { Outlet } from "react-router-dom";
import { pawthwayTheme, themeVars } from "../../brand";

/**
 * The shelter side's own chrome. Deliberately not `.shell > .phone` (that's a 430px
 * mobile-first frame built for the foster journey) -- staff work is desk-shaped, so this is
 * built responsive from the start, per the 2026-08-26 device-agnostic decision recorded in
 * docs/initiatives/design-consistency.md and docs/initiatives/real-data-and-shelters.md.
 */
export function ShelterLayout() {
  return (
    <div className="shelter" style={themeVars(pawthwayTheme)}>
      <Outlet />
    </div>
  );
}
