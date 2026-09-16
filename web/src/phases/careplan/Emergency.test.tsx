import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Emergency } from "./Emergency";
import { emergencyContacts } from "./data";
import type { DogProfile, EmergencyContact } from "./types";

/**
 * PH-18, as what a foster actually sees.
 *
 * The two defects this locks down are both invisible to a type checker: the poison quick-action
 * had *never rendered once* (it was resolved with `/poison/i.test(c.role)` and neither national
 * line's role is the word "poison"), and deleting the invented vet row would, on its own, have
 * promoted Pet Poison Helpline into a card headed "Nearest 24-hour vet" with a *Call Vet Now*
 * button — because the old fallback was `?? contacts[0]`.
 *
 * `renderToStaticMarkup` rather than a DOM library, matching `ShelterRosterView.test.tsx` and
 * `MatchView.test.tsx`: this asserts what is on the page, not what happens when you click it.
 */

const dog: DogProfile = {
  id: "d1",
  name: "Tip Toe",
  breed: "Retriever",
  ageMonths: 24,
  weightLbs: null,
  pickupDate: "2026-09-01",
  careNeeds: [],
  backstory: "",
  shelter: { name: "Muttville Senior Dog Rescue", address: "255 Alabama St, San Francisco" },
};

const vet: EmergencyContact = {
  name: "Some 24h Hospital",
  role: "Nearest 24h emergency",
  kind: "vet",
  phone: "(415) 000-0000",
  distanceMi: 1.2,
  hours: "Open now · 24 hrs",
};

describe("the shipped contact list", () => {
  it("carries no local rows at all — every entry is a national poison line", () => {
    expect(emergencyContacts.every((c) => c.kind === "poison")).toBe(true);
    expect(emergencyContacts.map((c) => c.name)).toEqual([
      "Pet Poison Helpline",
      "ASPCA Animal Poison Control",
    ]);
  });

  it("states no distance, because nothing computes one", () => {
    expect(emergencyContacts.some((c) => c.distanceMi != null)).toBe(false);
  });
});

describe("Emergency, with the roster as shipped", () => {
  const html = renderToStaticMarkup(<Emergency dog={dog} contacts={emergencyContacts} />);

  it("promotes no contact into the nearest-vet card", () => {
    expect(html).not.toContain("Nearest 24-hour vet");
    expect(html).not.toContain("Call Vet Now");
    expect(html).toContain("No 24-hour vet on file");
  });

  it("renders both poison lines as quick actions rather than as ghost rows at the bottom", () => {
    expect(html).toContain("Pet Poison Helpline");
    expect(html).toContain("ASPCA Animal Poison Control");
    expect(html).not.toContain("Other contacts");
    expect(html).toContain('href="tel:8557647661"');
    expect(html).toContain('href="tel:8884264435"');
  });

  it("names the shelter the dog actually came from, with no call action", () => {
    expect(html).toContain("Muttville Senior Dog Rescue");
    expect(html).toContain("255 Alabama St, San Francisco");
    expect(html).not.toContain("Copper's Dream Rescue");
  });

  it("draws no map and invents no travel time", () => {
    expect(html).not.toContain("Presidio Park");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("4 min");
  });

  it("says Not recorded for a weight nobody took", () => {
    expect(html).toContain("Not recorded");
  });
});

describe("Emergency, once a real vet row exists", () => {
  const html = renderToStaticMarkup(
    <Emergency dog={dog} contacts={[vet, ...emergencyContacts]} />,
  );

  it("headlines it, and only it", () => {
    expect(html).toContain("Nearest 24-hour vet");
    expect(html).toContain("Some 24h Hospital");
    expect(html).toContain("1.2 mi away");
    expect(html).not.toContain("No 24-hour vet on file");
  });

  it("still keeps the poison lines out of Other contacts", () => {
    expect(html).not.toContain("Other contacts");
  });
});

describe("Emergency, with a contact it has no category slot for", () => {
  const html = renderToStaticMarkup(
    <Emergency
      dog={dog}
      contacts={[
        ...emergencyContacts,
        { name: "A Shelter Line", role: "Foster coordinator", kind: "shelter", phone: "(415) 111-2222" },
      ]}
    />,
  );

  it("falls through to Other contacts without displacing anything", () => {
    expect(html).toContain("Other contacts");
    expect(html).toContain("A Shelter Line");
    expect(html).toContain("No 24-hour vet on file");
  });
});
