import { Body } from "../physics/body";
import { ESCAPE_DISTANCE, STABLE_SEC } from "../physics/constants";
import { dist } from "../physics/vec3";

export type Mood = "watching" | "balanced" | "collapsed";

const TWO_PI = Math.PI * 2;

export interface EarthStats {
  mood: Mood;
  timeSec: number;
  /** Completed Earth revolutions around the sun (1 rev = 1 year). */
  years: number;
  /** Radians of the current incomplete orbit, signed by travel direction. */
  orbitAccum: number;
  /** Last earth–sun azimuth in the XZ plane, or null before first sample. */
  orbitAngle: number | null;
  meanSunDist: number;
  minSunDist: number;
  maxSunDist: number;
  collisions: number;
  recent: number[];
  everBalanced: boolean;
}

export function createStats(): EarthStats {
  return {
    mood: "watching",
    timeSec: 0,
    years: 0,
    orbitAccum: 0,
    orbitAngle: null,
    meanSunDist: 0,
    minSunDist: Infinity,
    maxSunDist: 0,
    collisions: 0,
    recent: [],
    everBalanced: false,
  };
}

export function sunOf(bodies: readonly Body[]): Body | undefined {
  return bodies.find((b) => b.alive && b.kind === "sun");
}

export function earthOf(bodies: readonly Body[]): Body | undefined {
  return bodies.find((b) => b.kind === "earth");
}

/** Azimuth of Earth around the sun in the XZ plane. */
export function earthOrbitAngle(earth: Body, sun: Body): number {
  return Math.atan2(earth.pos.z - sun.pos.z, earth.pos.x - sun.pos.x);
}

function wrapPi(d: number): number {
  let x = d;
  while (x > Math.PI) {
    x -= TWO_PI;
  }
  while (x < -Math.PI) {
    x += TWO_PI;
  }
  return x;
}

/** Years including the current incomplete orbit (0..1 fraction). */
export function displayYears(stats: Pick<EarthStats, "years" | "orbitAccum">): number {
  return stats.years + Math.min(1, Math.abs(stats.orbitAccum) / TWO_PI);
}

const SAMPLE_CAP = Math.ceil(STABLE_SEC * 60);

export function evaluateFrame(
  bodies: readonly Body[],
  stats: EarthStats,
  dt: number,
  lastEventKind: string | null,
): EarthStats {
  const next: EarthStats = {
    ...stats,
    timeSec: stats.timeSec + dt,
    recent: stats.recent.slice(),
  };
  if (lastEventKind) {
    next.collisions += 1;
  }

  const earth = earthOf(bodies);
  const sun = sunOf(bodies);
  if (!earth || !earth.alive || !sun) {
    next.mood = "collapsed";
    return next;
  }

  const ang = earthOrbitAngle(earth, sun);
  if (stats.orbitAngle === null) {
    next.orbitAngle = ang;
  } else {
    const delta = wrapPi(ang - stats.orbitAngle);
    next.orbitAccum = stats.orbitAccum + delta;
    next.orbitAngle = ang;
    while (next.orbitAccum >= TWO_PI) {
      next.orbitAccum -= TWO_PI;
      next.years += 1;
    }
    while (next.orbitAccum <= -TWO_PI) {
      next.orbitAccum += TWO_PI;
      next.years += 1;
    }
  }

  const r = dist(earth.pos, sun.pos);
  next.minSunDist = Math.min(next.minSunDist, r);
  next.maxSunDist = Math.max(next.maxSunDist, r);
  const n = Math.max(1, Math.round(next.timeSec / dt));
  next.meanSunDist = next.meanSunDist + (r - next.meanSunDist) / n;

  if (r > ESCAPE_DISTANCE) {
    next.mood = "collapsed";
    return next;
  }

  next.recent.push(r);
  if (next.recent.length > SAMPLE_CAP) {
    next.recent.splice(0, next.recent.length - SAMPLE_CAP);
  }
  if (next.recent.length >= SAMPLE_CAP) {
    let lo = Infinity;
    let hi = 0;
    let sum = 0;
    for (const d of next.recent) {
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
      sum += d;
    }
    const mean = sum / next.recent.length || 1;
    if ((hi - lo) / mean < 0.22) {
      next.mood = "balanced";
      next.everBalanced = true;
    } else {
      next.mood = "watching";
    }
  } else {
    next.mood = "watching";
  }
  return next;
}
