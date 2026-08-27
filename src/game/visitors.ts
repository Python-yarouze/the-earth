import { makeCatalogBody } from "./catalog";
import {
  canSpawnComet,
  canSpawnDarkCompanion,
  canSpawnSkyFlare,
  canSpawnSwarm,
} from "./discoveries";
import type { Progress } from "./progress";
import type { AppearanceId, Body } from "../physics/body";
import { dist, length, normalize, scale, sub, vec3, type Vec3 } from "../physics/vec3";

export const VISITOR_GRACE_SEC = 35;
export const METEOR_DESPAWN = 480;
const METEOR_MEAN_SEC = 180;
const SHIP_MEAN_SEC = 480;
const COMET_MEAN_SEC = 600;
const SWARM_MEAN_SEC = 360;
const FLARE_MEAN_SEC = 900;
const DARK_MEAN_SEC = 1200;

export type VisitorKind = "meteor" | "ship" | "comet" | "swarm" | "skyFlare" | "darkCompanion";

export interface VisitorClock {
  nextMeteor: number;
  nextShip: number;
  nextComet: number;
  nextSwarm: number;
  nextFlare: number;
  nextDark: number;
  lastSpawn: number;
}

export function createVisitorClock(): VisitorClock {
  return {
    nextMeteor: VISITOR_GRACE_SEC + METEOR_MEAN_SEC * (0.6 + Math.random() * 0.8),
    nextShip: VISITOR_GRACE_SEC + SHIP_MEAN_SEC * (0.7 + Math.random() * 1.2),
    nextComet: VISITOR_GRACE_SEC + COMET_MEAN_SEC * (0.8 + Math.random() * 0.8),
    nextSwarm: VISITOR_GRACE_SEC + SWARM_MEAN_SEC * (0.8 + Math.random() * 0.9),
    nextFlare: VISITOR_GRACE_SEC + FLARE_MEAN_SEC * (0.9 + Math.random()),
    nextDark: VISITOR_GRACE_SEC + DARK_MEAN_SEC * (1 + Math.random()),
    lastSpawn: -999,
  };
}

function gated(
  timeSec: number,
  sandbox: boolean,
  clock: VisitorClock,
  nextAt: number,
): boolean {
  if (!sandbox || timeSec < VISITOR_GRACE_SEC) {
    return false;
  }
  if (timeSec - clock.lastSpawn < 40) {
    return false;
  }
  return timeSec >= nextAt;
}

export function shouldSpawnMeteor(timeSec: number, sandbox: boolean, clock: VisitorClock): boolean {
  return gated(timeSec, sandbox, clock, clock.nextMeteor);
}

export function shouldSpawnShip(timeSec: number, sandbox: boolean, clock: VisitorClock): boolean {
  return gated(timeSec, sandbox, clock, clock.nextShip);
}

export function shouldSpawnComet(
  timeSec: number,
  sandbox: boolean,
  clock: VisitorClock,
  progress: Progress,
): boolean {
  return canSpawnComet(progress) && gated(timeSec, sandbox, clock, clock.nextComet);
}

export function shouldSpawnSwarm(
  timeSec: number,
  sandbox: boolean,
  clock: VisitorClock,
  progress: Progress,
): boolean {
  return canSpawnSwarm(progress) && gated(timeSec, sandbox, clock, clock.nextSwarm);
}

export function shouldSpawnSkyFlare(
  timeSec: number,
  sandbox: boolean,
  clock: VisitorClock,
  progress: Progress,
): boolean {
  return canSpawnSkyFlare(progress) && gated(timeSec, sandbox, clock, clock.nextFlare);
}

export function shouldSpawnDarkCompanion(
  timeSec: number,
  sandbox: boolean,
  clock: VisitorClock,
  progress: Progress,
): boolean {
  return canSpawnDarkCompanion(progress) && gated(timeSec, sandbox, clock, clock.nextDark);
}

export function noteMeteorSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextMeteor = timeSec + METEOR_MEAN_SEC * (0.7 + Math.random() * 1.1);
}

export function noteShipSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextShip = timeSec + SHIP_MEAN_SEC * (0.8 + Math.random() * 1.4);
}

export function noteCometSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextComet = timeSec + COMET_MEAN_SEC * (0.8 + Math.random() * 1.2);
}

export function noteSwarmSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextSwarm = timeSec + SWARM_MEAN_SEC * (0.8 + Math.random() * 1.1);
}

export function noteFlareSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextFlare = timeSec + FLARE_MEAN_SEC * (0.9 + Math.random() * 1.3);
}

export function noteDarkSpawn(clock: VisitorClock, timeSec: number): void {
  clock.lastSpawn = timeSec;
  clock.nextDark = timeSec + DARK_MEAN_SEC * (1 + Math.random());
}

export function makeMeteor(): Body {
  const angle = Math.random() * Math.PI * 2;
  const r = 360 + Math.random() * 40;
  const pos = vec3(Math.cos(angle) * r, (Math.random() - 0.5) * 50, Math.sin(angle) * r);
  const miss = vec3((Math.random() - 0.5) * 55, (Math.random() - 0.5) * 35, (Math.random() - 0.5) * 55);
  const dir = normalize(sub(miss, pos));
  const speed = 52 + Math.random() * 28;
  const body = makeCatalogBody("meteor", pos);
  body.ephemeral = true;
  body.vel = scale(dir, speed);
  return body;
}

export function makeComet(): Body {
  const angle = Math.random() * Math.PI * 2;
  const r = 380 + Math.random() * 40;
  const pos = vec3(Math.cos(angle) * r, 30 + Math.random() * 40, Math.sin(angle) * r);
  const miss = vec3((Math.random() - 0.5) * 40, 10, (Math.random() - 0.5) * 40);
  const dir = normalize(sub(miss, pos));
  const body = makeCatalogBody("comet", pos);
  body.ephemeral = true;
  body.mass = 0.02;
  body.vel = scale(dir, 28 + Math.random() * 12);
  return body;
}

export function makeSwarm(): Body[] {
  const base = makeMeteor();
  const swarm: Body[] = [base];
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const piece = makeCatalogBody("asteroid", {
      x: base.pos.x + (Math.random() - 0.5) * 18,
      y: base.pos.y + (Math.random() - 0.5) * 12,
      z: base.pos.z + (Math.random() - 0.5) * 18,
    });
    piece.ephemeral = true;
    piece.kind = "meteor";
    piece.mass = 0.006;
    piece.vel = {
      x: base.vel.x + (Math.random() - 0.5) * 6,
      y: base.vel.y + (Math.random() - 0.5) * 4,
      z: base.vel.z + (Math.random() - 0.5) * 6,
    };
    swarm.push(piece);
  }
  return swarm;
}

/** Distant companion: heavy but far, weak tug. */
export function makeDarkCompanion(): Body {
  const angle = Math.random() * Math.PI * 2;
  const r = 420;
  const pos = vec3(Math.cos(angle) * r, 40, Math.sin(angle) * r);
  const body = makeCatalogBody("blackhole", pos);
  body.ephemeral = true;
  body.mass = 80;
  body.radius = 2;
  const dir = normalize(sub(vec3(), pos));
  // Pass by, not dive in
  const tangent = normalize(vec3(-dir.z, 0, dir.x));
  body.vel = scale(tangent, 18);
  return body;
}

export function meteorGone(body: Body): boolean {
  if (!body.alive) {
    return true;
  }
  return length(body.pos) > METEOR_DESPAWN;
}

export function shipPath(): { from: Vec3; to: Vec3 } {
  const a = Math.random() * Math.PI * 2;
  const b = a + Math.PI + (Math.random() - 0.5) * 0.6;
  const r = 300;
  return {
    from: vec3(Math.cos(a) * r, 20 + Math.random() * 40, Math.sin(a) * r),
    to: vec3(Math.cos(b) * r, 10 + Math.random() * 30, Math.sin(b) * r),
  };
}

export function cullMeteors(bodies: Body[]): Body[] {
  return bodies.filter((b) => {
    if (!b.ephemeral) {
      return true;
    }
    return !meteorGone(b);
  });
}

/** Newly unlocked planet streaks through the live system as a light visitor. */
export function makeUnlockMeteor(appearance: AppearanceId): Body {
  const angle = Math.random() * Math.PI * 2;
  const r = 360 + Math.random() * 50;
  const pos = vec3(Math.cos(angle) * r, (Math.random() - 0.5) * 55, Math.sin(angle) * r);
  const miss = vec3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 50);
  const dir = normalize(sub(miss, pos));
  const body = makeCatalogBody(appearance, pos);
  if (body.kind === "sun" || body.kind === "earth") {
    body.kind = "planet";
  }
  body.mass = Math.min(body.mass, appearance === "sun" ? 1.2 : 0.85);
  body.ephemeral = true;
  body.vel = scale(dir, 38 + Math.random() * 22);
  return body;
}

export function distFromOrigin(body: Body): number {
  return dist(body.pos, vec3());
}
