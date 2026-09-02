import { applyRadius, Body } from "./body";
import {
  CLOSE_APPROACH_FACTOR,
  DT,
  G,
  MAX_SUBSTEPS,
  PLANET_PAIR_FACTOR,
  SOFTENING,
  SUN_BURN_FACTOR,
  SUN_HEAT_FACTOR,
} from "./constants";
import { add, cross, dist, distSq, dot, length, lengthSq, normalize, scale, sub, type Vec3, vec3 } from "./vec3";

const EPS2 = SOFTENING * SOFTENING;
const WORLD_UP = vec3(0, 1, 0);

function isCentral(body: Body): boolean {
  return body.kind === "sun" || body.appearance === "blackhole";
}

function pairScale(
  a: Body,
  b: Body,
  earth: Body | undefined,
  sun: Body | undefined,
): number | null {
  if (isCentral(a) || isCentral(b)) {
    const moon = a.appearance === "moon" ? a : b.appearance === "moon" ? b : null;
    const central = isCentral(a) ? a : b;
    if (moon && earth && central.kind === "sun" && isEarthMoon(moon, earth, sun)) {
      // Hierarchical satellite: ignore solar tide while bound (smooth Earth orbit).
      return null;
    }
    return 1;
  }
  // Earth–moon always full strength (natural satellite motion).
  if (a.appearance === "moon" || b.appearance === "moon") {
    return 1;
  }
  if (!a.peerGravity || !b.peerGravity) {
    return null;
  }
  return PLANET_PAIR_FACTOR;
}

export function accelerations(
  bodies: readonly Body[],
  g = G,
  opts?: { skipEphemeral?: boolean },
): Vec3[] {
  const n = bodies.length;
  const acc = Array.from({ length: n }, () => vec3());
  const earth = bodies.find((b) => b.alive && b.kind === "earth");
  const sun = bodies.find((b) => b.alive && b.kind === "sun");
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (!a.alive || a.mass <= 0) {
      continue;
    }
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      if (!b.alive || b.mass <= 0) {
        continue;
      }
      if (opts?.skipEphemeral && (a.ephemeral || b.ephemeral)) {
        continue;
      }
      const pair = pairScale(a, b, earth, sun);
      if (pair === null) {
        continue;
      }
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const dz = b.pos.z - a.pos.z;
      const r2 = dx * dx + dy * dy + dz * dz + EPS2;
      const inv = 1 / Math.sqrt(r2);
      const inv3 = inv * inv * inv;
      const ax = g * dx * inv3 * pair;
      const ay = g * dy * inv3 * pair;
      const az = g * dz * inv3 * pair;
      acc[i].x += ax * b.mass;
      acc[i].y += ay * b.mass;
      acc[i].z += az * b.mass;
      acc[j].x -= ax * a.mass;
      acc[j].y -= ay * a.mass;
      acc[j].z -= az * a.mass;
    }
  }
  // Bound moons skip direct sun pull, so copy Earth's solar acceleration.
  // That keeps a smooth Earth-centered orbit without tidal unbinding.
  if (earth && sun && earth.alive && sun.alive) {
    const dx = sun.pos.x - earth.pos.x;
    const dy = sun.pos.y - earth.pos.y;
    const dz = sun.pos.z - earth.pos.z;
    const r2 = dx * dx + dy * dy + dz * dz + EPS2;
    const inv = 1 / Math.sqrt(r2);
    const inv3 = inv * inv * inv;
    const aex = g * dx * inv3 * sun.mass;
    const aey = g * dy * inv3 * sun.mass;
    const aez = g * dz * inv3 * sun.mass;
    for (let i = 0; i < n; i++) {
      const moon = bodies[i];
      if (!isEarthMoon(moon, earth, sun)) {
        continue;
      }
      acc[i].x += aex;
      acc[i].y += aey;
      acc[i].z += aez;
    }
  }
  return acc;
}

function syncMoonSpin(bodies: readonly Body[], dt: number): void {
  const earth = bodies.find((b) => b.alive && b.kind === "earth");
  const sun = bodies.find((b) => b.alive && b.kind === "sun");
  if (!earth) {
    return;
  }
  for (const moon of bodies) {
    if (!isEarthMoon(moon, earth, sun)) {
      continue;
    }
    const rVec = sub(moon.pos, earth.pos);
    const r = length(rVec);
    if (r < 1e-6) {
      continue;
    }
    const rel = sub(moon.vel, earth.vel);
    // Tidal lock: face Earth; spin rate matches orbital angular speed.
    const omega = length(cross(rVec, rel)) / (r * r);
    moon.spinRate = omega;
    moon.spin += omega * dt;
  }
}

function applyVerlet(bodies: Body[], dt: number, g: number): void {
  const a0 = accelerations(bodies, g);
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.alive) {
      continue;
    }
    b.vel.x += a0[i].x * dt * 0.5;
    b.vel.y += a0[i].y * dt * 0.5;
    b.vel.z += a0[i].z * dt * 0.5;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;
    if (b.appearance !== "moon") {
      b.spin += dt * b.spinRate;
    }
  }
  syncMoonSpin(bodies, dt);
  const a1 = accelerations(bodies, g);
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.alive) {
      continue;
    }
    b.vel.x += a1[i].x * dt * 0.5;
    b.vel.y += a1[i].y * dt * 0.5;
    b.vel.z += a1[i].z * dt * 0.5;
  }
}

function needsSubsteps(bodies: readonly Body[]): number {
  let minSep = Infinity;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (!a.alive) {
      continue;
    }
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (!b.alive) {
        continue;
      }
      const sep = dist(a.pos, b.pos) / (a.radius + b.radius);
      if (sep < minSep) {
        minSep = sep;
      }
    }
  }
  if (minSep < CLOSE_APPROACH_FACTOR) {
    const extra = Math.ceil((CLOSE_APPROACH_FACTOR / Math.max(minSep, 0.15)) * 2);
    return Math.min(MAX_SUBSTEPS, Math.max(2, extra));
  }
  return 1;
}

export function step(bodies: Body[], dt = DT, g = G): void {
  const n = needsSubsteps(bodies);
  const sub = dt / n;
  for (let i = 0; i < n; i++) {
    applyVerlet(bodies, sub, g);
  }
}

/** Finale step: debris flies ballistically (no gravity) while planets keep orbiting. */
function applyVerletFinale(bodies: Body[], dt: number, g: number): void {
  const a0 = accelerations(bodies, g, { skipEphemeral: true });
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.alive) {
      continue;
    }
    if (b.ephemeral) {
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.pos.z += b.vel.z * dt;
      b.spin += dt * b.spinRate;
      continue;
    }
    b.vel.x += a0[i].x * dt * 0.5;
    b.vel.y += a0[i].y * dt * 0.5;
    b.vel.z += a0[i].z * dt * 0.5;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;
    if (b.appearance !== "moon") {
      b.spin += dt * b.spinRate;
    }
  }
  syncMoonSpin(bodies, dt);
  const a1 = accelerations(bodies, g, { skipEphemeral: true });
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.alive || b.ephemeral) {
      continue;
    }
    b.vel.x += a1[i].x * dt * 0.5;
    b.vel.y += a1[i].y * dt * 0.5;
    b.vel.z += a1[i].z * dt * 0.5;
  }
}

export function stepFinale(bodies: Body[], dt = DT, g = G): void {
  const n = needsSubsteps(bodies);
  const sub = dt / n;
  for (let i = 0; i < n; i++) {
    applyVerletFinale(bodies, sub, g);
  }
}

/** Heat and burn bodies that skim the sun. Returns a burn event if something is lost. */
export function applySolarHeat(
  bodies: Body[],
  dt = DT,
): { kind: "burn" | "earth-lost"; pos: Vec3; aId: number; bId: number; relSpeed: number } | null {
  const sun = bodies.find((b) => b.alive && b.kind === "sun");
  if (!sun) {
    return null;
  }
  const heatR = sun.radius * SUN_HEAT_FACTOR;
  const burnR = sun.radius * SUN_BURN_FACTOR;
  for (const b of bodies) {
    if (!b.alive || b.id === sun.id || b.appearance === "blackhole") {
      continue;
    }
    const r = dist(b.pos, sun.pos);
    if (r >= heatR) {
      continue;
    }
    if (r < burnR) {
      const earthLost = b.kind === "earth";
      b.alive = false;
      return {
        kind: earthLost ? "earth-lost" : "burn",
        pos: { x: b.pos.x, y: b.pos.y, z: b.pos.z },
        aId: sun.id,
        bId: b.id,
        relSpeed: length(sub(b.vel, sun.vel)),
      };
    }
    // Ablate mass while in the heat shell
    const t = (heatR - r) / Math.max(1e-6, heatR - burnR);
    const loss = b.mass * t * t * 0.35 * dt;
    b.mass = Math.max(0.002, b.mass - loss);
    if (b.mass <= 0.0025 && t > 0.85) {
      const earthLost = b.kind === "earth";
      b.alive = false;
      return {
        kind: earthLost ? "earth-lost" : "burn",
        pos: { x: b.pos.x, y: b.pos.y, z: b.pos.z },
        aId: sun.id,
        bId: b.id,
        relSpeed: length(sub(b.vel, sun.vel)),
      };
    }
    applyRadius(b);
  }
  return null;
}

export function kineticEnergy(bodies: readonly Body[]): number {
  let e = 0;
  for (const b of bodies) {
    if (!b.alive) {
      continue;
    }
    e += 0.5 * b.mass * lengthSq(b.vel);
  }
  return e;
}

export function potentialEnergy(bodies: readonly Body[], g = G): number {
  let e = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (!a.alive) {
      continue;
    }
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (!b.alive) {
        continue;
      }
      const r = Math.sqrt(distSq(a.pos, b.pos) + EPS2);
      e -= (g * a.mass * b.mass) / r;
    }
  }
  return e;
}

export function totalEnergy(bodies: readonly Body[], g = G): number {
  return kineticEnergy(bodies) + potentialEnergy(bodies, g);
}

/** Relative circular-orbit speed for two masses separated by r. */
export function circularSpeed(m1: number, m2: number, r: number, g = G): number {
  return Math.sqrt((g * (m1 + m2)) / r);
}

/** Tangent for a circular orbit: world-up × r, so height tilts the orbital plane. */
export function orbitalTangent(r: Vec3): Vec3 {
  let t = cross(WORLD_UP, r);
  if (length(t) < 1e-8) {
    t = cross(vec3(1, 0, 0), r);
  }
  if (length(t) < 1e-8) {
    return vec3(0, 0, 1);
  }
  return normalize(t);
}

export function twoBodyCircular(
  sun: Body,
  planet: Body,
  g = G,
  planeNormal?: Vec3,
): { sunVel: Vec3; planetVel: Vec3 } {
  const rVec = sub(planet.pos, sun.pos);
  const r = length(rVec);
  if (r < 1e-6) {
    return { sunVel: vec3(), planetVel: vec3() };
  }
  const vRel = circularSpeed(sun.mass, planet.mass, r, g);
  let t = planeNormal ? cross(planeNormal, rVec) : orbitalTangent(rVec);
  if (length(t) < 1e-8) {
    t = orbitalTangent(rVec);
  } else {
    t = normalize(t);
  }
  const total = sun.mass + planet.mass;
  return {
    sunVel: scale(t, -vRel * (planet.mass / total)),
    planetVel: scale(t, vRel * (sun.mass / total)),
  };
}

function primaryBody(bodies: readonly Body[]): Body | undefined {
  const sun = bodies.find((b) => b.alive && b.kind === "sun");
  if (sun) {
    return sun;
  }
  return bodies
    .filter((b) => b.alive && !b.ephemeral)
    .slice()
    .sort((a, b) => b.mass - a.mass)[0];
}

export const MOON_ORBIT_R = 5.2;
export const MOON_CAPTURE_R = 14;

export function isEarthMoon(moon: Body, earth: Body, sun: Body | undefined): boolean {
  if (moon.appearance !== "moon" || !moon.alive) {
    return false;
  }
  const re = dist(moon.pos, earth.pos);
  if (re < 0.4 || re > MOON_CAPTURE_R) {
    return false;
  }
  if (sun && dist(moon.pos, sun.pos) <= re) {
    return false;
  }
  return true;
}

/** Safety only: used if the moon grazes Earth. Not called every frame. */
export function reseatMoon(earth: Body, moon: Body, sun: Body | undefined): void {
  const sunDir = sun ? sub(earth.pos, sun.pos) : earth.pos;
  const along = orbitalTangent(length(sunDir) > 1e-6 ? sunDir : earth.pos);
  const r = Math.max(MOON_ORBIT_R, earth.radius + moon.radius + 1.2);
  moon.pos = add(earth.pos, scale(along, r));
  const vRel = circularSpeed(earth.mass, moon.mass, r);
  // Retrograde relative to Earth — more stable at this compressed scale.
  const t = scale(orbitalTangent(sub(moon.pos, earth.pos)), -1);
  const moonRel = vRel * (earth.mass / (earth.mass + moon.mass));
  moon.vel = add(earth.vel, scale(t, moonRel));
  moon.alive = true;
}

function applyMoonOrbits(bodies: Body[], sun: Body, g: number, preservePositions = false): void {
  const earth = bodies.find((b) => b.alive && b.kind === "earth");
  if (!earth) {
    return;
  }
  for (const moon of bodies) {
    if (!isEarthMoon(moon, earth, sun)) {
      continue;
    }
    const rVec0 = sub(moon.pos, earth.pos);
    let r = length(rVec0);
    if (!preservePositions) {
      const minR = earth.radius + moon.radius + 0.8;
      const sunDir = sub(earth.pos, sun.pos);
      const aligned =
        length(sunDir) > 1e-6 && Math.abs(dot(normalize(rVec0), normalize(sunDir))) > 0.72;
      if (r < minR || aligned) {
        const along = orbitalTangent(length(sunDir) > 1e-6 ? sunDir : earth.pos);
        r = Math.max(r, MOON_ORBIT_R);
        moon.pos = add(earth.pos, scale(along, r));
      }
    }
    const rVec = sub(moon.pos, earth.pos);
    r = length(rVec);
    const vRel = circularSpeed(earth.mass, moon.mass, r, g);
    // Retrograde around Earth — was the smoother look before forced reseating.
    const t = scale(orbitalTangent(rVec), -1);
    const moonRel = vRel * (earth.mass / (earth.mass + moon.mass));
    moon.vel = add(earth.vel, scale(t, moonRel));
  }
}

export type CircularOrbitOptions = {
  preservePositions?: boolean;
};

/** Keplerian circular velocity around the sun (or heaviest body). Moons near Earth orbit Earth. */
export function applyCircularOrbits(bodies: Body[], g = G, options: CircularOrbitOptions = {}): void {
  const preservePositions = options.preservePositions ?? false;
  const sun = primaryBody(bodies);
  if (!sun) {
    return;
  }
  const earth = bodies.find((b) => b.alive && b.kind === "earth");
  let px = 0;
  let py = 0;
  let pz = 0;
  for (const b of bodies) {
    if (!b.alive || b.id === sun.id || b.ephemeral || b.kind === "meteor") {
      continue;
    }
    if (earth && isEarthMoon(b, earth, sun)) {
      continue;
    }
    const circ = twoBodyCircular(sun, b, g);
    const sign = b.orbitSign ?? 1;
    b.vel.x = circ.planetVel.x * sign;
    b.vel.y = circ.planetVel.y * sign;
    b.vel.z = circ.planetVel.z * sign;
    px += b.mass * b.vel.x;
    py += b.mass * b.vel.y;
    pz += b.mass * b.vel.z;
  }
  sun.vel.x = -px / sun.mass;
  sun.vel.y = -py / sun.mass;
  sun.vel.z = -pz / sun.mass;
  applyMoonOrbits(bodies, sun, g, preservePositions);
}
