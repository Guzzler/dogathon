/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHELTERS, shelterFor } from "./shelters";

/**
 * Regression guard for RS-3: data/dogs.json's shelter_id has to resolve to an exact
 * SHELTERS match. A future rename on either side (shelters.ts's ids, or the importer's
 * CAMPUS["id"] in scripts/shelters/sfspca.py) that lets them drift apart again would
 * silently fall shelterFor() back to its per-dog hash across whatever's left in
 * SHELTERS -- the exact bug this fixed. Read via fs, not a static import: data/ sits
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
          `shelterFor() would silently fall back to the per-dog hash`,
      ).toBe(true);
    }
  });

  it("shelterFor() returns the exact match, given a real shelter_id", () => {
    for (const dog of dogs) {
      expect(shelterFor(dog.shelter_id, dog.id).id).toBe(dog.shelter_id);
    }
  });
});
