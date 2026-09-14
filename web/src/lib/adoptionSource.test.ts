import { describe, expect, it } from "vitest";
import { attributionFor } from "./adoptionSource";

/**
 * The three states of `adoption_profile_source`, and the one that has no obvious answer.
 *
 * A dog whose profile predates the field, or whose text a human typed straight in, has no
 * recorded author -- and the tense test applies to the attribution line exactly as it applies
 * to the paragraph. Guessing "the foster" there would be the same invention the line exists
 * to prevent.
 */
describe("attributionFor", () => {
  it("names the assistant, and says the foster approved it", () => {
    const { text, withdrawn } = attributionFor("agent");
    expect(text).toContain("Pawthway assistant");
    expect(withdrawn).toBe(false);
  });

  it("says a withdrawn profile is no longer a description", () => {
    const { text, withdrawn } = attributionFor("foster_withdrawn");
    expect(text).toContain("no longer a description");
    expect(withdrawn).toBe(true);
  });

  it("says the source is unrecorded rather than guessing one", () => {
    const { text, withdrawn } = attributionFor(undefined);
    expect(text).toBe("Source not recorded");
    expect(withdrawn).toBe(false);
  });
});
