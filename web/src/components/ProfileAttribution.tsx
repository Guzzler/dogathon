import type { Dog } from "../types";
import { attributionFor } from "../lib/adoptionSource";

/**
 * One line saying who wrote `dog.adoption_profile`, and one class for it (PH-21).
 *
 * Anything that renders that paragraph renders this next to it -- see `lib/adoptionSource.ts`
 * for why the wording lives in one place. The withdrawn state is a data attribute rather than
 * a second class, for the same reason.
 */
export function ProfileAttribution({ source }: { source: Dog["adoption_profile_source"] }) {
  const { text, withdrawn } = attributionFor(source);
  return (
    <p className="profile-attrib" data-withdrawn={withdrawn || undefined}>
      {withdrawn ? "⚠️" : "✨"} {text}
    </p>
  );
}
