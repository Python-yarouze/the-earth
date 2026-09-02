import { RADIUS_MASS_REF, RADIUS_REF } from "./constants";
import { clone, type Vec3, vec3 } from "./vec3";

export type BodyKind = "sun" | "earth" | "planet" | "meteor";
export type AppearanceId =
  | "sun"
  | "earth"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "asteroid"
  | "meteor"
  | "blackhole"
  | "comet"
  | "gaming"
  | "glass"
  | "puff"
  | "brick"
  | "mirror"
  | "discoball"
  | "snowball"
  | "ember"
  | "contrarian"
  | "dice"
  | "bubble"
  | "clock"
  | "voidseed"
  | "sparkle"
  | "drowsy"
  | "takoyaki"
  | "puddle"
  | "thunder"
  | "crumbly"
  | "sideslip"
  | "relic"
  | "destroyer";

export interface Body {
  id: number;
  kind: BodyKind;
  appearance: AppearanceId;
  mass: number;
  size: number;
  radius: number;
  pos: Vec3;
  vel: Vec3;
  alive: boolean;
  /** Current rotation angle (radians). */
  spin: number;
  /** Spin rate (radians / second). Negative = retrograde. */
  spinRate: number;
  /** Axial tilt from orbital pole (radians). */
  obliquity: number;
  /** Orbital direction around primary: 1 prograde, -1 retrograde. */
  orbitSign: 1 | -1;
  ephemeral: boolean;
  /**
   * When false, this body does not exchange gravity with other non-central
   * bodies (sun/blackhole still pull fully). Used by the solar preset.
   */
  peerGravity: boolean;
  /** Starting sun/earth — cannot be removed in build mode. */
  core?: boolean;
}

let nextId = 1;

export function resetBodyIds(): void {
  nextId = 1;
}

export function radiusFromMass(mass: number): number {
  const safe = Math.max(mass, 0.05);
  return RADIUS_REF * Math.cbrt(safe / RADIUS_MASS_REF);
}

export function applyRadius(body: Body): void {
  body.radius = radiusFromMass(body.mass) * body.size;
}

export function createBody(partial: {
  kind: BodyKind;
  appearance: AppearanceId;
  mass: number;
  pos: Vec3;
  vel?: Vec3;
  spin?: number;
  spinRate?: number;
  obliquity?: number;
  size?: number;
  orbitSign?: 1 | -1;
  ephemeral?: boolean;
  peerGravity?: boolean;
}): Body {
  const size = partial.size ?? 1;
  return {
    id: nextId++,
    kind: partial.kind,
    appearance: partial.appearance,
    mass: partial.mass,
    size,
    radius: radiusFromMass(partial.mass) * size,
    pos: clone(partial.pos),
    vel: clone(partial.vel ?? vec3()),
    alive: true,
    spin: 0,
    spinRate: partial.spinRate ?? partial.spin ?? 0.15,
    obliquity: partial.obliquity ?? 0,
    orbitSign: partial.orbitSign ?? 1,
    ephemeral: partial.ephemeral ?? false,
    peerGravity: partial.peerGravity ?? true,
  };
}

export function cloneBody(body: Body): Body {
  return {
    ...body,
    pos: clone(body.pos),
    vel: clone(body.vel),
  };
}

export function cloneBodies(bodies: readonly Body[]): Body[] {
  return bodies.map(cloneBody);
}
