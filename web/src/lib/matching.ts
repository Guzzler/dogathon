import { useEffect, useState } from "react";
import type { FosterIntake } from "../types";
import { ENERGY_WORD, sizeLabel, type RichDog } from "./dog";

const SIZE_POS = { small: 0, medium: 50, large: 100 } as const;

/**
 * Intake defaults, so a foster who skipped onboarding still gets sensible ordering.
 *
 * PH-24: until onboarding stopped writing both sliders unconditionally, the `??` arms here
 * were dead code -- every finished questionnaire supplied `pref_size` and `pref_energy`
 * whether or not the foster had touched either slider, so the defaults arrived downstream
 * as recorded answers instead of as fallbacks. They can now genuinely be absent, which is
 * what `sizeGiven` / `energyGiven` report: the number is still there for ordering, but a
 * caller printing it to the foster has to ask first whether anybody supplied it.
 */
export const prefs = (i: FosterIntake | undefined) => ({
  size: i?.pref_size ?? 50,
  energy: i?.pref_energy ?? 2,
  sizeGiven: i?.pref_size != null,
  energyGiven: i?.pref_energy != null,
  home: i?.pref_home,
  experience: i?.pref_experience,
  tags: i?.pref_tags ?? [],
});

const compat = (ok: boolean | null | undefined) => (ok == null ? -4 : ok ? 6 : -26);

/**
 * PH-22: the same three-way as `compat()`, one layer earlier.
 *
 * `compat()`'s unknown-is-not-a-no is this app's documented care about missing data, and it
 * only ever applied to the four fields `normalizeDog()` leaves alone. `d.size` and
 * `d.energyLevel` cannot be unknown by the time `scoreDog` sees them — the normaliser filled
 * them — and they feed the two largest terms in the whole score. So the unknown case has to be
 * read off `derived` instead, and it lands *slightly below* each term's midpoint: a recorded
 * good match should outrank an unknown, and an unknown should outrank a recorded mismatch.
 *
 * A score is a ranking, not an answer, so there is no "not recorded" state for the number
 * itself — only a stop to pretending its input was known.
 */
const UNKNOWN_SIZE = 0;    // term spans [-18, 22]
const UNKNOWN_ENERGY = -4; // term spans [-22, 22]

export function scoreDog(d: RichDog, intake: FosterIntake | undefined): number {
  const p = prefs(intake);
  // Each term compares two values, so either side being unrecorded makes the comparison
  // meaningless in the same way (PH-24). The dog's half comes off `derived`, the foster's off
  // whether onboarding actually wrote the field.
  const knownSize = !d.derived.size && p.sizeGiven;
  const knownEnergy = !d.derived.energyLevel && p.energyGiven;
  let s = 52;

  s += knownSize ? 22 - Math.abs(p.size - SIZE_POS[d.size]) * 0.4 : UNKNOWN_SIZE;
  s += knownEnergy ? 22 - Math.abs(p.energy - d.energyLevel) * 11 : UNKNOWN_ENERGY;

  // Every rule below is a claim about this specific dog ("too big for an apartment"), so each
  // one waits on its input actually having been recorded. Needs-based rules read `needsList`,
  // which the normaliser never invents, so they fire regardless.
  // These rules compare the dog against the *home* or the *experience level*, not against a
  // slider, so they wait only on the dog's half being recorded (PH-22) -- a foster who never
  // touched the size slider still lives in an apartment.
  const dogSize = !d.derived.size;
  const dogEnergy = !d.derived.energyLevel;
  if (p.home === "apartment") {
    if (dogSize && d.size === "large") s -= 14;
    if (dogEnergy && d.energyLevel >= 4) s -= 12;
    if (d.needsList.some(n => /yard|fence/i.test(n))) s -= 16;
  }
  if (p.home === "townhouse") {
    if (dogSize && d.size === "large") s -= 6;
    if (d.needsList.some(n => /yard|fence/i.test(n))) s -= 8;
  }
  if (p.home === "houseYard" && dogEnergy && d.energyLevel >= 3) s += 8;

  if (p.experience === "first" && dogEnergy) { if (d.energyLevel <= 1) s += 10; if (d.energyLevel >= 4) s -= 12; }
  if (p.experience === "experienced" && dogEnergy && d.energyLevel >= 3) s += 6;

  const t = p.tags;
  const isPuppy = d.age_years < 1;
  if (t.includes("puppy"))     s += isPuppy ? 18 : -20;
  if (t.includes("adult"))     s += isPuppy ? -14 : 6;
  // Same reasoning as compat(): unknown is not a mismatch, just no evidence either way.
  if (t.includes("groomLow"))  s += d.groomingLevel == null ? 0 : d.groomingLevel === "low" ? 10 : -12;
  if (t.includes("groomHigh")) s += d.groomingLevel === "high" ? 4 : 0;
  if (t.includes("coatShort")) s += d.coatLength == null ? 0 : d.coatLength === "short" ? 8 : -8;
  if (t.includes("coatLong"))  s += d.coatLength == null ? 0 : d.coatLength === "long" ? 8 : -8;
  // Three-way, and the middle case matters: real listings leave compatibility blank
  // constantly. Scoring unknown as a hard no would sink honest records below invented ones in
  // Discovery's ordering, making real data look emptier than invented data. (It is ranking,
  // not admission: this comment used to cite a `score >= 45` cutoff in DiscoveryView, and
  // there has never been one -- `DiscoveryView.tsx` filters on the search string only.)
  if (t.includes("kidsGood"))  s += compat(d.good_with_kids);
  if (t.includes("withDogs"))  s += compat(d.good_with_dogs);
  if (t.includes("withCats"))  s += compat(d.goodWithCats);

  return Math.max(4, Math.min(99, Math.round(s)));
}

/** The same inputs as scoreDog, in plain language, for the "Why you match" section. */
export function matchReasons(d: RichDog, intake: FosterIntake | undefined): string[] {
  const p = prefs(intake);
  // Both halves again (PH-24): "right in your size range" is a claim about a range the foster
  // picked, and an untouched slider never picked one.
  const knownSize = !d.derived.size && p.sizeGiven;
  const knownEnergy = !d.derived.energyLevel && p.energyGiven;
  const dogSize = !d.derived.size;
  const dogEnergy = !d.derived.energyLevel;
  const out: string[] = [];
  // Every line here is a sentence shown to the foster about this dog, so a derived input
  // produces no sentence at all -- "Zoomies energy, exactly the pace you picked" off a breed
  // regex is the plainest form of the defect PH-22 exists to remove. Saying nothing is the
  // honest output; `Unrecorded` is for a slot that was promised a value, and this list has none.
  if (knownSize && Math.abs(p.size - SIZE_POS[d.size]) <= 25) out.push(`${sizeLabel(d.size)} — right in your size range`);
  const de = Math.abs(p.energy - d.energyLevel);
  if (knownEnergy && de === 0) out.push(`${ENERGY_WORD[d.energyLevel]} energy, exactly the pace you picked`);
  else if (knownEnergy && de === 1) out.push(`${ENERGY_WORD[d.energyLevel]} energy, close to your pace`);
  if (p.home === "apartment" && dogSize && dogEnergy && d.size !== "large" && d.energyLevel <= 2) out.push("Settles well in an apartment");
  if (p.home === "houseYard" && dogEnergy && d.energyLevel >= 3) out.push("Would make full use of your yard");
  if (p.experience === "first" && dogEnergy && d.energyLevel <= 2) out.push("An easy first foster");
  const isPuppy = d.age_years < 1;
  if (p.tags.includes("puppy") && isPuppy) out.push("A puppy — matches what you asked for");
  if (p.tags.includes("adult") && !isPuppy) out.push("Grown adult — past the puppy chaos");
  if (p.tags.includes("groomLow") && d.groomingLevel === "low") out.push("Low-maintenance coat");
  if (p.tags.includes("kidsGood") && d.good_with_kids) out.push("Great with kids");
  if (p.tags.includes("withDogs") && d.good_with_dogs) out.push("Gets on with other dogs");
  if (p.tags.includes("withCats") && d.goodWithCats) out.push("Comfortable around cats");
  return out.slice(0, 4);
}

/* ---------- geo ---------- */
export const SF = { lat: 37.7749, lng: -122.4194 };

export function distanceMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useMyLocation() {
  const [pos, setPos] = useState(SF);
  const [real, setReal] = useState(false);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setReal(true); },
      () => { /* fall back to downtown SF */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }, []);
  return { pos, real };
}
