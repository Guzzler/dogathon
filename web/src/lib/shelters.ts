export interface Shelter {
  id: string; name: string; short: string; address: string; lat: number; lng: number;
}

/** Real SF-area rescues (+ Copper's Dream from the product spec) with approximate coords. */
export const SHELTERS: Shelter[] = [
  { id: "sfspca",    name: "SF SPCA Mission Campus",     short: "SF SPCA",       address: "201 Alabama St, San Francisco",    lat: 37.7663, lng: -122.4122 },
  { id: "acc",       name: "SF Animal Care & Control",   short: "SF ACC",        address: "1419 Bryant St, San Francisco",    lat: 37.7699, lng: -122.4128 },
  { id: "muttville", name: "Muttville Senior Dog Rescue",short: "Muttville",     address: "255 Alabama St, San Francisco",    lat: 37.7657, lng: -122.4133 },
  { id: "coppers",   name: "Copper's Dream Rescue",      short: "Copper's Dream",address: "3145 24th St, San Francisco",      lat: 37.7525, lng: -122.4160 },
  { id: "wonder",    name: "Wonder Dog Rescue",          short: "Wonder Dog",    address: "2926 16th St, San Francisco",      lat: 37.7650, lng: -122.4190 },
  { id: "familydog", name: "Family Dog Rescue",          short: "Family Dog",    address: "2601 Cesar Chavez, San Francisco", lat: 37.7488, lng: -122.4046 },
  { id: "rocket",    name: "Rocket Dog Rescue",          short: "Rocket Dog",    address: "1173 Sutter St, San Francisco",    lat: 37.7877, lng: -122.4184 },
  { id: "petsun",    name: "SF SPCA Pacific Heights",    short: "Pac Heights",   address: "2343 Fillmore St, San Francisco",  lat: 37.7908, lng: -122.4340 },
];

/** Dogs seeded without a shelter still need a pin, so fall back deterministically by id. */
export function shelterFor(shelterId: string | undefined, dogId: string): Shelter {
  const hit = SHELTERS.find(s => s.id === shelterId);
  if (hit) return hit;
  let h = 0;
  for (const ch of dogId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SHELTERS[h % SHELTERS.length];
}
