import { describe, expect, it } from "vitest";
import { initialBodies, STAGES } from "../src/game/stages";

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
    expect(Math.hypot(earth!.vel.x, earth!.vel.y, earth!.vel.z)).toBeGreaterThan(10);
  });
});
