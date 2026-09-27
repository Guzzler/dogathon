export interface Shelter {
  id: string; name: string; short: string; address: string; lat: number; lng: number;
}

// RS-3 (2026-08-25): id changed "sfspca" -> "sfspca-mission" to match the id every
// real dog in data/dogs.json actually carries (scripts/shelters/sfspca.py's CAMPUS["id"]),
// not the importer -- cheaper to fix here than to re-scrape and re-push the roster.
// "petsun" (SF SPCA Pacific Heights) removed: it's a second campus of this same
// organization, not a distinct one -- real-data-sourcing.md's own finding. "familydog"
// (Family Dog Rescue) removed: Yelp lists the SF location as closed at the address this
// app displayed, and the org's real site (ilovefamilydog.org) gives no address to
// replace it with -- see real-data-sourcing.md for both.
/** Real SF-area rescues (+ Copper's Dream from the product spec) with approximate coords. */
export const SHELTERS: Shelter[] = [
  { id: "sfspca-mission", name: "SF SPCA Mission Campus",     short: "SF SPCA",       address: "201 Alabama St, San Francisco", lat: 37.7663, lng: -122.4122 },
  { id: "acc",            name: "SF Animal Care & Control",   short: "SF ACC",        address: "1419 Bryant St, San Francisco", lat: 37.7699, lng: -122.4128 },
  { id: "muttville",      name: "Muttville Senior Dog Rescue",short: "Muttville",     address: "255 Alabama St, San Francisco", lat: 37.7657, lng: -122.4133 },
  { id: "coppers",        name: "Copper's Dream Rescue",      short: "Copper's Dream",address: "3145 24th St, San Francisco",   lat: 37.7525, lng: -122.4160 },
  { id: "wonder",         name: "Wonder Dog Rescue",          short: "Wonder Dog",    address: "2926 16th St, San Francisco",   lat: 37.7650, lng: -122.4190 },
  { id: "rocket",         name: "Rocket Dog Rescue",          short: "Rocket Dog",    address: "1173 Sutter St, San Francisco", lat: 37.7877, lng: -122.4184 },
];

/**
 * The org a `shelter_id` names, or `null` when it names none we know (PH-28).
 *
 * This used to hash an unknown id onto one of the entries above so every dog had a pin. That
 * hash fed no geometry-only reader: every site that reads `dog.shelter` prints a name, an
 * address, a distance or a sentence attributing a decision to that org — so an unknown id got
 * credited to a real rescue that had never heard of the dog. A fallback may choose a pixel,
 * never a name: an unknown org is absent, and a dog with no org is not listed.
 */
export function shelterFor(shelterId: string | undefined): Shelter | null {
  return SHELTERS.find(s => s.id === shelterId) ?? null;
}

/** Anything with an optional resolved shelter — a `RichDog`, in practice. */
type HasShelter = { shelter: Pick<Shelter, "name" | "short"> | null };

/**
 * The org's name for use **inside a sentence**, or "the shelter" when it has none. Never for a
 * labelled row: "Shelter: the shelter" is a stand-in dressed as an answer, and a row with no
 * value should be omitted instead.
 */
export function shelterName(
  dog: HasShelter,
  form: "short" | "name" = "short",
  { start = false }: { start?: boolean } = {},
): string {
  if (dog.shelter) return dog.shelter[form];
  return start ? "The shelter" : "the shelter";
}
