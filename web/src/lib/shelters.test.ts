/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHELTERS, shelterFor, shelterName } from "./shelters";

/**
 * Regression guard for RS-3: data/dogs.json's shelter_id has to resolve to an exact
 * SHELTERS match. A future rename on either side (shelters.ts's ids, or the importer's
 * CAMPUS["id"] in scripts/shelters/sfspca.py) that lets them drift apart again would
 * silently resolve every real dog to no shelter at all -- and since PH-28, unlist it. Read via fs, not a static import: data/ sits
 * outside web/'s tsconfig "include", so importing it as a module would break `tsc -b`.
 */
const dogsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/dogs.json");
const dogs: Array<{ id: string; shelter_id?: string }> = JSON.parse(readFileSync(dogsPath, "utf-8"));

describe("data/dogs.json shelter_id matches web/src/lib/shelters.ts", () => {
  it("has real dogs to check against", () => {
    expect(dogs.length).toBeGreaterThan(0);
  });

  it("resolves every dog's shelter_id to an exact SHELTERS entry, not the hash fallback", () => {
    for (const dog of dogs) {
      expect(dog.shelter_id, `dog ${dog.id} has no shelter_id`).toBeTruthy();
      const exactMatch = SHELTERS.some(s => s.id === dog.shelter_id);
      expect(
        exactMatch,
        `dog ${dog.id}'s shelter_id "${dog.shelter_id}" has no exact id match in SHELTERS -- ` +
          `shelterFor() would return null and Discovery would stop listing it`,
      ).toBe(true);
    }
  });

  it("shelterFor() returns the exact match, given a real shelter_id", () => {
    for (const dog of dogs) {
      expect(shelterFor(dog.shelter_id)?.id).toBe(dog.shelter_id);
    }
  });
});

describe("a fallback may choose a pixel, never a name (PH-28)", () => {
  it("shelterFor() returns null for an id shelters.ts removed, and for an unknown one", () => {
    expect(shelterFor("petsun")).toBeNull();
    expect(shelterFor("no-such-rescue")).toBeNull();
    expect(shelterFor(undefined)).toBeNull();
  });

  it("no hash path is left to credit a dog to a real rescue", () => {
    const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "shelters.ts"), "utf-8");
    expect(src).not.toMatch(/SHELTERS\[h/);
  });

  it("shelterName() names a known org and says 'the shelter' otherwise", () => {
    const known = { shelter: { name: "SF SPCA Mission Campus", short: "SF SPCA" } };
    expect(shelterName(known)).toBe("SF SPCA");
    expect(shelterName(known, "name")).toBe("SF SPCA Mission Campus");
    expect(shelterName({ shelter: null })).toBe("the shelter");
    expect(shelterName({ shelter: null }, "name", { start: true })).toBe("The shelter");
    expect(shelterName(known, "short", { start: true })).toBe("SF SPCA");
  });
});
