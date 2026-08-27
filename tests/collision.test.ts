import { describe, expect, it } from "vitest";
import { createBody, radiusFromMass, resetBodyIds } from "../src/physics/body";
import { classifyCollision, resolveCollisions } from "../src/physics/collision";
import { vec3 } from "../src/physics/vec3";

describe("collisions", () => {
  it("merges low-speed non-earth bodies and conserves momentum", () => {
    resetBodyIds();
    const ra = radiusFromMass(4);
    const rb = radiusFromMass(2);
    const a = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 4,
      pos: vec3(0, 0),
      vel: vec3(2, 0),
    });
    const b = createBody({
      kind: "planet",
      appearance: "moon",
      mass: 2,
      pos: vec3(ra + rb - 0.2, 0),
      vel: vec3(-1, 0),
    });
    const px = a.mass * a.vel.x + b.mass * b.vel.x;
    const event = resolveCollisions([a, b]);
    expect(event?.kind).toBe("merge");
    const live = [a, b].filter((x) => x.alive);
    expect(live).toHaveLength(1);
    expect(live[0].mass).toBe(6);
    expect(live[0].vel.x * live[0].mass).toBeCloseTo(px, 5);
  });

  it("marks earth as lost when it hits anything", () => {
    resetBodyIds();
    const earth = createBody({
      kind: "earth",
      appearance: "earth",
      mass: 1,
      pos: vec3(0, 0),
    });
    const planet = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 3,
      pos: vec3(0.1, 0),
    });
    const event = resolveCollisions([earth, planet]);
    expect(event?.kind).toBe("earth-lost");
    expect(earth.alive).toBe(false);
  });

  it("classifies fast impacts as shatter", () => {
    resetBodyIds();
    const a = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 2,
      pos: vec3(0, 0),
      vel: vec3(80, 0),
    });
    const b = createBody({
      kind: "planet",
      appearance: "jupiter",
      mass: 2,
      pos: vec3(1, 0),
      vel: vec3(-80, 0),
    });
    expect(classifyCollision(a, b, 160)).toBe("shatter");
  });

  it("grows size on merge and shatters into debris", () => {
    resetBodyIds();
    const ra = radiusFromMass(4);
    const rb = radiusFromMass(2);
    const a = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 4,
      size: 0.7,
      pos: vec3(0, 0),
      vel: vec3(1, 0),
    });
    const b = createBody({
      kind: "planet",
      appearance: "moon",
      mass: 2,
      size: 0.5,
      pos: vec3(ra + rb - 0.2, 0),
      vel: vec3(-0.5, 0),
    });
    const sizeBefore = a.size;
    resolveCollisions([a, b]);
    expect(a.alive).toBe(true);
    expect(a.size).toBeGreaterThan(sizeBefore * 0.9);

    resetBodyIds();
    const fast = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 1,
      pos: vec3(0, 0),
      vel: vec3(100, 0),
    });
    const heavy = createBody({
      kind: "planet",
      appearance: "jupiter",
      mass: 10,
      pos: vec3(2, 0),
      vel: vec3(-100, 0),
    });
    const bodies = [fast, heavy];
    const ev = resolveCollisions(bodies);
    expect(ev?.kind).toBe("shatter");
    expect(bodies.filter((x) => x.ephemeral).length).toBeGreaterThanOrEqual(2);
  });

  it("promotes a heavy merge into a black hole", () => {
    resetBodyIds();
    const a = createBody({
      kind: "planet",
      appearance: "jupiter",
      mass: 900,
      pos: vec3(0, 0),
      vel: vec3(1, 0),
    });
    const b = createBody({
      kind: "planet",
      appearance: "saturn",
      mass: 700,
      pos: vec3(a.radius + 3, 0),
      vel: vec3(-1, 0),
    });
    resolveCollisions([a, b]);
    const live = [a, b].find((x) => x.alive)!;
    expect(live.appearance).toBe("blackhole");
    expect(live.mass).toBe(1600);
  });
});
