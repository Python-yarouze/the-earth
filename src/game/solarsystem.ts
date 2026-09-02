import { makeCatalogBody } from "./catalog";
import type { AppearanceId, Body } from "../physics/body";
import { G } from "../physics/constants";
import { MOON_ORBIT_R, twoBodyCircular } from "../physics/engine";
import { add, cross, length, normalize, scale, sub, vec3, type Vec3 } from "../physics/vec3";

/** Compressed orbits. Earth stays near r=100. Inclination and node are ecliptic J2000 degrees. */
export const SOLAR_ORBITS: readonly {
  id: AppearanceId;
  r: number;
  angle: number;
  incl: number;
  node: number;
}[] = [
  { id: "mercury", r: 52, angle: 0.3, incl: 7.005, node: 48.331 },
  { id: "venus", r: 78, angle: 1.4, incl: 3.395, node: 76.68 },
  { id: "earth", r: 108, angle: 2.5, incl: 0, node: 0 },
  { id: "mars", r: 145, angle: 3.4, incl: 1.85, node: 49.558 },
  { id: "jupiter", r: 220, angle: 4.2, incl: 1.304, node: 100.464 },
  { id: "saturn", r: 275, angle: 5.0, incl: 2.485, node: 113.665 },
  { id: "uranus", r: 330, angle: 5.6, incl: 0.773, node: 74.006 },
  { id: "neptune", r: 390, angle: 6.1, incl: 1.77, node: 131.784 },
];

const MOON_INCL_DEG = 5.145;
const MOON_NODE_DEG = 125.08;

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Position in the ecliptic frame. World Y is the ecliptic pole. */
export function eclipticPosition(
  r: number,
  trueLongRad: number,
  inclDeg: number,
  nodeDeg: number,
): Vec3 {
  const i = degToRad(inclDeg);
  const om = degToRad(nodeDeg);
  const u = trueLongRad - om;
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  const com = Math.cos(om);
  const som = Math.sin(om);
  return vec3(
    r * (com * cu - som * su * ci),
    r * (su * si),
    r * (som * cu + com * su * ci),
  );
}

export function eclipticNormal(inclDeg: number, nodeDeg: number): Vec3 {
  const i = degToRad(inclDeg);
  const om = degToRad(nodeDeg);
  return vec3(Math.sin(i) * Math.sin(om), Math.cos(i), -Math.sin(i) * Math.cos(om));
}

function applySolarPresetOrbits(bodies: Body[]): void {
  const sun = bodies.find((b) => b.kind === "sun");
  if (!sun) {
    return;
  }
  const earth = bodies.find((b) => b.kind === "earth");
  let px = 0;
  let py = 0;
  let pz = 0;
  for (const b of bodies) {
    if (b.kind === "sun" || b.appearance === "moon") {
      continue;
    }
    const orbit = SOLAR_ORBITS.find((o) => o.id === b.appearance);
    const n = eclipticNormal(orbit?.incl ?? 0, orbit?.node ?? 0);
    const rVec = sub(b.pos, sun.pos);
    const r = length(rVec);
    if (r < 1e-6) {
      continue;
    }
    let t = cross(n, rVec);
    if (length(t) < 1e-8) {
      t = cross(vec3(0, 1, 0), rVec);
    }
    t = normalize(t);
    // Sun-dominated circular speed (ignore planet mass) keeps the preset coherent.
    const speed = Math.sqrt((G * sun.mass) / r);
    b.vel = scale(t, speed);
    px += b.mass * b.vel.x;
    py += b.mass * b.vel.y;
    pz += b.mass * b.vel.z;
  }
  sun.vel = vec3(-px / sun.mass, -py / sun.mass, -pz / sun.mass);

  const moon = bodies.find((b) => b.appearance === "moon");
  if (!earth || !moon) {
    return;
  }
  const n = eclipticNormal(MOON_INCL_DEG, MOON_NODE_DEG);
  const circ = twoBodyCircular(earth, moon, G, n);
  // Retrograde relative orbit — smooth and durable at this scale.
  moon.vel = add(earth.vel, scale(circ.planetVel, -1));
}

export function solarSystemBodies(): Body[] {
  const sun = makeCatalogBody("sun", vec3(0, 0, 0));
  sun.core = true;
  const planets = SOLAR_ORBITS.map((o) =>
    makeCatalogBody(o.id, eclipticPosition(o.r, o.angle, o.incl, o.node)),
  );
  const earth = planets.find((b) => b.kind === "earth");
  if (earth) {
    earth.core = true;
  }
  const bodies = [sun, ...planets];
  if (earth) {
    const n = eclipticNormal(MOON_INCL_DEG, MOON_NODE_DEG);
    let along = cross(n, earth.pos);
    if (length(along) < 1e-8) {
      along = vec3(0, 0, 1);
    }
    along = normalize(along);
    bodies.push(makeCatalogBody("moon", add(earth.pos, scale(along, MOON_ORBIT_R))));
  }
  applySolarPresetOrbits(bodies);
  for (const b of bodies) {
    if (b.kind !== "sun") {
      b.peerGravity = false;
    }
  }
  return bodies;
}
