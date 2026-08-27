import { describe, expect, it } from "vitest";
import { makeUnlockMeteor } from "../src/game/visitors";
import { resetBodyIds } from "../src/physics/body";
import { length } from "../src/physics/vec3";

describe("unlock meteor", () => {
  it("spawns an ephemeral visitor with the granted appearance", () => {
    resetBodyIds();
    const body = makeUnlockMeteor("jupiter");
    expect(body.appearance).toBe("jupiter");
    expect(body.ephemeral).toBe(true);
    expect(body.kind).toBe("planet");
    expect(body.mass).toBeLessThanOrEqual(0.85);
    expect(length(body.vel)).toBeGreaterThan(30);
  });
});
