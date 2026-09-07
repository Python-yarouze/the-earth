import { makeCatalogBody } from "./catalog";
import { cloneBody, createBody, type Body } from "../physics/body";
import { G, SOFTENING } from "../physics/constants";
import { reflectedDebrisKick, relativeSpeed, type CollisionEvent } from "../physics/collision";
import { add, dist, dot, length, normalize, scale, sub, vec3, type Vec3 } from "../physics/vec3";

/** Pacing reference for credits scroll speed and destroyer approach (not BGM length). */
export const FINALE_PACE_SEC = 103;
/** @deprecated Use FINALE_PACE_SEC */
export const FINALE_BGM_SEC = FINALE_PACE_SEC;
/** @deprecated Use FINALE_PACE_SEC */
export const FINALE_DURATION_SEC = FINALE_PACE_SEC;

/** Legacy scroll span (85% → −115%) over FINALE_PACE_SEC — keeps pixels/sec when extending travel. */
const CREDITS_SCROLL_START_PCT = 85;
const CREDITS_SCROLL_END_PCT = -220;
const CREDITS_SCROLL_LEGACY_RANGE = 200;

/** Scroll speed: % of credits block height per second (legacy 85% → −115% in 103 s). */
export const CREDITS_SCROLL_SPEED_PCT_PER_SEC = CREDITS_SCROLL_LEGACY_RANGE / FINALE_PACE_SEC;
/** Hold after BGM starts before the credits roll begins. */
export const CREDITS_SCROLL_DELAY_SEC = 5;

export function creditsScrollDurationSec(scrollHeightPx: number, viewportHeightPx: number): number {
  const h = Math.max(scrollHeightPx, 1);
  const vh = Math.max(viewportHeightPx, 1);
  const travelPct = ((h + vh * 1.08) / h) * 100;
  return travelPct / CREDITS_SCROLL_SPEED_PCT_PER_SEC;
}

export function creditsScrollEndPct(scrollHeightPx: number, viewportHeightPx: number): number {
  const h = Math.max(scrollHeightPx, 1);
  const vh = Math.max(viewportHeightPx, 1);
  const travelPct = ((h + vh * 1.08) / h) * 100;
  return CREDITS_SCROLL_START_PCT - travelPct;
}

export const FINALE_THANKS_TEXT = "Thank you for playing!!";
/** Seconds after scroll ends before the return button fades in. */
export const CREDITS_BUTTON_DELAY_SEC = 4.5;
/** Button rests at this opacity so it blends into the background. */
export const CREDITS_BUTTON_OPACITY = 0.38;

/** Seconds before the destroyer can shatter planets (lets the scene settle in view). */
export const FINALE_COLLISION_DELAY_SEC = 3;

/** Far spawn so the destroyer reads as a distant speck. */
export const DESTROYER_SPAWN_DIST = 3200;
/** Distance after the rush — matches the old starting approach range. */
export const DESTROYER_RUSH_HANDOFF_DIST = 400;
/** Seconds of BGM before the rush ends at the handoff distance. */
export const DESTROYER_RUSH_SEC = 10;
/** Draw scale for destroyer hit / framing (mirrors render DRAW.destroyer). */
const DESTROYER_DRAW = 0.55;
const DESTROYER_MIN_R = 90;
const SUN_DRAW = 1.08;
const SUN_MIN_R = 18;
/** Planet smash: a bit inward of the visible surface for weight. */
export const FINALE_PLANET_CONTACT_SCALE = 0.8;
/** Core-sun contact that starts the wind-up (near surface). */
export const FINALE_SUN_CONTACT_SCALE = 0.92;
/** Hold after first sun contact before the big bang. */
export const FINALE_SUN_WINDUP_SEC = 4.2;
const DESTROYER_CAMERA_DIST = 500;
const DESTROYER_CAMERA_HEIGHT = 62;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Visible surface radius used for finale collisions (not the oversized physics radius). */
export function finaleHitRadius(body: Body): number {
  if (body.appearance === "destroyer") {
    return Math.max(body.radius * DESTROYER_DRAW, DESTROYER_MIN_R);
  }
  if (body.kind === "sun") {
    return Math.max(body.radius * SUN_DRAW, SUN_MIN_R);
  }
  return Math.max(body.radius * 1.2, body.radius);
}

/** Slow-phase approach speed after the rush (same ramp as the old finale). */
export function destroyerSlowSpeed(elapsed: number): number {
  const slowElapsed = Math.max(0, elapsed - DESTROYER_RUSH_SEC);
  const t = Math.min(1, slowElapsed / FINALE_PACE_SEC);
  const ramp = Math.pow(t, 1.4);
  return 2.4 + ramp * 4.2;
}

/**
 * Axial distance during the rush. Hermite blend so the handoff lands on the
 * slow-phase speed instead of slamming to a stop.
 */
export function destroyerRushDistance(elapsed: number): number {
  const T = DESTROYER_RUSH_SEC;
  const u = clamp01(elapsed / T);
  const p0 = DESTROYER_SPAWN_DIST;
  const p1 = DESTROYER_RUSH_HANDOFF_DIST;
  const v0 = 0;
  const v1 = -destroyerSlowSpeed(DESTROYER_RUSH_SEC);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * p0 + h10 * (v0 * T) + h01 * p1 + h11 * (v1 * T);
}

export interface FinaleState {
  active: boolean;
  elapsed: number;
  destroyerId: number | null;
  creditsDone: boolean;
  destroyerGone: boolean;
  sunExploded: boolean;
  /** Finale elapsed when the destroyer first kissed the core sun. */
  sunContactAt: number | null;
  /** Finale elapsed when the core sun exploded; drives post-bang epilogue lines. */
  sunExplodedAt: number | null;
  explosionPos: { x: number; y: number; z: number };
  sunAnchor: Vec3;
  approachDir: Vec3;
  cameraDistance: number;
  cameraHeight: number;
}

export function createFinale(): FinaleState {
  return {
    active: false,
    elapsed: 0,
    destroyerId: null,
    creditsDone: false,
    destroyerGone: false,
    sunExploded: false,
    sunContactAt: null,
    sunExplodedAt: null,
    explosionPos: vec3(),
    sunAnchor: vec3(),
    approachDir: normalize(vec3(1, 0.06, 0.12)),
    cameraDistance: DESTROYER_CAMERA_DIST,
    cameraHeight: DESTROYER_CAMERA_HEIGHT,
  };
}

/** Spawn the destroyer — position/velocity are set in prepareFinaleScene. */
export function spawnDestroyer(_bodies: readonly Body[]): Body {
  const d = makeCatalogBody("destroyer", vec3());
  d.peerGravity = false;
  return d;
}

/** Strip destroyers and ephemeral debris so a replay starts from a clean system. */
export function bodiesForFinaleReplay(bodies: readonly Body[]): Body[] {
  return bodies.filter((b) => b.appearance !== "destroyer" && !b.ephemeral).map(cloneBody);
}

/** Approach from the far side of the player's cluster so the camera sees planets + destroyer. */
export function computeFinaleApproachDir(bodies: readonly Body[], sunAnchor: Vec3): Vec3 {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let n = 0;
  for (const body of bodies) {
    if (
      !body.alive ||
      body.ephemeral ||
      body.kind === "sun" ||
      body.appearance === "destroyer" ||
      body.appearance === "moon"
    ) {
      continue;
    }
    cx += body.pos.x;
    cy += body.pos.y;
    cz += body.pos.z;
    n += 1;
  }
  if (n > 0) {
    const dir = normalize(sub(vec3(cx / n, cy / n, cz / n), sunAnchor));
    if (length(dir) > 0.12) {
      return dir;
    }
  }
  return normalize(vec3(1, 0.06, 0.12));
}

function finaleAnchorSun(bodies: readonly Body[]): Body | undefined {
  return (
    bodies.find((b) => b.alive && b.kind === "sun" && b.core) ??
    bodies.find((b) => b.alive && b.kind === "sun")
  );
}

/** Lock the sun and line up destroyer → sun → camera along a fixed axis. */
export function prepareFinaleScene(bodies: Body[], destroyer: Body, state: FinaleState): void {
  const anchorSun = finaleAnchorSun(bodies);
  if (anchorSun) {
    state.sunAnchor = { x: anchorSun.pos.x, y: anchorSun.pos.y, z: anchorSun.pos.z };
  }
  state.approachDir = computeFinaleApproachDir(bodies, state.sunAnchor);
  state.cameraDistance = DESTROYER_CAMERA_DIST;
  state.cameraHeight = DESTROYER_CAMERA_HEIGHT;
  destroyer.pos = add(state.sunAnchor, scale(state.approachDir, DESTROYER_SPAWN_DIST));
  const rushSpan = DESTROYER_SPAWN_DIST - DESTROYER_RUSH_HANDOFF_DIST;
  destroyer.vel = scale(state.approachDir, -(rushSpan / DESTROYER_RUSH_SEC));
  destroyer.peerGravity = false;
  stabilizeFinaleSun(bodies, state);
}

/** Keep the core sun fixed so planets keep their orbits around a stable center. */
export function stabilizeFinaleSun(bodies: Body[], state: FinaleState): void {
  const anchorSun = finaleAnchorSun(bodies);
  if (!anchorSun) {
    return;
  }
  anchorSun.pos.x = state.sunAnchor.x;
  anchorSun.pos.y = state.sunAnchor.y;
  anchorSun.pos.z = state.sunAnchor.z;
  anchorSun.vel.x = 0;
  anchorSun.vel.y = 0;
  anchorSun.vel.z = 0;
}

function finaleColliding(destroyer: Body, other: Body, scaleFactor = FINALE_PLANET_CONTACT_SCALE): boolean {
  const reach = (finaleHitRadius(destroyer) + finaleHitRadius(other)) * scaleFactor;
  return dist(destroyer.pos, other.pos) < reach;
}

/** 0..1 intensity for the sun-contact wind-up shake. */
export function finaleSunWindupShake(state: FinaleState): number {
  if (state.sunContactAt === null || state.sunExploded) {
    return 0;
  }
  const t = state.elapsed - state.sunContactAt;
  if (t < 0 || t > FINALE_SUN_WINDUP_SEC) {
    return 0;
  }
  const u = t / FINALE_SUN_WINDUP_SEC;
  // Ease in, stay gentle — peak ~1 near the end without a harsh snap.
  return clamp01(u * u * (0.55 + 0.45 * u));
}

function collisionMidpoint(a: Body, b: Body): { x: number; y: number; z: number } {
  const m = a.mass + b.mass;
  return {
    x: (a.pos.x * b.mass + b.pos.x * a.mass) / m,
    y: (a.pos.y * b.mass + b.pos.y * a.mass) / m,
    z: (a.pos.z * b.mass + b.pos.z * a.mass) / m,
  };
}

function spawnBurstDebris(
  bodies: Body[],
  source: Body,
  other: Body,
  count: number,
  speed: number,
  cap = 64,
): void {
  const ephemeral = bodies.filter((b) => b.alive && b.ephemeral).length;
  const budget = Math.min(cap - ephemeral, count);
  if (budget <= 0) {
    return;
  }
  const chunk = Math.max(0.0006, source.mass / (budget * 3 + 8));
  for (let i = 0; i < budget; i++) {
    const kick = reflectedDebrisKick(source, other, speed * (0.55 + Math.random() * 0.7));
    bodies.push(
      createBody({
        kind: "meteor",
        appearance: Math.random() > 0.55 ? "ember" : "asteroid",
        mass: chunk * (0.4 + Math.random() * 0.9),
        size: 0.05 + Math.random() * 0.09,
        pos: add(source.pos, scale(normalize(kick), source.radius * 0.55 + 0.6)),
        vel: add(other.vel, kick),
        spin: 2.4 + Math.random() * 3,
        ephemeral: true,
      }),
    );
  }
}

function spawnSupernovaDebris(
  bodies: Body[],
  center: Vec3,
  _sun: Body,
  _destroyer: Body,
  rel: number,
): void {
  const existing = bodies.filter((b) => b.alive && b.ephemeral).length;
  const budget = Math.min(110, 120 - existing);
  const speedBase = 110 + rel * 0.45;
  for (let i = 0; i < budget; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const dir = normalize(
      vec3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) * 0.42,
        Math.sin(phi) * Math.sin(theta),
      ),
    );
    const speed = speedBase * (0.72 + Math.random() * 0.85);
    bodies.push(
      createBody({
        kind: "meteor",
        appearance: Math.random() > 0.2 ? "ember" : "asteroid",
        mass: 0.002 + Math.random() * 0.006,
        size: 0.1 + Math.random() * 0.22,
        pos: add(center, scale(dir, 1.5 + Math.random() * 5)),
        vel: scale(dir, speed),
        spin: 4 + Math.random() * 6,
        ephemeral: true,
        peerGravity: false,
      }),
    );
  }
}

function explodeFinaleSun(
  bodies: Body[],
  sun: Body,
  destroyer: Body,
  state: FinaleState,
): CollisionEvent {
  const rel = relativeSpeed(destroyer, sun);
  const pos = collisionMidpoint(destroyer, sun);
  state.sunExploded = true;
  if (state.sunExplodedAt === null) {
    state.sunExplodedAt = state.elapsed;
  }
  state.destroyerGone = true;
  state.explosionPos = { x: sun.pos.x, y: sun.pos.y, z: sun.pos.z };
  spawnSupernovaDebris(bodies, sun.pos, sun, destroyer, rel);
  sun.alive = false;
  destroyer.alive = false;
  state.destroyerId = null;
  return { kind: "big-bang", aId: destroyer.id, bId: sun.id, pos, relSpeed: rel };
}

/**
 * Finale collisions: destroyer shatters planets on contact; sun impact destroys both.
 * Normal merges/black holes are skipped so the scripted ending stays readable.
 */
export function resolveFinaleCollisions(bodies: Body[], state: FinaleState): CollisionEvent | null {
  if (state.elapsed < FINALE_COLLISION_DELAY_SEC && !state.sunExploded) {
    return null;
  }
  const destroyerId = state.destroyerId;
  if (destroyerId === null) {
    return null;
  }
  const destroyer = bodies.find((b) => b.id === destroyerId && b.alive);
  if (!destroyer) {
    return null;
  }

  for (const other of bodies) {
    if (!other.alive || other.ephemeral || other.id === destroyer.id) {
      continue;
    }
    if (other.kind === "sun" && other.core) {
      if (!finaleColliding(destroyer, other, FINALE_SUN_CONTACT_SCALE)) {
        continue;
      }
      if (state.sunContactAt === null) {
        state.sunContactAt = state.elapsed;
        return null;
      }
      if (state.elapsed - state.sunContactAt < FINALE_SUN_WINDUP_SEC) {
        return null;
      }
      return explodeFinaleSun(bodies, other, destroyer, state);
    }
    if (!finaleColliding(destroyer, other, FINALE_PLANET_CONTACT_SCALE)) {
      continue;
    }
    const rel = relativeSpeed(destroyer, other);
    const pos = collisionMidpoint(destroyer, other);
    spawnBurstDebris(bodies, other, destroyer, other.kind === "sun" ? 22 : 18, 16 + rel * 0.07);
    other.alive = false;
    return { kind: "shatter", aId: destroyer.id, bId: other.id, pos, relSpeed: rel };
  }
  return null;
}

/**
 * Pull planets toward the destroyer.
 * Before the bang: reach the whole system so solar orbits start to drift, but cap
 * acceleration so near-side planets are not vacuumed in. After the bang: full tug.
 */
export function applyDestroyerGravity(
  bodies: Body[],
  destroyer: Body,
  state: FinaleState,
  dt: number,
  g = G,
): void {
  if (state.elapsed < FINALE_COLLISION_DELAY_SEC && !state.sunExploded) {
    return;
  }
  const factor = state.sunExploded ? 0.95 : 0.18;
  /** Cover Neptune-scale orbits while the destroyer is still on final approach. */
  const maxReach = state.sunExploded ? Infinity : 2400;
  /** Mild nudge vs solar accel at Earth — orbits drift without a hard yank. */
  const maxAccel = state.sunExploded ? Infinity : 2.8;
  const eps2 = SOFTENING * SOFTENING;
  for (const body of bodies) {
    if (!body.alive || body.ephemeral || body.id === destroyer.id || body.kind === "sun") {
      continue;
    }
    const dx = destroyer.pos.x - body.pos.x;
    const dy = destroyer.pos.y - body.pos.y;
    const dz = destroyer.pos.z - body.pos.z;
    const r2 = dx * dx + dy * dy + dz * dz + eps2;
    const r = Math.sqrt(r2);
    if (r > maxReach || r < 1e-3) {
      continue;
    }
    const pull = Math.min((g * destroyer.mass * factor) / r2, maxAccel);
    body.vel.x += (dx / r) * pull * dt;
    body.vel.y += (dy / r) * pull * dt;
    body.vel.z += (dz / r) * pull * dt;
  }
}

function constrainDestroyerToAxis(destroyer: Body, state: FinaleState): void {
  const rel = sub(destroyer.pos, state.sunAnchor);
  const axial = dot(rel, state.approachDir);
  const radial = sub(rel, scale(state.approachDir, axial));
  const radialLen = length(radial);
  if (radialLen > 1e-4) {
    destroyer.pos = add(state.sunAnchor, add(scale(state.approachDir, axial), scale(radial, 0.9)));
  }
}

export function tickFinale(state: FinaleState, dt: number, destroyer: Body | undefined): void {
  if (!state.active) {
    return;
  }
  state.elapsed += dt;
  if (destroyer && destroyer.alive) {
    constrainDestroyerToAxis(destroyer, state);
    if (!state.sunExploded) {
      if (state.sunContactAt !== null) {
        // Crawl deeper during the wind-up so impact reads as a bite, not a bounce.
        destroyer.vel = scale(state.approachDir, -0.55);
      } else if (state.elapsed < DESTROYER_RUSH_SEC) {
        const nextDist = destroyerRushDistance(state.elapsed);
        const prevDist = destroyerRushDistance(Math.max(0, state.elapsed - dt));
        destroyer.pos = add(state.sunAnchor, scale(state.approachDir, nextDist));
        const speed = Math.max(0, (prevDist - nextDist) / Math.max(dt, 1e-4));
        destroyer.vel = scale(state.approachDir, -speed);
      } else {
        const speed = destroyerSlowSpeed(state.elapsed);
        destroyer.vel = scale(state.approachDir, -speed);
      }
    }
  }
  if (state.elapsed >= CREDITS_SCROLL_DELAY_SEC + CREDITS_SCROLL_SEC) {
    state.creditsDone = true;
  }
}

export type FinaleCreditsPhase = "scroll" | "epilogue" | "thanks" | "button";

/** Shown one-by-one in the center after the sun explodes — not in the scroll. */
export const FINALE_EPILOGUE_LINES: readonly string[] = [
  "そして太陽系は消滅した。",
  "でも、星はまだどこかで回っている。",
];

export const EPILOGUE_FADE_IN_SEC = 2.4;
export const EPILOGUE_HOLD_SEC = 3.2;
export const EPILOGUE_FADE_OUT_SEC = 2.4;
/** Quiet beat after the bang before the first epilogue line. */
export const EPILOGUE_DELAY_SEC = 3.8;

export const EPILOGUE_LINE_SEC = EPILOGUE_FADE_IN_SEC + EPILOGUE_HOLD_SEC + EPILOGUE_FADE_OUT_SEC;

export function finaleEpilogueTotalSec(): number {
  return EPILOGUE_DELAY_SEC + FINALE_EPILOGUE_LINES.length * EPILOGUE_LINE_SEC;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export interface FinaleEpilogueFrame {
  visible: boolean;
  lineIndex: number;
  opacity: number;
  hope: boolean;
}

export function finaleEpilogueFrame(elapsed: number, sunExplodedAt: number | null): FinaleEpilogueFrame {
  if (sunExplodedAt === null) {
    return { visible: false, lineIndex: 0, opacity: 0, hope: false };
  }
  const t = elapsed - sunExplodedAt - EPILOGUE_DELAY_SEC;
  if (t < 0 || t >= FINALE_EPILOGUE_LINES.length * EPILOGUE_LINE_SEC) {
    return { visible: false, lineIndex: 0, opacity: 0, hope: false };
  }
  const lineIndex = Math.min(
    FINALE_EPILOGUE_LINES.length - 1,
    Math.floor(t / EPILOGUE_LINE_SEC),
  );
  const local = t - lineIndex * EPILOGUE_LINE_SEC;
  let opacity = 0;
  if (local < EPILOGUE_FADE_IN_SEC) {
    opacity = smoothstep(local / EPILOGUE_FADE_IN_SEC);
  } else if (local < EPILOGUE_FADE_IN_SEC + EPILOGUE_HOLD_SEC) {
    opacity = 1;
  } else {
    opacity = 1 - smoothstep((local - EPILOGUE_FADE_IN_SEC - EPILOGUE_HOLD_SEC) / EPILOGUE_FADE_OUT_SEC);
  }
  return {
    visible: true,
    lineIndex,
    opacity,
    hope: lineIndex === FINALE_EPILOGUE_LINES.length - 1,
  };
}

/** Wall time when the credits animation finishes (delay + measured scroll). */
export function finaleCreditsScrollEndSec(scrollSec: number): number {
  return CREDITS_SCROLL_DELAY_SEC + scrollSec;
}

export function finaleThanksStartSec(scrollSec: number, sunExplodedAt: number | null): number {
  const epilogueEnd = sunExplodedAt === null ? 0 : sunExplodedAt + finaleEpilogueTotalSec();
  return Math.max(finaleCreditsScrollEndSec(scrollSec), epilogueEnd);
}

export function finaleCreditsPhase(
  elapsed: number,
  scrollSec: number,
  sunExplodedAt: number | null = null,
): FinaleCreditsPhase {
  const thanksStart = finaleThanksStartSec(scrollSec, sunExplodedAt);
  if (elapsed < thanksStart) {
    if (
      sunExplodedAt !== null &&
      elapsed >= sunExplodedAt &&
      elapsed < sunExplodedAt + finaleEpilogueTotalSec()
    ) {
      return "epilogue";
    }
    return "scroll";
  }
  if (elapsed < thanksStart + CREDITS_BUTTON_DELAY_SEC) {
    return "thanks";
  }
  return "button";
}

/** Default scroll duration for tests / SSR fallback. */
export const CREDITS_SCROLL_SEC =
  (FINALE_PACE_SEC * (CREDITS_SCROLL_START_PCT - CREDITS_SCROLL_END_PCT)) / CREDITS_SCROLL_LEGACY_RANGE;

export type CreditSectionVariant = "title";

export interface CreditSection {
  label?: string;
  lines: readonly string[];
  variant?: CreditSectionVariant;
}

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  { lines: ["THE EARTH"], variant: "title" },
  { label: "クリエイター", lines: ["FulLine"] },
  { label: "プログラム", lines: ["FulLine", "Cursor"] },
  {
    label: "BGM",
    lines: ["ドヴォルザーク「新世界より」第4楽章", "classical-sound.seesaa.net"],
  },
  { label: "テクスチャ", lines: ["Solar System Scope (CC BY 4.0)"] },
  { label: "フォント", lines: ["Instrument Serif / IBM Plex Sans"] },
];

/** @deprecated Use CREDIT_SECTIONS — flat list for legacy callers. */
export const CREDITS_LINES: readonly string[] = CREDIT_SECTIONS.flatMap((section) => {
  const rows: string[] = [];
  if (section.label) {
    rows.push(section.label);
  }
  rows.push(...section.lines);
  rows.push("");
  return rows;
});
