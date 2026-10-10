import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Application, Dog, Foster } from "../../types";
import type { JournalEntry } from "../careplan/types";
import type { PublishedProfile } from "../../lib/adoptionProfiles";

/**
 * PH-32: publishing is explicit. The foster's page offers **Publish** until they have, **Publish
 * changes** once what they would publish differs from what is published, and nothing at all
 * until the shelter has confirmed their pickup -- the stamp `firestore.rules` checks.
 */

const state = vi.hoisted(() => ({
  journal: [] as JournalEntry[],
  published: null as PublishedProfile | null,
  application: null as Application | null,
}));

vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  LOCAL_MODE: false,
}));
vi.mock("../../firebase", () => ({ firebaseApp: null, firestore: null }));
vi.mock("../../hooks/useFoster", () => ({
  useFoster: () => ({ foster: FOSTER, loading: false }),
  patchFoster: vi.fn(),
}));
vi.mock("../../hooks/useDogs", () => ({ useDogs: () => ({ dogs: [DOG], loading: false }) }));
vi.mock("../../hooks/useCareLog", () => ({ useCareLog: () => ({ entries: [] }) }));
vi.mock("../../hooks/useJournal", () => ({
  useJournalEntries: () => state.journal,
  useCareScheduleBlocks: () => [],
}));
vi.mock("../../hooks/useApplication", () => ({
  useApplication: () => ({ application: state.application, loading: false }),
}));
vi.mock("../../lib/highlights", () => ({
  useAdoptionHighlights: () => ({ tags: [], summary: "", pending: false }),
}));
vi.mock("../../lib/adoptionProfiles", () => ({
  usePublishedProfile: () => ({ published: state.published, loading: false }),
  publishAdoptionProfile: vi.fn(),
  publishedDate: () => null,
}));
vi.mock("../../components/AgentChatPanel", () => ({ AgentChatPanel: () => null }));

// Node has no `window`; the view only reads `location.origin` for the share link.
vi.stubGlobal("window", {
  location: { origin: "https://pawthway.test" },
  addEventListener: () => {},
  removeEventListener: () => {},
});

const { PostFosterView } = await import("./PostFosterView");
const { buildAdoptionProfile, publishedPart } = await import("../../lib/adoption");
const { normalizeDog } = await import("../../lib/dog");

const DOG: Dog = {
  id: "dog-1",
  name: "Juniper",
  breed: "Terrier mix",
  age_years: 2,
  status: "foster",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
  shelter_id: "sfspca-mission",
};

const FOSTER = {
  id: "u1", name: "Sam", phase: "post_foster", intake: {}, likedDogIds: [], passedDogIds: [],
  matchedDogId: "dog-1", pickup: null, readyForAdoption: false,
} as unknown as Foster;

const CONFIRMED = {
  id: "a1", fosterId: "u1", dogId: "dog-1", shelterId: "sfspca-mission", status: "approved",
  pickupConfirmedAt: { seconds: 1 },
} as unknown as Application;

const note = (id: string, day: number, text: string): JournalEntry =>
  ({ id, createdAt: `Day ${day}`, dayInFoster: day, kind: "note", text, starred: false });

const publishButton = () => {
  const html = renderToStaticMarkup(<MemoryRouter><PostFosterView /></MemoryRouter>);
  return html.match(/<button[^>]*>(Publish|Publish changes|✓ Published[^<]*)<\/button>/)?.[0] ?? null;
};

describe("publishing the adoption page (PH-32)", () => {
  it("offers Publish to a confirmed foster who hasn't published", () => {
    state.application = CONFIRMED;
    state.journal = [note("j1", 1, "Settled in")];
    state.published = null;
    expect(publishButton()).toMatch(/>Publish<\/button>$/);
  });

  it("offers Publish changes after a journal edit", () => {
    state.application = CONFIRMED;
    const before = [note("j1", 1, "Settled in")];
    const part = publishedPart(buildAdoptionProfile(normalizeDog(DOG), FOSTER, [], before, []), [], "");
    state.published = { ...part, fosterId: "u1", applicationId: "a1", dogId: "dog-1", publishedAt: null };

    state.journal = before;
    expect(publishButton()).toContain("✓ Published");

    state.journal = [...before, note("j2", 2, "Learned sit")];
    expect(publishButton()).toMatch(/>Publish changes<\/button>$/);
  });

  it("offers nothing to publish, and says why, before the shelter confirms the pickup", () => {
    state.application = { ...CONFIRMED, pickupConfirmedAt: null } as Application;
    state.published = null;
    expect(publishButton()).toBeNull();
    const html = renderToStaticMarkup(<MemoryRouter><PostFosterView /></MemoryRouter>);
    expect(html).toMatch(/hasn&#x27;t confirmed your pickup, so this link shows only .*&#x27;s record/);
  });

  for (const status of ["declined", "withdrawn"] as const) {
    it(`offers nothing to publish on a ${status} application, stamp or not`, () => {
      state.application = { ...CONFIRMED, status } as Application;
      state.published = null;
      expect(publishButton()).toBeNull();
    });
  }
});
