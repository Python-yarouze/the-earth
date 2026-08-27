import { makeCatalogBody } from "./catalog";
import type { AppearanceId, Body } from "../physics/body";
import { vec3 } from "../physics/vec3";

const CODE: Record<string, AppearanceId> = {
  S: "sun",
  E: "earth",
  L: "moon",
  m: "mercury",
  v: "venus",
  M: "mars",
  j: "jupiter",
  s: "saturn",
  u: "uranus",
  n: "neptune",
  p: "pluto",
  a: "asteroid",
  g: "gaming",
  G: "glass",
  F: "puff",
  K: "brick",
  r: "mirror",
  B: "discoball",
  w: "snowball",
  e: "ember",
  x: "contrarian",
  d: "dice",
  o: "bubble",
  t: "clock",
  z: "voidseed",
  h: "sparkle",
  y: "drowsy",
  T: "takoyaki",
  q: "puddle",
  H: "thunder",
  Q: "crumbly",
  i: "sideslip",
  R: "relic",
};

const FROM_ID: Partial<Record<AppearanceId, string>> = {
  sun: "S",
  earth: "E",
  moon: "L",
  mercury: "m",
  venus: "v",
  mars: "M",
  jupiter: "j",
  saturn: "s",
  uranus: "u",
  neptune: "n",
  pluto: "p",
  asteroid: "a",
  gaming: "g",
  glass: "G",
  puff: "F",
  brick: "K",
  mirror: "r",
  discoball: "B",
  snowball: "w",
  ember: "e",
  contrarian: "x",
  dice: "d",
  bubble: "o",
  clock: "t",
  voidseed: "z",
  sparkle: "h",
  drowsy: "y",
  takoyaki: "T",
  puddle: "q",
  thunder: "H",
  crumbly: "Q",
  sideslip: "i",
  relic: "R",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function shareableBodies(bodies: readonly Body[]): Body[] {
  return bodies.filter((b) => b.alive && !b.ephemeral && b.kind !== "meteor");
}

/** Hash fragment `#s=...` for GitHub Pages. Velocities are not stored. */
export function encodeShare(bodies: readonly Body[]): string {
  const rows = shareableBodies(bodies)
    .map((b) => {
      const code = FROM_ID[b.appearance];
      if (!code) {
        return null;
      }
      return [code, round1(b.pos.x), round1(b.pos.y), round1(b.pos.z)];
    })
    .filter((row): row is [string, number, number, number] => row !== null);
  return `#s=${toB64Url(JSON.stringify({ v: 1, b: rows }))}`;
}

export function decodeShare(hash: string): Body[] | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith("s=")) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64Url(raw.slice(2))) as { v?: number; b?: unknown };
    if (payload.v !== 1 || !Array.isArray(payload.b)) {
      return null;
    }
    const bodies: Body[] = [];
    for (const row of payload.b) {
      if (!Array.isArray(row) || row.length < 4) {
        continue;
      }
      const code = String(row[0]);
      const id = CODE[code];
      if (!id) {
        continue;
      }
      const x = Number(row[1]);
      const y = Number(row[2]);
      const z = Number(row[3]);
      if (![x, y, z].every(Number.isFinite)) {
        continue;
      }
      bodies.push(makeCatalogBody(id, vec3(x, y, z)));
    }
    if (!bodies.some((b) => b.kind === "sun") || !bodies.some((b) => b.kind === "earth")) {
      return null;
    }
    return bodies;
  } catch {
    return null;
  }
}
