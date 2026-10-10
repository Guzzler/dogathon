import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Dog } from "../../types";
import type { PublishedProfile } from "../../lib/adoptionProfiles";

/**
 * PH-32: the shared link shows what the foster *published*, and the same thing to everyone.
 *
 * Before this the view read the viewer's own foster document, so a recipient -- who can't read
 * it -- saw empty states written to the foster ("Care items you tick off..."), and the sender saw
 * a full page. Rendered with `renderToStaticMarkup`, as `MatchView.test.tsx` is.
 */

const state = vi.hoisted(() => ({ published: null as PublishedProfile | null }));

vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  LOCAL_MODE: false,
}));
vi.mock("../../firebase", () => ({ firebaseApp: null, firestore: null }));
vi.mock("../../hooks/useDogs", () => ({ useDogs: () => ({ dogs: [DOG], loading: false }) }));
vi.mock("../../lib/adoptionProfiles", () => ({
  usePublishedProfile: () => ({ published: state.published, loading: false }),
}));
// Must never be consulted on the published page -- the viewer's own journey is not the page.
vi.mock("../../hooks/useFoster", () => ({
  useFoster: () => { throw new Error("the shared page read the viewer's foster document"); },
  patchFoster: vi.fn(),
}));

const { PublicAdoptionView } = await import("./PublicAdoptionView");

const DOG: Dog = {
  id: "dog-1",
  name: "Juniper",
  breed: "Terrier mix",
  age_years: 2,
  status: "foster",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "Came in as a stray.",
  shelter_id: "sfspca-mission",
};

const render = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={["/adoption/dog-1"]}>
    <Routes><Route path="/adoption/:id" element={<PublicAdoptionView />} /></Routes>
  </MemoryRouter>,
);

const FOSTER_ADDRESSED = [
  "Care items you tick off",
  "worth writing",
  "photos added in the journal appear here too",
  "Every note and photo you add",
  "Nothing ticked off in the Care Plan yet",
];

describe("the shared adoption page (PH-32)", () => {
  it("shows reader empty states, and none of the foster's, when nothing is published", () => {
    state.published = null;
    const html = render();
    expect(html).toContain("No journal notes have been published for Juniper.");
    expect(html).toContain("The foster hasn&#x27;t written a note for adopters.");
    expect(html).toContain("No care has been published yet.");
    for (const s of FOSTER_ADDRESSED) expect(html).not.toContain(s);
    // The shelter's record is still there, live.
    expect(html).toContain("Came in as a stray.");
  });

  it("shows what the foster published", () => {
    state.published = {
      fosterId: "u1", applicationId: "a1", dogId: "dog-1", publishedAt: null,
      journalNotes: [{ date: "Day 2", text: "Sleeps through the night", starred: false, day: 2 }],
      photos: [], careDone: [{ label: "DHPP booster", kind: "vaccine", block: "Week 1" }],
      careOutstanding: 0, milestones: [],
      medical: { vaccines: ["DHPP booster"], medications: [], vetVisits: [] },
      weight: null, fosterNote: "A gentle soul.", tags: ["calm"], summary: "A calm dog.",
    };
    const html = render();
    expect(html).toContain("Sleeps through the night");
    expect(html).toContain("A gentle soul.");
    expect(html).toContain("DHPP booster");
    expect(html).toContain("A calm dog.");
    expect(html).not.toContain("No journal notes have been published");
  });
});
