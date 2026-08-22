import { useEffect, useState } from "react";
import type { FosterIntake } from "../types";
import { ENERGY_WORD, sizeLabel, type RichDog } from "./dog";

const SIZE_POS = { small: 0, medium: 50, large: 100 } as const;

/** Intake defaults, so a foster who skipped onboarding still gets sensible ordering. */
export const prefs = (i: FosterIntake | undefined) => ({
  size: i?.pref_size ?? 50,
  energy: i?.pref_energy ?? 2,
  home: i?.pref_home,
  experience: i?.pref_experience,
  tags: i?.pref_tags ?? [],
});

export function scoreDog(d: RichDog, intake: FosterIntake | undefined): number {
  const p = prefs(intake);
  let s = 52;

  s += 22 - Math.abs(p.size - SIZE_POS[d.size]) * 0.4;
  s += 22 - Math.abs(p.energy - d.energyLevel) * 11;

  if (p.home === "apartment") {
    if (d.size === "large") s -= 14;
    if (d.energyLevel >= 4) s -= 12;
    if (d.needsList.some(n => /yard|fence/i.test(n))) s -= 16;
  }
  if (p.home === "townhouse") {
    if (d.size === "large") s -= 6;
    if (d.needsList.some(n => /yard|fence/i.test(n))) s -= 8;
  }
  if (p.home === "houseYard" && d.energyLevel >= 3) s += 8;

  if (p.experience === "first") { if (d.energyLevel <= 1) s += 10; if (d.energyLevel >= 4) s -= 12; }
  if (p.experience === "experienced" && d.energyLevel >= 3) s += 6;

  const t = p.tags;
  if (t.includes("groomLow"))  s += d.groomingLevel === "low" ? 10 : -12;
  if (t.includes("groomHigh")) s += d.groomingLevel === "high" ? 4 : 0;
  if (t.includes("coatShort")) s += d.coatLength === "short" ? 8 : -8;
  if (t.includes("coatLong"))  s += d.coatLength === "long" ? 8 : -8;
  if (t.includes("kidsGood"))  s += d.good_with_kids ? 6 : -26;
  if (t.includes("withDogs"))  s += d.good_with_dogs ? 6 : -26;
  if (t.includes("withCats"))  s += d.goodWithCats ? 6 : -26;

  return Math.max(4, Math.min(99, Math.round(s)));
}

/** The same inputs as scoreDog, in plain language, for the "Why you match" section. */
export function matchReasons(d: RichDog, intake: FosterIntake | undefined): string[] {
  const p = prefs(intake);
  const out: string[] = [];
  if (Math.abs(p.size - SIZE_POS[d.size]) <= 25) out.push(`${sizeLabel(d.size)} — right in your size range`);
  const de = Math.abs(p.energy - d.energyLevel);
  if (de === 0) out.push(`${ENERGY_WORD[d.energyLevel]} energy, exactly the pace you picked`);
  else if (de === 1) out.push(`${ENERGY_WORD[d.energyLevel]} energy, close to your pace`);
  if (p.home === "apartment" && d.size !== "large" && d.energyLevel <= 2) out.push("Settles well in an apartment");
  if (p.home === "houseYard" && d.energyLevel >= 3) out.push("Would make full use of your yard");
  if (p.experience === "first" && d.energyLevel <= 2) out.push("An easy first foster");
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
