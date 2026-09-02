import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PerspectiveCamera } from "three";
import type { Body } from "../physics/body";
import type { FinaleState } from "../game/finale";
import { visualRadius } from "./bodies";
import { physicsToWorld } from "./camera";

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

/** Frame the sun, planets, and incoming destroyer along the approach axis. */
export function setupFinaleCamera(
  state: FinaleState,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bodies: readonly Body[] = [],
): void {
  const sunW = physicsToWorld(state.sunAnchor);
  const dir = state.approachDir;
  let maxR = 140;
  for (const body of bodies) {
    if (!body.alive || body.ephemeral) {
      continue;
    }
    const w = physicsToWorld(body.pos);
    const span = Math.hypot(w.x - sunW.x, w.y - sunW.y, w.z - sunW.z) + visualRadius(body);
    maxR = Math.max(maxR, span);
  }
  const dist = Math.min(920, Math.max(300, maxR * 2.35));
  const camX = sunW.x - dir.x * dist;
  const camY = sunW.y + Math.max(52, state.cameraHeight * (maxR / 180));
  const camZ = sunW.z - dir.z * dist;
  camera.position.set(camX, camY, camZ);
  controls.target.set(sunW.x, sunW.y, sunW.z);
  camera.lookAt(sunW.x, sunW.y, sunW.z);
  controls.update();
}

