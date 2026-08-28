import { makeCatalogBody } from "./catalog";
import type { Body } from "../physics/body";
import { length, normalize, scale, sub, vec3 } from "../physics/vec3";

export const FINALE_DURATION_SEC = 105;

export interface FinaleState {
  active: boolean;
  elapsed: number;
  destroyerId: number | null;
  creditsDone: boolean;
}

export function createFinale(): FinaleState {
  return { active: false, elapsed: 0, destroyerId: null, creditsDone: false };
}

/** Spawn the destroyer far from the system barycenter. */
export function spawnDestroyer(bodies: readonly Body[]): Body {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let n = 0;
  for (const b of bodies) {
    if (!b.alive || b.ephemeral) {
      continue;
    }
    cx += b.pos.x;
    cy += b.pos.y;
    cz += b.pos.z;
    n += 1;
  }
  if (n > 0) {
    cx /= n;
    cy /= n;
    cz /= n;
  }
  const center = vec3(cx, cy, cz);
  const spawn = vec3(cx + 520, cy + 40, cz + 180);
  const d = makeCatalogBody("destroyer", spawn);
  const dir = normalize(sub(center, spawn));
  d.vel = scale(dir, 8);
  d.peerGravity = false;
  return d;
}

export function tickFinale(state: FinaleState, dt: number, destroyer: Body | undefined, target: Body | undefined): void {
  if (!state.active) {
    return;
  }
  state.elapsed += dt;
  if (destroyer && target) {
    const to = sub(target.pos, destroyer.pos);
    const dist = length(to);
    if (dist > 1e-3) {
      const dir = normalize(to);
      const accel = 2.4 + 18 / Math.max(dist, 40);
      destroyer.vel.x += dir.x * accel * dt;
      destroyer.vel.y += dir.y * accel * dt;
      destroyer.vel.z += dir.z * accel * dt;
      const speed = length(destroyer.vel);
      const cap = 42 + state.elapsed * 0.35;
      if (speed > cap) {
        const s = cap / speed;
        destroyer.vel.x *= s;
        destroyer.vel.y *= s;
        destroyer.vel.z *= s;
      }
    }
  }
  if (state.elapsed >= FINALE_DURATION_SEC) {
    state.creditsDone = true;
  }
}

export function finaleProgress(state: FinaleState): number {
  return Math.min(1, state.elapsed / FINALE_DURATION_SEC);
}

export const CREDITS_LINES: readonly string[] = [
  "THE EARTH",
  "",
  "ドヴォルザーク「新世界より」",
  "Antonín Dvořák — Symphony No. 9",
  "",
  "テクスチャ — Solar System Scope (CC BY 4.0)",
  "書体 — Instrument Serif / IBM Plex Sans",
  "",
  "あなたが組んだ太陽系へ、ありがとう。",
];
