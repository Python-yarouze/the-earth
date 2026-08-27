import { describe, expect, it } from "vitest";
import { PLACEABLE_IDS } from "../src/game/catalog";
import { randomSandboxBodies } from "../src/game/randomize";
import { resetBodyIds } from "../src/physics/body";
import { length } from "../src/physics/vec3";

describe("randomSandboxBodies", () => {
  it("keeps sun and earth and scatters unlocked stones with orbital speed", () => {
    resetBodyIds();
    let i = 0;
    const seq = [0.1, 0.4, 0.7, 0.2, 0.9, 0.55, 0.33, 0.8, 0.15, 0.6, 0.25, 0.95];
    const rng = () => seq[i++ % seq.length]!;
    const bodies = randomSandboxBodies([...PLACEABLE_IDS], rng);
    expect(bodies.some((b) => b.kind === "sun")).toBe(true);
    expect(bodies.some((b) => b.kind === "earth")).toBe(true);
    expect(bodies.length).toBeGreaterThanOrEqual(5);
    expect(bodies.length).toBeLessThanOrEqual(8);
    const earth = bodies.find((b) => b.kind === "earth")!;
    expect(length(earth.vel)).toBeGreaterThan(5);
  });
});
