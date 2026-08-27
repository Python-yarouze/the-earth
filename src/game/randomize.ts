import type { AppearanceId, Body } from "../physics/body";
import { applyCircularOrbits } from "../physics/engine";
import { dist, vec3 } from "../physics/vec3";
import { makeCatalogBody, PLACEABLE_IDS } from "./catalog";

function randRange(rng: () => number, a: number, b: number): number {
  return a + (b - a) * rng();
}

function pickCount(poolSize: number, rng: () => number): number {
  if (poolSize <= 0) {
    return 0;
  }
  const want = 3 + Math.floor(rng() * 4); // 3..6
  return Math.min(poolSize, want);
}

function scatterPos(bodies: readonly Body[], rng: () => number) {
  let pos = vec3(80, 0, 0);
  for (let attempt = 0; attempt < 32; attempt++) {
    const r = randRange(rng, 40, 220);
    const ang = rng() * Math.PI * 2;
    const y = randRange(rng, -40, 40);
    pos = vec3(Math.cos(ang) * r, y, Math.sin(ang) * r);
    const clear = bodies.every((b) => dist(b.pos, pos) > b.radius + 10);
    if (clear) {
      return pos;
    }
  }
  return pos;
}

/**
 * Keep a fresh sun + earth, then scatter 3–6 unlocked placeable stones
 * and assign Keplerian circular velocities.
 */
export function randomSandboxBodies(
  unlocked: readonly AppearanceId[],
  rng: () => number = Math.random,
): Body[] {
  const pool = PLACEABLE_IDS.filter((id) => unlocked.includes(id));
  const n = pickCount(pool.length, rng);
  const remaining = [...pool];
  const picked: AppearanceId[] = [];
  while (picked.length < n && remaining.length > 0) {
    const i = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(i, 1)[0]!);
  }

  const sun = makeCatalogBody("sun", vec3(0, 0, 0));
  const earth = makeCatalogBody("earth", vec3(80, 0, 0));
  const bodies: Body[] = [sun, earth];
  for (const id of picked) {
    bodies.push(makeCatalogBody(id, scatterPos(bodies, rng)));
  }
  applyCircularOrbits(bodies);
  return bodies;
}
