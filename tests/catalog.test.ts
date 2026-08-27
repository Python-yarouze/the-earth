import { describe, expect, it } from "vitest";
import {
  FANTASY_PLACEABLE_IDS,
  REAL_PLACEABLE_IDS,
  PLACEABLE_IDS,
  catalogEntry,
  makeCatalogBody,
} from "../src/game/catalog";
import { vec3 } from "../src/physics/vec3";

describe("catalog", () => {
  it("fixes mass per body type with jupiter heaviest and moon lightest among real planets", () => {
    expect(catalogEntry("jupiter").mass).toBeGreaterThan(catalogEntry("mars").mass);
    expect(catalogEntry("moon").mass).toBeLessThan(catalogEntry("mercury").mass);
    expect(catalogEntry("earth").mass).toBe(12);
    expect(catalogEntry("sun").mass).toBe(1000);
  });

  it("splits real and fantasy placeables without overlap", () => {
    expect(REAL_PLACEABLE_IDS).toHaveLength(10);
    expect(FANTASY_PLACEABLE_IDS).toHaveLength(21);
    expect(PLACEABLE_IDS).toHaveLength(31);
    const real = new Set(REAL_PLACEABLE_IDS);
    for (const id of FANTASY_PLACEABLE_IDS) {
      expect(real.has(id)).toBe(false);
      expect(catalogEntry(id).kind).toBe("planet");
    }
  });

  it("gives contrarian a retrograde orbit sign", () => {
    const b = makeCatalogBody("contrarian", vec3(100, 0, 0));
    expect(b.orbitSign).toBe(-1);
    expect(makeCatalogBody("mars", vec3(80, 0, 0)).orbitSign).toBe(1);
    expect(catalogEntry("snowball").spin).toBeLessThan(0);
  });
});
