import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Application, Dog } from "../../types";

/**
 * RS-17's two lines on the inbox, rendered. The writes are behind clicks and batch against real
 * Firestore, which is RS-14b's step (8); this covers what staff see before they press anything.
 * `renderToStaticMarkup`, matching `ShelterRosterView.test.tsx`.
 */

const state = vi.hoisted(() => ({ dogs: [] as Dog[], applications: [] as Application[] }));

vi.mock("../../hooks/useStaffShelters", () => ({
  useMyShelters: () => [{ id: "sfspca-mission", name: "SF SPCA Mission Campus", address: "", staffUids: [] }],
}));
vi.mock("../../hooks/useShelterApplications", () => ({
  useShelterApplications: () => ({ result: { state: "ready", applications: state.applications }, retry: vi.fn() }),
}));
vi.mock("../../hooks/useDogs", () => ({ useDogs: () => ({ dogs: state.dogs, loading: false }) }));
// Never reached -- the writes are behind a click -- but both modules import `firebase.ts`,
// which a clone with no `web/.env` cannot construct.
vi.mock("../../lib/applications", () => ({
  PICKUP_NOTE_MAX: 200,
  askForAnotherTime: vi.fn(),
  setApplicationChecklist: vi.fn(),
  setApplicationStatus: vi.fn(),
  setPickupConfirmed: vi.fn(),
}));
vi.mock("../../lib/shelterRoster", () => ({ relistDog: vi.fn() }));

const { ShelterApplicationsView } = await import("./ShelterApplicationsView");

const dog = (over: Partial<Dog> = {}): Dog => ({
  id: "d1",
  name: "Fern",
  breed: "Retriever",
  age_years: 2,
  status: "available",
  good_with_kids: null,
  good_with_dogs: null,
  notes: "",
  shelter_id: "sfspca-mission",
  ...over,
});

const stamp = { toMillis: () => 1 };

const application = (over: Partial<Application> = {}): Application =>
  ({
    id: "a1",
    fosterId: "u1",
    fosterName: "Robin",
    dogId: "d1",
    shelterId: "sfspca-mission",
    status: "approved",
    checklist: [],
    pickup: { date: "2026-10-03", time: "11:00", location: "SF SPCA Mission Campus" },
    pickupConfirmedAt: null,
    pickupDeclinedAt: null,
    pickupNote: null,
    createdAt: null,
    ...over,
  }) as Application;

const render = (d: Dog, a: Application) => {
  state.dogs = [d];
  state.applications = [a];
  return renderToStaticMarkup(<ShelterApplicationsView />);
};

describe("ShelterApplicationsView — the listing follows the handoff (RS-17)", () => {
  it("says beside Confirm pickup that a dog on medical hold stays that way", () => {
    const html = render(dog({ status: "medical_hold" }), application());
    expect(html).toContain("Confirm pickup");
    expect(html).toContain("Fern is marked medical hold");
    expect(html).toContain("confirming won");
  });

  it("says nothing extra for a listed dog", () => {
    expect(render(dog(), application())).not.toContain("confirming won");
  });

  it("tells staff a withdrawal after confirmation left the dog in foster, and offers List again", () => {
    const html = render(
      dog({ status: "foster" }),
      application({ status: "withdrawn", pickupConfirmedAt: stamp as Application["pickupConfirmedAt"] }),
    );
    expect(html).toContain("Robin withdrew after pickup was confirmed; Fern is still marked in");
    expect(html).toContain("List again");
  });

  it("stays quiet about a withdrawn application once the dog is listed again", () => {
    const html = render(
      dog(),
      application({ status: "withdrawn", pickupConfirmedAt: stamp as Application["pickupConfirmedAt"] }),
    );
    expect(html).not.toContain("withdrew after pickup");
    expect(html).not.toContain("List again");
  });
});

describe("ShelterApplicationsView — one dog, one confirmed pickup (RS-18)", () => {
  const confirmedA = () =>
    application({ id: "a1", fosterName: "Alex", pickupConfirmedAt: stamp as Application["pickupConfirmedAt"] });
  const liveB = () => application({ id: "b1", fosterName: "Blair", fosterId: "u2" });

  // The first row is the selected one, so the order picks whose detail renders.
  const renderAll = (apps: Application[]) => {
    state.dogs = [dog({ status: "foster" })];
    state.applications = apps;
    return renderToStaticMarkup(<ShelterApplicationsView />);
  };
  const detailOf = (html: string) => html.slice(html.indexOf("shelter__detail"));
  const rowOf = (html: string, name: string) => {
    const start = html.indexOf(`<strong>${name}</strong>`);
    return html.slice(start, html.indexOf("</button>", start));
  };

  it("offers B no Confirm pickup and says who has the dog instead", () => {
    const detail = detailOf(renderAll([liveB(), confirmedA()]));
    expect(detail).not.toContain("Confirm pickup");
    expect(detail).toContain("Fern is going home with");
    expect(detail).toContain(">Alex</button>");
    expect(detail).toContain("Decline this application, or take that confirmation back first.");
    expect(detail).not.toContain("confirming won");
    // Still answerable: another time, and the status controls.
    expect(detail).toContain("Ask for another time");
    expect(detail).toContain("Mark declined");
  });

  it("puts one pill on B's row, in place of Pickup requested", () => {
    const html = renderAll([liveB(), confirmedA()]);
    const row = rowOf(html, "Blair");
    expect(row).toContain("Dog placed with another foster");
    expect(row).not.toContain("Pickup requested");
    expect(rowOf(html, "Alex")).not.toContain("Dog placed with another foster");
  });

  it("leaves A's own detail unchanged", () => {
    const detail = detailOf(renderAll([confirmedA(), liveB()]));
    expect(detail).toContain("Undo confirmation");
    expect(detail).not.toContain("going home with");
  });

  it("frees the dog again once the holder withdraws", () => {
    const withdrawnA = application({
      id: "a1", fosterName: "Alex", status: "withdrawn", pickupConfirmedAt: stamp as Application["pickupConfirmedAt"],
    });
    const html = renderAll([liveB(), withdrawnA]);
    expect(detailOf(html)).toContain("Confirm pickup");
    expect(html).not.toContain("Dog placed with another foster");
  });
});
