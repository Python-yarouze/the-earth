import { describe, expect, it } from "vitest";
import { createBody, resetBodyIds } from "../src/physics/body";
import { TrailField } from "../src/render/trails";
import * as THREE from "three";
import { vec3 } from "../src/physics/vec3";

describe("TrailField", () => {
  it("does not draw a segment until two samples exist", () => {
    resetBodyIds();
    const scene = new THREE.Scene();
    const trails = new TrailField(scene);
    const body = createBody({
      kind: "planet",
      appearance: "mars",
      mass: 4,
      pos: vec3(80, 0, 0),
    });
    trails.push([body]);
    const line = scene.getObjectByName("trails")?.children[0] as THREE.Line | undefined;
    expect(line?.geometry.drawRange.count).toBe(0);
    body.pos.x = 82;
    trails.push([body]);
    expect(line?.geometry.drawRange.count).toBe(2);
  });
});
