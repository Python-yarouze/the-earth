import { applyRadius, createBody, type Body } from "./body";
import { DESTROY_SPEED, MERGE_SPEED, SIZE_MAX, SIZE_MIN, SUN_MASS } from "./constants";
import { reseatMoon } from "./engine";
import { add, cross, dist, dot, length, normalize, scale, sub, vec3, type Vec3 } from "./vec3";

export type CollisionKind =
  | "merge"
  | "disrupt"
  | "shatter"
  | "destroy"
  | "earth-lost"
  | "swallow"
  | "big-bang"
  | "burn";

export interface CollisionEvent {
  kind: CollisionKind;
  aId: number;
  bId: number;
  pos: { x: number; y: number; z: number };
  relSpeed: number;
}

export const BLACK_HOLE_MASS = SUN_MASS * 1.5;
export const BLACK_HOLE_SWALLOW_FACTOR = 2.4;
export const BIG_BANG_MASS = SUN_MASS * 3;
const MAX_DEBRIS = 8;
const DEBRIS_COUNT = 3;

export function collidingPair(a: Body, b: Body): boolean {
  if (!a.alive || !b.alive || a.id === b.id) {
    return false;
  }
  if (a.mass <= 0 || b.mass <= 0) {
    return false;
  }
  return dist(a.pos, b.pos) < a.radius + b.radius;
}

export function relativeSpeed(a: Body, b: Body): number {
  return length(sub(a.vel, b.vel));
}

export function isBlackHole(body: Body): boolean {
  return body.appearance === "blackhole" && body.alive;
}

export function classifyCollision(a: Body, b: Body, relSpeed: number): CollisionKind {
  if (isBlackHole(a) || isBlackHole(b)) {
    return "swallow";
  }
  if (a.kind === "earth" || b.kind === "earth") {
    return "earth-lost";
  }
  if (relSpeed >= DESTROY_SPEED) {
    return "shatter";
  }
  if (relSpeed >= MERGE_SPEED) {
    return "disrupt";
  }
  return "merge";
}

export function sizeAfterMerge(winnerSize: number, winnerMass: number, loserSize: number, loserMass: number): number {
  const m = winnerMass + loserMass;
  const blended = (winnerSize * winnerMass + loserSize * loserMass) / m;
  const grown = blended * (1 + 0.12 * (loserMass / m));
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, grown));
}

function becomeBlackHole(body: Body): void {
  body.appearance = "blackhole";
  body.kind = "planet";
  body.size = Math.min(body.size, 0.55);
  applyRadius(body);
  // Compact radius: dense point
  body.radius = Math.max(1.2, radiusFromMassOnly(body.mass) * 0.22);
}

function radiusFromMassOnly(mass: number): number {
  const safe = Math.max(mass, 0.05);
  return 2.4 * Math.cbrt(safe);
}

function maybePromoteBlackHole(body: Body): boolean {
  if (body.kind === "sun" || isBlackHole(body)) {
    return false;
  }
  if (body.mass < BLACK_HOLE_MASS) {
    return false;
  }
  becomeBlackHole(body);
  return true;
}

function mergeInto(winner: Body, loser: Body): void {
  const wMass = winner.mass;
  const lMass = loser.mass;
  const m = wMass + lMass;
  winner.vel.x = (winner.vel.x * wMass + loser.vel.x * lMass) / m;
  winner.vel.y = (winner.vel.y * wMass + loser.vel.y * lMass) / m;
  winner.vel.z = (winner.vel.z * wMass + loser.vel.z * lMass) / m;
  winner.pos.x = (winner.pos.x * wMass + loser.pos.x * lMass) / m;
  winner.pos.y = (winner.pos.y * wMass + loser.pos.y * lMass) / m;
  winner.pos.z = (winner.pos.z * wMass + loser.pos.z * lMass) / m;
  winner.size = sizeAfterMerge(winner.size, wMass, loser.size, lMass);
  winner.mass = m;
  applyRadius(winner);
  if (loser.kind === "sun" || winner.kind === "sun") {
    winner.kind = "sun";
    winner.appearance = "sun";
  } else if (isBlackHole(winner) || isBlackHole(loser)) {
    becomeBlackHole(winner);
  } else {
    maybePromoteBlackHole(winner);
  }
  loser.alive = false;
}

function swallowInto(hole: Body, prey: Body): CollisionKind {
  const m = hole.mass + prey.mass;
  hole.vel.x = (hole.vel.x * hole.mass + prey.vel.x * prey.mass) / m;
  hole.vel.y = (hole.vel.y * hole.mass + prey.vel.y * prey.mass) / m;
  hole.vel.z = (hole.vel.z * hole.mass + prey.vel.z * prey.mass) / m;
  hole.mass = m;
  becomeBlackHole(hole);
  const ateSun = prey.kind === "sun";
  const ateEarth = prey.kind === "earth";
  prey.alive = false;
  if (ateSun || hole.mass >= BIG_BANG_MASS) {
    return "big-bang";
  }
  if (ateEarth) {
    return "earth-lost";
  }
  return "swallow";
}

function spawnDebris(bodies: Body[], source: Body, other: Body, rel: number): void {
  const ephemeral = bodies.filter((b) => b.alive && b.ephemeral).length;
  if (ephemeral >= MAX_DEBRIS) {
    return;
  }
  const budget = Math.min(MAX_DEBRIS - ephemeral, DEBRIS_COUNT);
  const chunk = Math.max(0.002, source.mass / (budget + 1));
  const speed = 10 + rel * 0.08;
  for (let i = 0; i < budget; i++) {
    const kick = reflectedDebrisKick(source, other, speed * (0.75 + Math.random() * 0.5));
    const piece = createBody({
      kind: "meteor",
      appearance: "asteroid",
      mass: chunk,
      size: 0.28,
      pos: add(source.pos, scale(normalize(kick), source.radius + 1.2)),
      vel: add(other.vel, kick),
      spin: 1.4,
      ephemeral: true,
    });
    bodies.push(piece);
  }
}

/**
 * Bounce-style debris kick: reflect victim relative velocity off the contact normal,
 * then add a cone of jitter so shards fan away from the collider rather than along travel.
 */
export function reflectedDebrisKick(
  victim: Body,
  other: Body,
  speed: number,
  rng: () => number = Math.random,
): Vec3 {
  let n = normalize(sub(victim.pos, other.pos));
  if (length(n) < 1e-6) {
    n = vec3(1, 0, 0);
  }
  const vRel = sub(victim.vel, other.vel);
  let vOut = vRel;
  const vn = dot(vRel, n);
  if (vn < 0) {
    vOut = sub(vRel, scale(n, 2 * vn));
  }
  if (length(vOut) < 1e-3) {
    vOut = n;
  }
  vOut = normalize(vOut);
  // Prefer the outward hemisphere if reflection still points into the collider.
  if (dot(vOut, n) < 0.15) {
    vOut = normalize(add(vOut, scale(n, 0.85)));
  }
  let tangent = cross(vOut, vec3(0, 1, 0));
  if (length(tangent) < 1e-4) {
    tangent = cross(vOut, vec3(1, 0, 0));
  }
  tangent = normalize(tangent);
  const bitangent = normalize(cross(vOut, tangent));
  const spread = 0.55;
  const jitter = add(
    scale(tangent, (rng() - 0.5) * 2 * spread),
    scale(bitangent, (rng() - 0.5) * 2 * spread),
  );
  return scale(normalize(add(vOut, jitter)), Math.max(0.5, speed));
}

function withinSwallow(hole: Body, other: Body): boolean {
  const reach = Math.max(hole.radius, 2) * BLACK_HOLE_SWALLOW_FACTOR + other.radius;
  return dist(hole.pos, other.pos) < reach;
}

/**
 * Resolve the first colliding pair. Returns an event or null.
 * Shatter spawns debris; heavy merges can collapse into a black hole.
 */
export function resolveCollisions(bodies: Body[]): CollisionEvent | null {
  // Black hole swallow check (expanded radius)
  for (let i = 0; i < bodies.length; i++) {
    const hole = bodies[i];
    if (!isBlackHole(hole)) {
      continue;
    }
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) {
        continue;
      }
      const prey = bodies[j];
      if (!prey.alive || isBlackHole(prey)) {
        continue;
      }
      if (!withinSwallow(hole, prey)) {
        continue;
      }
      const rel = relativeSpeed(hole, prey);
      const pos = { x: hole.pos.x, y: hole.pos.y, z: hole.pos.z };
      const kind = swallowInto(hole, prey);
      return { kind, aId: hole.id, bId: prey.id, pos, relSpeed: rel };
    }
  }

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
      if (!collidingPair(a, b)) {
        continue;
      }
      const rel = relativeSpeed(a, b);
      let kind = classifyCollision(a, b, rel);
      const pos = {
        x: (a.pos.x * b.mass + b.pos.x * a.mass) / (a.mass + b.mass),
        y: (a.pos.y * b.mass + b.pos.y * a.mass) / (a.mass + b.mass),
        z: (a.pos.z * b.mass + b.pos.z * a.mass) / (a.mass + b.mass),
      };

      if (kind === "swallow") {
        const hole = isBlackHole(a) ? a : b;
        const prey = hole === a ? b : a;
        kind = swallowInto(hole, prey);
        return { kind, aId: a.id, bId: b.id, pos, relSpeed: rel };
      }

      if (kind === "earth-lost") {
        const earth = a.kind === "earth" ? a : b;
        const other = earth === a ? b : a;
        if (other.appearance === "moon") {
          const sun = bodies.find((x) => x.alive && x.kind === "sun");
          reseatMoon(earth, other, sun);
          return null;
        }
        earth.alive = false;
        return { kind, aId: a.id, bId: b.id, pos, relSpeed: rel };
      }

      if (kind === "shatter") {
        const lighter = a.mass <= b.mass ? a : b;
        const heavier = lighter === a ? b : a;
        spawnDebris(bodies, lighter, heavier, rel);
        lighter.alive = false;
        // Violent hit on a heavy body can shed extra debris (supernova-ish)
        if (heavier.mass >= 40 && heavier.kind !== "sun") {
          spawnDebris(bodies, heavier, lighter, rel * 0.6);
        }
        return { kind, aId: a.id, bId: b.id, pos, relSpeed: rel };
      }

      const winner = a.mass >= b.mass ? a : b;
      const loser = winner === a ? b : a;
      mergeInto(winner, loser);
      return { kind, aId: a.id, bId: b.id, pos, relSpeed: rel };
    }
  }
  return null;
}

export function collisionCopy(kind: CollisionKind): string {
  switch (kind) {
    case "merge":
      return "くっついた";
    case "disrupt":
      return "激しく混ざった";
    case "shatter":
      return "砕けた";
    case "destroy":
      return "砕けた";
    case "earth-lost":
      return "地球が失われた";
    case "swallow":
      return "暗い点が吞んだ";
    case "big-bang":
      return "光に還った";
    case "burn":
      return "太陽に焼けた";
    default:
      return "";
  }
}
