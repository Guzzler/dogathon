import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoIntroView } from "./DemoIntroView";

/**
 * PH-33. The intro promised shelter approval was "overridable with demo controls", and the
 * hosted app never renders those controls for a signed-in foster. It may describe only what
 * this build does.
 */
describe("DemoIntroView", () => {
  const html = renderToStaticMarkup(<DemoIntroView />);

  it("promises no override of the shelter's answer", () => {
    expect(html).not.toMatch(/overridable/i);
    expect(html).not.toMatch(/demo controls/i);
    expect(html).not.toMatch(/in demo mode/i);
  });

  it("names what the controls actually do, and where", () => {
    expect(html).toContain("Before you start");
    expect(html).toContain("Care Plan&#x27;s day controls");
    expect(html).toContain("SF SPCA");
  });
});
