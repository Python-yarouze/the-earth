import { describe, expect, it } from "vitest";
import { createBody, resetBodyIds } from "../src/physics/body";
import { DT, G, SUN_MASS } from "../src/physics/constants";
import {
  accelerations,
  applyCircularOrbits,
  applySolarHeat,
  circularSpeed,
  step,
  totalEnergy,
  twoBodyCircular,
} from "../src/physics/engine";
import { resolveCollisions } from "../src/physics/collision";
import { dist, vec3 } from "../src/physics/vec3";

function sunAndEarth() {
  resetBodyIds();
  const sun = createBody({
    kind: "sun",
    appearance: "sun",
    mass: SUN_MASS,
    pos: vec3(0, 0, 0),
  });
  const earth = createBody({
    kind: "earth",
    appearance: "earth",
    mass: 1,
    pos: vec3(80, 0, 0),
  });
  return { sun, earth, bodies: [sun, earth] };
}

describe("n-body verlet", () => {
  it("keeps a two-body circular orbit near-constant radius and energy", () => {
    const { sun, earth, bodies } = sunAndEarth();
    const circ = twoBodyCircular(sun, earth);
    sun.vel = circ.sunVel;
    earth.vel = circ.planetVel;
    const r0 = dist(sun.pos, earth.pos);
    const e0 = totalEnergy(bodies);
    const period = (2 * Math.PI) / Math.sqrt((G * (sun.mass + earth.mass)) / r0 ** 3);
    const steps = Math.ceil((period * 4) / DT);
    let rMin = r0;
    let rMax = r0;
    for (let i = 0; i < steps; i++) {
      step(bodies);
      const r = dist(sun.pos, earth.pos);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    const e1 = totalEnergy(bodies);
    expect((rMax - rMin) / r0).toBeLessThan(0.04);
    expect(Math.abs(e1 - e0) / Math.abs(e0)).toBeLessThan(0.02);
    expect(earth.alive).toBe(true);
  });

  it("does not fall into the sun with a sideways circular velocity", () => {
    const { sun, earth, bodies } = sunAndEarth();
    const circ = twoBodyCircular(sun, earth);
    sun.vel = circ.sunVel;
    earth.vel = circ.planetVel;
    const r0 = dist(sun.pos, earth.pos);
    for (let i = 0; i < 60 * 8; i++) {
      step(bodies);
    }
    expect(dist(sun.pos, earth.pos)).toBeGreaterThan(r0 * 0.7);
    expect(dist(sun.pos, earth.pos)).toBeGreaterThan(sun.radius + earth.radius);
  });

  it("falls inward when initial velocity is zero", () => {
    const { sun, earth, bodies } = sunAndEarth();
    sun.vel = vec3();
    earth.vel = vec3();
    const r0 = dist(sun.pos, earth.pos);
    for (let i = 0; i < 60; i++) {
      step(bodies);
    }
    expect(dist(sun.pos, earth.pos)).toBeLessThan(r0 * 0.85);
  });
});

describe("applyCircularOrbits", () => {
  it("keeps a pre-placed earth from falling into the sun", () => {
    const { sun, earth, bodies } = sunAndEarth();
    applyCircularOrbits(bodies);
    expect(Math.hypot(earth.vel.x, earth.vel.y, earth.vel.z)).toBeGreaterThan(10);
    const r0 = dist(sun.pos, earth.pos);
    for (let i = 0; i < 60 * 12; i++) {
      step(bodies);
    }
    expect(dist(sun.pos, earth.pos)).toBeGreaterThan(r0 * 0.85);
    expect(dist(sun.pos, earth.pos)).toBeLessThan(r0 * 1.15);
    expect(earth.alive).toBe(true);
  });

  it("gives an inclined orbit when earth is off the equatorial plane", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: SUN_MASS,
      pos: vec3(0, 0, 0),
    });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 1,
      pos: vec3(80, 40, 0),
    });
    const bodies = [sun, earth];
    applyCircularOrbits(bodies);
    expect(Math.abs(earth.vel.z)).toBeGreaterThan(8);
    let yMax = 0;
    let zMax = 0;
    const r0 = dist(sun.pos, earth.pos);
    for (let i = 0; i < 60 * 12; i++) {
      step(bodies);
      yMax = Math.max(yMax, Math.abs(earth.pos.y));
      zMax = Math.max(zMax, Math.abs(earth.pos.z));
    }
    expect(yMax).toBeGreaterThan(20);
    expect(zMax).toBeGreaterThan(20);
    expect(dist(sun.pos, earth.pos)).toBeGreaterThan(r0 * 0.8);
    expect(earth.alive).toBe(true);
  });

  it("scales circular speed with gravity strength", () => {
    const r = 80;
    const v1 = circularSpeed(SUN_MASS, 1, r, G);
    const v2 = circularSpeed(SUN_MASS, 1, r, G * 4);
    expect(v2 / v1).toBeCloseTo(2, 5);
  });

  it("flips orbital tangent when orbitSign is retrograde", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: SUN_MASS,
      pos: vec3(0, 0, 0),
    });
    const pro = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 1,
      pos: vec3(80, 0, 0),
      orbitSign: 1,
    });
    const retro = createBody({
      kind: "planet",
      appearance: "contrarian",
      mass: 1,
      pos: vec3(80, 0, 0),
      orbitSign: -1,
    });
    applyCircularOrbits([sun, pro]);
    const vzPro = pro.vel.z;
    applyCircularOrbits([sun, retro]);
    expect(Math.sign(retro.vel.z)).toBe(-Math.sign(vzPro) || -1);
    expect(Math.abs(retro.vel.z)).toBeCloseTo(Math.abs(vzPro), 5);
  });
});

describe("earth moon", () => {
  it("keeps a nearby moon bound to earth instead of the sun", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: SUN_MASS,
      pos: vec3(0, 0, 0),
    });
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      size: 0.55,
      pos: vec3(80, 0, 0),
    });
    const moon = createBody({
      kind: "planet",
      appearance: "moon",
      mass: 0.012,
      size: 0.38,
      pos: vec3(80, 0, 5.2),
    });
    const bodies = [sun, earth, moon];
    applyCircularOrbits(bodies);
    for (let i = 0; i < 60 * 12; i++) {
      step(bodies);
      const ev = resolveCollisions(bodies);
      expect(ev?.kind).not.toBe("earth-lost");
    }
    expect(dist(moon.pos, earth.pos)).toBeGreaterThan(earth.radius + moon.radius);
    expect(dist(moon.pos, earth.pos)).toBeLessThan(12);
    expect(dist(moon.pos, earth.pos)).toBeLessThan(dist(moon.pos, sun.pos) * 0.35);
    expect(moon.alive).toBe(true);
    expect(earth.alive).toBe(true);
  });
});

describe("solar heat", () => {
  it("burns a body that sits on the sun", () => {
    resetBodyIds();
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: SUN_MASS,
      size: 0.72,
      pos: vec3(0, 0, 0),
    });
    const rock = createBody({
      kind: "planet",
      appearance: "mercury",
      mass: 0.06,
      size: 0.55,
      pos: vec3(sun.radius * 0.5, 0, 0),
    });
    const ev = applySolarHeat([sun, rock], DT);
    expect(ev?.kind).toBe("burn");
    expect(rock.alive).toBe(false);
  });

  it("spins earth with its catalog rate", () => {
    resetBodyIds();
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 12,
      spinRate: 0.55,
      obliquity: 0.4,
      pos: vec3(80, 0, 0),
    });
    const sun = createBody({
      kind: "sun",
      appearance: "sun",
      mass: SUN_MASS,
      pos: vec3(0, 0, 0),
    });
    const bodies = [sun, earth];
    applyCircularOrbits(bodies);
    const before = earth.spin;
    step(bodies, DT);
    expect(earth.spin).toBeGreaterThan(before);
    expect(earth.obliquity).toBeCloseTo(0.4, 5);
  });
});

describe("planet pair gravity", () => {
  it("applies mutual acceleration between free-play planets", () => {
    resetBodyIds();
    const a = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 8,
      pos: vec3(0, 0, 0),
    });
    const b = createBody({
      kind: "planet",
      appearance: "jupiter",
      mass: 48,
      pos: vec3(40, 20, 0),
    });
    const acc = accelerations([a, b]);
    expect(Math.hypot(acc[0]!.x, acc[0]!.y, acc[0]!.z)).toBeGreaterThan(0.01);
    expect(Math.hypot(acc[1]!.x, acc[1]!.y, acc[1]!.z)).toBeGreaterThan(0.01);
    expect(Math.sign(acc[0]!.x)).toBe(Math.sign(b.pos.x - a.pos.x) || 1);
  });
});
