import { describe, expect, it } from "vitest";
import { solarSystemBodies } from "../src/game/solarsystem";
import { resolveCollisions } from "../src/physics/collision";
import { applySolarHeat, step } from "../src/physics/engine";
import { DT } from "../src/physics/constants";
import { dist } from "../src/physics/vec3";

describe("solar longevity", () => {
  it("survives three minutes with a smooth moon orbit", () => {
    const bodies = solarSystemBodies();
    const sun = bodies.find((b) => b.kind === "sun")!;
    const earth = bodies.find((b) => b.kind === "earth")!;
    const moon = bodies.find((b) => b.appearance === "moon")!;
    const r0 = dist(earth.pos, sun.pos);
    let rMin = r0;
    let rMax = r0;
    let moonMin = dist(moon.pos, earth.pos);
    let moonMax = moonMin;
    for (let i = 0; i < 60 * 180; i++) {
      step(bodies);
      applySolarHeat(bodies, DT);
      const ev = resolveCollisions(bodies);
      expect(ev?.kind).not.toBe("earth-lost");
      expect(earth.alive).toBe(true);
      expect(moon.alive).toBe(true);
      const mr = dist(moon.pos, earth.pos);
      moonMin = Math.min(moonMin, mr);
      moonMax = Math.max(moonMax, mr);
      expect(mr).toBeLessThan(14);
      const r = dist(earth.pos, sun.pos);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    expect((rMax - rMin) / r0).toBeLessThan(0.28);
    expect(moonMax - moonMin).toBeLessThan(7);
  });
});
