import { describe, expect, it } from "vitest";
import { freqForBody } from "../src/audio/notes";
import { makeCatalogBody } from "../src/game/catalog";
import { vec3 } from "../src/physics/vec3";

describe("notes", () => {
  it("gives heavier bodies a lower pitch than lighter ones", () => {
    const heavy = makeCatalogBody("takoyaki", vec3(100, 0, 0));
    const light = makeCatalogBody("sparkle", vec3(100, 0, 0));
    expect(freqForBody(heavy)).toBeLessThan(freqForBody(light));
  });

  it("keeps the sun lower than a typical planet", () => {
    const sun = makeCatalogBody("sun", vec3(0, 0, 0));
    const mars = makeCatalogBody("mars", vec3(80, 0, 0));
    expect(freqForBody(sun)).toBeLessThan(freqForBody(mars));
  });
});
