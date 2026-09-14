import type { Dog } from "../types";

/**
 * Who wrote `dog.adoption_profile`, as one line (PH-21).
 *
 * The paragraph is the only thing in Pawthway a model writes *down* -- everything else it
 * produces is a chat turn that scrolls away. Unattributed it reads as the shelter's own
 * record, which is what this line exists to prevent, and three surfaces render it: the
 * foster's Post Foster page, the shared adoption link, and the shelter's roster. The wording
 * lives here rather than in each of them because three copies is exactly the incident
 * `design-consistency.md` was opened for (PR #11) -- the copy drifts, and then two screens
 * disagree about whether a model or a person wrote a sentence someone is deciding from.
 *
 * The renderer is `components/ProfileAttribution.tsx`; this half is pure so it can be tested
 * as the three-state decision it is.
 */
export function attributionFor(source: Dog["adoption_profile_source"]): {
  text: string;
  withdrawn: boolean;
} {
  if (source === "foster_withdrawn") {
    return {
      text: "Withdrawn by the foster — this is no longer a description of the dog",
      withdrawn: true,
    };
  }
  if (source === "agent") {
    return {
      text: "Drafted by the Pawthway assistant from the foster's journal, and approved by them",
      withdrawn: false,
    };
  }
  // Absent: the field predates `adoption_profile_source`, or a human typed it straight in.
  // "We don't know who wrote this" is the honest line -- guessing "the foster" would be the
  // same invention the tense test rules out everywhere else.
  return { text: "Source not recorded", withdrawn: false };
}
