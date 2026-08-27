import { describe, expect, it } from "vitest";
import { defaultProgress } from "../src/game/progress";
import {
  createVisitorClock,
  makeComet,
  makeMeteor,
  meteorGone,
  shouldSpawnComet,
} from "../src/game/visitors";
import { resetBodyIds } from "../src/physics/body";
import { vec3 } from "../src/physics/vec3";

describe("visitors", () => {
  it("spawns an ephemeral meteor that is not a shareable planet", () => {
    resetBodyIds();
    const meteor = makeMeteor();
    expect(meteor.kind).toBe("meteor");
    expect(meteor.ephemeral).toBe(true);
    expect(meteor.mass).toBeGreaterThan(0);
    meteor.pos = vec3(800, 0, 0);
    expect(meteorGone(meteor)).toBe(true);
  });

  it("does not spawn comets before shatter unlock", () => {
    const clock = createVisitorClock();
    clock.nextComet = 0;
    expect(shouldSpawnComet(100, true, clock, defaultProgress())).toBe(false);
    expect(
      shouldSpawnComet(100, true, clock, { ...defaultProgress(), shatters: 1 }),
    ).toBe(true);
    resetBodyIds();
    const comet = makeComet();
    expect(comet.appearance).toBe("comet");
    expect(comet.ephemeral).toBe(true);
  });
});
