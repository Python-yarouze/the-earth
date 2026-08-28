import { describe, expect, it } from "vitest";
import { makeCatalogBody } from "../src/game/catalog";
import { defaultProgress, isUnlocked } from "../src/game/progress";
import {
  buildShareUrl,
  decodeShare,
  decodeShareFromLocation,
  decodeSharePayload,
  encodeShare,
  encodeSharePayload,
  readSharePayload,
  shareableBodies,
} from "../src/game/share";
import { applyCircularOrbits } from "../src/physics/engine";
import { G } from "../src/physics/constants";
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
    const loaded = decodeShare(encodeShare(bodies));
    expect(loaded).not.toBeNull();
    expect(loaded!.map((b) => b.appearance).sort()).toEqual(["earth", "sun"]);
    const earth = loaded!.find((b) => b.kind === "earth")!;
    expect(earth.pos.x).toBeCloseTo(80.1, 5);
    expect(earth.pos.y).toBeCloseTo(3.4, 5);
    expect(earth.vel.x).toBe(0);
  });

  it("decodes from ?s= query (new format)", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeCatalogBody("mars", vec3(120, 2, -5)),
    ];
    const payload = encodeSharePayload(bodies);
    const loaded = decodeShareFromLocation({
      search: `?s=${payload}`,
      hash: "",
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.map((b) => b.appearance).sort()).toEqual(["earth", "mars", "sun"]);
  });

  it("prefers query over legacy hash when both exist", () => {
    resetBodyIds();
    const withMars = encodeSharePayload([
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeCatalogBody("mars", vec3(120, 0, 0)),
    ]);
    const earthOnly = encodeSharePayload([
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
    ]);
    const loaded = decodeShareFromLocation({
      search: `?s=${withMars}`,
      hash: `#s=${earthOnly}`,
    });
    expect(loaded!.some((b) => b.appearance === "mars")).toBe(true);
  });

  it("buildShareUrl uses query only", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
    ];
    const url = buildShareUrl(bodies, "https://example.test", "/the-earth/");
    expect(url).toMatch(/^https:\/\/example\.test\/the-earth\/\?s=/);
    expect(url).not.toContain("#");
    const payload = readSharePayload({ search: new URL(url).search, hash: "" });
    expect(decodeSharePayload(payload!)).not.toBeNull();
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

  it("does not unlock fantasy stones just because they appear in a share payload", () => {
    resetBodyIds();
    const progress = defaultProgress();
    expect(isUnlocked(progress, "gaming")).toBe(false);
    const loaded = decodeShare(
      encodeShare([
        makeCatalogBody("sun", vec3(0, 0, 0)),
        makeCatalogBody("earth", vec3(80, 0, 0)),
        makeCatalogBody("gaming", vec3(120, 0, 0)),
      ]),
    );
    expect(loaded!.some((b) => b.appearance === "gaming")).toBe(true);
    expect(isUnlocked(progress, "gaming")).toBe(false);
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

  it("preservePositions keeps a custom moon offset", () => {
    resetBodyIds();
    const bodies = [
      makeCatalogBody("sun", vec3(0, 0, 0)),
      makeCatalogBody("earth", vec3(80, 0, 0)),
      makeCatalogBody("moon", vec3(88, 4, -3)),
    ];
    const before = { ...bodies[2].pos };
    applyCircularOrbits(bodies, G, { preservePositions: true });
    expect(bodies[2].pos.x).toBeCloseTo(before.x, 5);
    expect(bodies[2].pos.y).toBeCloseTo(before.y, 5);
    expect(bodies[2].pos.z).toBeCloseTo(before.z, 5);
  });
});
