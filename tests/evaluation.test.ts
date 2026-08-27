import { describe, expect, it } from "vitest";
import { createBody, resetBodyIds } from "../src/physics/body";
import { createStats, displayYears, evaluateFrame } from "../src/game/evaluation";
import { STABLE_SEC } from "../src/physics/constants";
import { vec3 } from "../src/physics/vec3";

describe("earth evaluation", () => {
  it("becomes balanced when earth stays at a steady distance", () => {
    resetBodyIds();
    const bodies = [
      createBody({ kind: "sun", appearance: "sun", mass: 1000, pos: vec3(0, 0, 0) }),
      createBody({
        kind: "earth",
        appearance: "earth",
        mass: 1,
        pos: vec3(80, 0, 0),
      }),
    ];
    let stats = createStats();
    const dt = 1 / 60;
    for (let i = 0; i < STABLE_SEC * 60; i++) {
      stats = evaluateFrame(bodies, stats, dt, null);
    }
    expect(stats.mood).toBe("balanced");
    expect(stats.everBalanced).toBe(true);
  });

  it("keeps simulating after collapse instead of ending the run", () => {
    resetBodyIds();
    const sun = createBody({ kind: "sun", appearance: "sun", mass: 1000, pos: vec3(0, 0, 0) });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 1,
      pos: vec3(sun.radius, 0, 0),
    });
    earth.alive = false;
    let stats = createStats();
    stats = evaluateFrame([sun, earth], stats, 1 / 60, "earth-lost");
    expect(stats.mood).toBe("collapsed");
    const t = stats.timeSec;
    stats = evaluateFrame([sun, earth], stats, 1 / 60, null);
    expect(stats.mood).toBe("collapsed");
    expect(stats.timeSec).toBeGreaterThan(t);
  });

  it("counts one year when earth completes a full revolution", () => {
    resetBodyIds();
    const sun = createBody({ kind: "sun", appearance: "sun", mass: 1000, pos: vec3(0, 0, 0) });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      pos: vec3(80, 0, 0),
    });
    const bodies = [sun, earth];
    let stats = createStats();
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      earth.pos = vec3(80 * Math.cos(a), 0, 80 * Math.sin(a));
      stats = evaluateFrame(bodies, stats, 1 / 60, null);
    }
    expect(stats.years).toBe(1);
    expect(displayYears(stats)).toBeGreaterThanOrEqual(1);
    expect(displayYears(stats)).toBeLessThan(1.05);
  });

  it("counts a year for retrograde winding as well", () => {
    resetBodyIds();
    const sun = createBody({ kind: "sun", appearance: "sun", mass: 1000, pos: vec3(0, 0, 0) });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      pos: vec3(80, 0, 0),
    });
    const bodies = [sun, earth];
    let stats = createStats();
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const a = -(i / steps) * Math.PI * 2;
      earth.pos = vec3(80 * Math.cos(a), 0, 80 * Math.sin(a));
      stats = evaluateFrame(bodies, stats, 1 / 60, null);
    }
    expect(stats.years).toBe(1);
  });
});
