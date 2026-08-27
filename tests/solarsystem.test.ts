import { describe, expect, it } from "vitest";
import { solarSystemBodies, SOLAR_ORBITS } from "../src/game/solarsystem";
import { resolveCollisions } from "../src/physics/collision";
import { step } from "../src/physics/engine";
import { cross, dist, length, vec3, type Vec3 } from "../src/physics/vec3";

function inclinationDeg(pos: Vec3, vel: Vec3): number {
  const L = cross(pos, vel);
  const mag = length(L);
  if (mag < 1e-12) {
    return 0;
  }
  const c = Math.max(-1, Math.min(1, L.y / mag));
  return (Math.acos(c) * 180) / Math.PI;
}

describe("solar system preset", () => {
  it("places mercury inside earth's orbit and neptune outside", () => {
    const mercury = SOLAR_ORBITS.find((o) => o.id === "mercury")!;
    const earth = SOLAR_ORBITS.find((o) => o.id === "earth")!;
    const neptune = SOLAR_ORBITS.find((o) => o.id === "neptune")!;
    expect(mercury.r).toBeLessThan(earth.r);
    expect(earth.r).toBeLessThan(neptune.r);

    const bodies = solarSystemBodies();
    const sun = bodies.find((b) => b.kind === "sun")!;
    const m = bodies.find((b) => b.appearance === "mercury")!;
    const e = bodies.find((b) => b.kind === "earth")!;
    expect(dist(m.pos, sun.pos)).toBeLessThan(dist(e.pos, sun.pos));
    expect(dist(e.pos, vec3())).toBeGreaterThan(90);
    const moon = bodies.find((b) => b.appearance === "moon")!;
    expect(dist(moon.pos, e.pos)).toBeLessThan(8);
  });

  it("tilts planets to match ecliptic inclinations", () => {
    const bodies = solarSystemBodies();
    const sun = bodies.find((b) => b.kind === "sun")!;
    const mercury = bodies.find((b) => b.appearance === "mercury")!;
    const earth = bodies.find((b) => b.kind === "earth")!;
    const moon = bodies.find((b) => b.appearance === "moon")!;

    const mercuryI = inclinationDeg(
      { x: mercury.pos.x - sun.pos.x, y: mercury.pos.y - sun.pos.y, z: mercury.pos.z - sun.pos.z },
      { x: mercury.vel.x - sun.vel.x, y: mercury.vel.y - sun.vel.y, z: mercury.vel.z - sun.vel.z },
    );
    const earthI = inclinationDeg(
      { x: earth.pos.x - sun.pos.x, y: earth.pos.y - sun.pos.y, z: earth.pos.z - sun.pos.z },
      { x: earth.vel.x - sun.vel.x, y: earth.vel.y - sun.vel.y, z: earth.vel.z - sun.vel.z },
    );
    const moonI = inclinationDeg(
      { x: moon.pos.x - earth.pos.x, y: moon.pos.y - earth.pos.y, z: moon.pos.z - earth.pos.z },
      { x: moon.vel.x - earth.vel.x, y: moon.vel.y - earth.vel.y, z: moon.vel.z - earth.vel.z },
    );

    const moonTilt = Math.min(moonI, 180 - moonI);

    expect(earthI).toBeLessThan(0.4);
    expect(mercuryI).toBeGreaterThan(6.5);
    expect(mercuryI).toBeLessThan(7.5);
    expect(moonTilt).toBeGreaterThan(4.6);
    expect(moonTilt).toBeLessThan(5.7);
    expect(Math.abs(mercury.pos.y)).toBeGreaterThan(Math.abs(earth.pos.y));
  });

  it("keeps the moon from hitting earth", () => {
    const bodies = solarSystemBodies();
    const earth = bodies.find((b) => b.kind === "earth")!;
    const moon = bodies.find((b) => b.appearance === "moon")!;
    const collideAt = earth.radius + moon.radius;
    let rMin = dist(moon.pos, earth.pos);
    for (let i = 0; i < 60 * 12; i++) {
      step(bodies);
      const ev = resolveCollisions(bodies);
      rMin = Math.min(rMin, dist(moon.pos, earth.pos));
      expect(ev?.kind).not.toBe("earth-lost");
      expect(earth.alive).toBe(true);
    }
    expect(rMin).toBeGreaterThan(collideAt);
    expect(dist(moon.pos, earth.pos)).toBeLessThan(12);
  });

  it("keeps compressed solar orbits from flying apart quickly", () => {
    const bodies = solarSystemBodies();
    const sun = bodies.find((b) => b.kind === "sun")!;
    const earth = bodies.find((b) => b.kind === "earth")!;
    const moon = bodies.find((b) => b.appearance === "moon")!;
    const r0 = dist(earth.pos, sun.pos);
    let rMin = r0;
    let rMax = r0;
    let moonMin = dist(moon.pos, earth.pos);
    let moonMax = moonMin;
    for (let i = 0; i < 60 * 90; i++) {
      step(bodies);
      resolveCollisions(bodies);
      const r = dist(earth.pos, sun.pos);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      const mr = dist(moon.pos, earth.pos);
      moonMin = Math.min(moonMin, mr);
      moonMax = Math.max(moonMax, mr);
      expect(earth.alive).toBe(true);
      expect(moon.alive).toBe(true);
    }
    expect((rMax - rMin) / r0).toBeLessThan(0.25);
    expect(rMin).toBeGreaterThan(r0 * 0.78);
    // Moon should orbit smoothly without teleport-like jumps.
    expect(moonMax - moonMin).toBeLessThan(6);
    expect(moonMax).toBeLessThan(12);
  });

  it("assigns faster orbital speed to closer planets (Kepler)", () => {
    const bodies = solarSystemBodies();
    const sun = bodies.find((b) => b.kind === "sun")!;
    const mercury = bodies.find((b) => b.appearance === "mercury")!;
    const earth = bodies.find((b) => b.kind === "earth")!;
    const neptune = bodies.find((b) => b.appearance === "neptune")!;
    const rel = (b: (typeof bodies)[number]) =>
      length({
        x: b.vel.x - sun.vel.x,
        y: b.vel.y - sun.vel.y,
        z: b.vel.z - sun.vel.z,
      });
    expect(rel(mercury)).toBeGreaterThan(rel(earth));
    expect(rel(earth)).toBeGreaterThan(rel(neptune));
  });
});
