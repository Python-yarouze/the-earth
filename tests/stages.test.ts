import { describe, expect, it } from "vitest";
import { makeCatalogBody } from "../src/game/catalog";
import { canRemoveBody, initialBodies, STAGES } from "../src/game/stages";
import { vec3 } from "../src/physics/vec3";

describe("stages", () => {
  it("keeps sandbox as the playable entry among four stage defs", () => {
    expect(STAGES).toHaveLength(4);
    expect(STAGES[0].allowPlanets).toBe(false);
    expect(STAGES[2].maxPlanets).toBe(1);
    expect(STAGES[3].sandbox).toBe(true);
    expect(STAGES[3].id).toBe("sandbox");
  });

  it("starts every stage with one sun and one earth already in orbit", () => {
    const bodies = initialBodies(STAGES[0]);
    expect(bodies.map((b) => b.kind).sort()).toEqual(["earth", "sun"]);
    const earth = bodies.find((b) => b.kind === "earth");
    expect(earth).toBeDefined();
    expect(earth!.core).toBe(true);
    expect(bodies.find((b) => b.kind === "sun")!.core).toBe(true);
    expect(Math.hypot(earth!.vel.x, earth!.vel.y, earth!.vel.z)).toBeGreaterThan(10);
  });

  it("allows removing extra suns but not the core sun", () => {
    const bodies = initialBodies(STAGES[3]);
    const coreSun = bodies.find((b) => b.kind === "sun")!;
    const extraSun = makeCatalogBody("sun", vec3(120, 0, 0));
    expect(canRemoveBody(coreSun)).toBe(false);
    expect(canRemoveBody(extraSun)).toBe(true);
    expect(canRemoveBody(bodies.find((b) => b.kind === "earth")!)).toBe(false);
  });
});
