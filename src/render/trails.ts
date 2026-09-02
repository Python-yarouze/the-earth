import * as THREE from "three";
import type { Body } from "../physics/body";
import { physicsToWorld } from "./camera";

const MAX_POINTS = 720;

export class TrailField {
  private lines = new Map<number, THREE.Line>();
  private buffers = new Map<number, Float32Array>();
  private counts = new Map<number, number>();
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = "trails";
    scene.add(this.group);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  reset(): void {
    for (const line of this.lines.values()) {
      this.group.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.lines.clear();
    this.buffers.clear();
    this.counts.clear();
  }

  push(bodies: readonly Body[]): void {
    for (const b of bodies) {
      if (!b.alive) {
        continue;
      }
      let buf = this.buffers.get(b.id);
      let count = this.counts.get(b.id) ?? 0;
      if (!buf) {
        buf = new Float32Array(MAX_POINTS * 3);
        this.buffers.set(b.id, buf);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
        const color =
          b.kind === "earth"
            ? 0xb8d4ff
            : b.kind === "sun"
              ? 0xffc56a
              : 0x8a8f99;
        const mat = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: b.kind === "earth" ? 0.85 : 0.35,
        });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        this.lines.set(b.id, line);
        this.group.add(line);
      }
      const w = physicsToWorld(b.pos);
      if (count < MAX_POINTS) {
        buf[count * 3] = w.x;
        buf[count * 3 + 1] = w.y;
        buf[count * 3 + 2] = w.z;
        count += 1;
      } else {
        buf.copyWithin(0, 3);
        buf[(MAX_POINTS - 1) * 3] = w.x;
        buf[(MAX_POINTS - 1) * 3 + 1] = w.y;
        buf[(MAX_POINTS - 1) * 3 + 2] = w.z;
      }
      this.counts.set(b.id, count);
      const line = this.lines.get(b.id);
      if (line) {
        const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        attr.needsUpdate = true;
        // A 1-point line draws from (0,0,0) — wait until we have a segment.
        line.geometry.setDrawRange(0, count >= 2 ? count : 0);
      }
    }
  }
}
