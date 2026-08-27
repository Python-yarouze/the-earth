import { describe, expect, it } from "vitest";
import { makeCatalogBody } from "../src/game/catalog";
import { decodeShare, encodeShare, shareableBodies } from "../src/game/share";
import { makeMeteor } from "../src/game/visitors";
import { resetBodyIds } from "../src/physics/body";
import { vec3 } from "../src/physics/vec3";

describe("share", () => {
  it("round-trips sun and earth positions without velocities", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80.14, 3.36, -12.2)),
    ];
    bodies[1].vel.x = 99;
    const hash = encodeShare(bodies);
    const loaded = decodeShare(hash);
    expect(loaded).not.toBeNull();
    expect(loaded!.map((b) => b.appearance).sort()).toEqual(["earth", "sun"]);
    const earth = loaded!.find((b) => b.kind === "earth")!;
    expect(earth.pos.x).toBeCloseTo(80.1, 5);
    expect(earth.pos.y).toBeCloseTo(3.4, 5);
    expect(earth.vel.x).toBe(0);
  });

  it("drops meteors from the shared payload", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeMeteor(),
    ];
    expect(shareableBodies(bodies).some((b) => b.kind === "meteor")).toBe(false);
    const loaded = decodeShare(encodeShare(bodies));
    expect(loaded!.some((b) => b.kind === "meteor")).toBe(false);
  });

  it("round-trips a fantasy stone in the share payload", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeCatalogBody("gaming", vec3(120, 5, -10)),
    ];
    const loaded = decodeShare(encodeShare(bodies));
    expect(loaded!.some((b) => b.appearance === "gaming")).toBe(true);
    expect(loaded!.find((b) => b.appearance === "gaming")!.orbitSign).toBe(1);
  });

  it("round-trips a discoball in the share payload", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeCatalogBody("discoball", vec3(110, 1, -4)),
    ];
    const loaded = decodeShare(encodeShare(bodies));
    expect(loaded!.some((b) => b.appearance === "discoball")).toBe(true);
  });
});
