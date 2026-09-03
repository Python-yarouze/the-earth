import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PerspectiveCamera } from "three";
import type { Body } from "../physics/body";
import {
  finaleHitRadius,
  finaleSunWindupShake,
  type FinaleState,
} from "../game/finale";
import { visualRadius } from "./bodies";
import { DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE, physicsToWorld } from "./camera";

export interface CinemaState {
  active: boolean;
  t: number;
  duration: number;
  cancelled: boolean;
}

export function createCinema(): CinemaState {
  return { active: false, t: 0, duration: 45, cancelled: false };
}

export function startCinema(state: CinemaState): void {
  state.active = true;
  state.t = 0;
  state.cancelled = false;
}

export function cancelCinema(state: CinemaState): void {
  state.active = false;
  state.cancelled = true;
}

/**
 * Slow look: sun → earth → outer. Returns true while driving the camera.
 * Call cancelCinema when the user starts dragging OrbitControls.
 */
export function tickCinema(
  state: CinemaState,
  dt: number,
  bodies: readonly Body[],
  camera: PerspectiveCamera,
  controls: OrbitControls,
): boolean {
  if (!state.active || state.cancelled) {
    return false;
  }
  state.t += dt;
  const u = Math.min(1, state.t / state.duration);
  const sun = bodies.find((b) => b.alive && b.kind === "sun");
  const earth = bodies.find((b) => b.alive && b.kind === "earth");
  const outer =
    bodies
      .filter((b) => b.alive && b.kind === "planet" && !b.ephemeral)
      .sort((a, b) => Math.hypot(b.pos.x, b.pos.z) - Math.hypot(a.pos.x, a.pos.z))[0] ?? earth;

  const sunW = sun ? physicsToWorld(sun.pos) : { x: 0, y: 0, z: 0 };
  const earthW = earth ? physicsToWorld(earth.pos) : { x: 80, y: 20, z: 0 };
  const outerW = outer ? physicsToWorld(outer.pos) : earthW;

  let focus = sunW;
  let dist = 220;
  let height = 70;
  if (u < 0.33) {
    const local = u / 0.33;
    focus = sunW;
    dist = 260 - local * 40;
    height = 90 - local * 20;
  } else if (u < 0.66) {
    const local = (u - 0.33) / 0.33;
    focus = {
      x: sunW.x + (earthW.x - sunW.x) * local,
      y: sunW.y + (earthW.y - sunW.y) * local,
      z: sunW.z + (earthW.z - sunW.z) * local,
    };
    dist = 220 - local * 80;
    height = 70 - local * 20;
  } else {
    const local = (u - 0.66) / 0.34;
    focus = {
      x: earthW.x + (outerW.x - earthW.x) * local,
      y: earthW.y + (outerW.y - earthW.y) * local,
      z: earthW.z + (outerW.z - earthW.z) * local,
    };
    dist = 140 + local * 100;
    height = 50 + local * 40;
  }

  controls.target.set(focus.x, focus.y, focus.z);
  const ang = state.t * 0.08;
  camera.position.set(
    focus.x + Math.cos(ang) * dist,
    focus.y + height,
    focus.z + Math.sin(ang) * dist,
  );
  camera.lookAt(focus.x, focus.y, focus.z);

  if (u >= 1) {
    state.active = false;
  }
  return state.active;
}

/**
 * Keep the player's camera pose at credits start; only widen clip / orbit limits
 * so the far-spawned destroyer stays in view without near-plane clipping.
 */
export function setupFinaleCamera(
  state: FinaleState,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bodies: readonly Body[] = [],
): void {
  const sunW = physicsToWorld(state.sunAnchor);
  let maxR = 140;
  let largestBodyR = 40;
  for (const body of bodies) {
    if (!body.alive || body.ephemeral) {
      continue;
    }
    const vr = visualRadius(body);
    largestBodyR = Math.max(largestBodyR, vr);
    const w = physicsToWorld(body.pos);
    const span = Math.hypot(w.x - sunW.x, w.y - sunW.y, w.z - sunW.z) + vr;
    maxR = Math.max(maxR, span);
  }
  const minDist = Math.max(DEFAULT_MIN_DISTANCE * 2.8, largestBodyR * 2.05);
  const currentDist = Math.max(controls.getDistance(), 1);
  // Do not raise minDistance above the live pose — that would shove the camera.
  controls.minDistance = Math.min(minDist, currentDist * 0.95);
  controls.maxDistance = Math.max(DEFAULT_MAX_DISTANCE, maxR * 3.2, 2800, currentDist * 1.05);
  camera.near = 0.08;
  camera.far = Math.max(10000, maxR * 8);
  camera.updateProjectionMatrix();
  controls.update();
}

/**
 * Keep the lens clear of the destroyer shell and apply a gentle wind-up shake
 * after sun contact (amplitude stays low to avoid motion sickness).
 */
export function updateFinaleCamera(
  state: FinaleState,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bodies: readonly Body[],
  elapsedWallMs: number,
): void {
  const destroyer = bodies.find((b) => b.id === state.destroyerId && b.alive);
  if (destroyer) {
    const dW = physicsToWorld(destroyer.pos);
    const need = finaleHitRadius(destroyer) * 1.85 + camera.near * 8;
    const offset = camera.position.clone().sub(dW);
    const sep = offset.length();
    if (sep < need && sep > 1e-4) {
      camera.position.copy(dW).addScaledVector(offset.normalize(), need);
      controls.target.lerp(physicsToWorld(state.sunAnchor), 0.02);
    }
  }

  const shake = finaleSunWindupShake(state);
  if (shake > 0) {
    const t = elapsedWallMs * 0.001;
    // Security-cam earthquake: irregular discrete jitter + high-freq grain.
    const amp = 0.55 + shake * 1.65;
    const bucket = Math.floor(elapsedWallMs / 18);
    const hash = (n: number) => {
      const x = Math.sin(bucket * 127.1 + n * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const jx = (hash(1) - 0.5) * 2 + Math.sin(t * 88) * 0.25;
    const jy = (hash(2) - 0.5) * 2 + Math.sin(t * 101 + 1.1) * 0.22;
    const jz = (hash(3) - 0.5) * 2 + Math.sin(t * 79 + 0.4) * 0.25;
    camera.position.x += jx * amp;
    camera.position.y += jy * amp * 0.7;
    camera.position.z += jz * amp;
    controls.target.x += jx * amp * 0.18;
    controls.target.y += jy * amp * 0.12;
    controls.target.z += jz * amp * 0.18;
  }
}
