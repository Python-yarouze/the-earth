import type { AppearanceId, Body, BodyKind } from "../physics/body";
import { createBody } from "../physics/body";
import { EARTH_MASS, SUN_MASS } from "../physics/constants";
import type { Vec3 } from "../physics/vec3";

export interface CatalogEntry {
  id: AppearanceId;
  label: string;
  kind: BodyKind;
  mass: number;
  size: number;
  /** Spin rate in rad/s. Negative = retrograde. */
  spin: number;
  /** Axial tilt in degrees. */
  obliquity: number;
  /** Orbital direction: 1 prograde, -1 retrograde. */
  orbitSign?: 1 | -1;
  swatch: string;
}

function tilt(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Playable masses: Sun 1000, Earth 12. Relative feel, not SI. */
export const CATALOG: readonly CatalogEntry[] = [
  { id: "sun", label: "太陽", kind: "sun", mass: SUN_MASS, size: 0.72, spin: 0.06, obliquity: 7.25, swatch: "#f0c060" },
  { id: "mercury", label: "水星", kind: "planet", mass: 0.06, size: 0.55, spin: 0.1, obliquity: 0.03, swatch: "#9a8f82" },
  { id: "venus", label: "金星", kind: "planet", mass: 0.82, size: 0.95, spin: -0.04, obliquity: 177.4, swatch: "#d4b48a" },
  { id: "earth", label: "地球", kind: "earth", mass: EARTH_MASS, size: 0.55, spin: 0.55, obliquity: 23.4, swatch: "#6a9ecb" },
  { id: "moon", label: "月", kind: "planet", mass: 0.012, size: 0.38, spin: 0.2, obliquity: 6.7, swatch: "#c8c2b4" },
  { id: "mars", label: "火星", kind: "planet", mass: 0.11, size: 0.7, spin: 0.52, obliquity: 25.2, swatch: "#c47a4a" },
  { id: "jupiter", label: "木星", kind: "planet", mass: 48, size: 1.55, spin: 1.35, obliquity: 3.1, swatch: "#d4b48a" },
  { id: "saturn", label: "土星", kind: "planet", mass: 18, size: 1.4, spin: 1.2, obliquity: 26.7, swatch: "#e0d0a8" },
  { id: "uranus", label: "天王星", kind: "planet", mass: 6, size: 1.15, spin: -0.7, obliquity: 97.8, swatch: "#9bd4d0" },
  { id: "neptune", label: "海王星", kind: "planet", mass: 7, size: 1.12, spin: 0.75, obliquity: 28.3, swatch: "#5a7ab0" },
  { id: "pluto", label: "冥王星", kind: "planet", mass: 0.002, size: 0.42, spin: 0.14, obliquity: 122.5, swatch: "#b8a090" },
  { id: "asteroid", label: "小惑星", kind: "planet", mass: 0.008, size: 0.32, spin: 1.1, obliquity: 15, swatch: "#6a6058" },
  { id: "meteor", label: "隕石", kind: "meteor", mass: 0.04, size: 0.35, spin: 1.6, obliquity: 40, swatch: "#5a5048" },
  { id: "comet", label: "彗星", kind: "meteor", mass: 0.015, size: 0.4, spin: 0.9, obliquity: 50, swatch: "#a8c4d8" },
  { id: "blackhole", label: "暗い点", kind: "planet", mass: 1500, size: 0.4, spin: 0.02, obliquity: 0, swatch: "#1a1018" },
  // Fantasy stones — unlock rewards, not part of the solar preset set.
  { id: "gaming", label: "ゲーミング", kind: "planet", mass: 0.4, size: 0.85, spin: 1.8, obliquity: 12, swatch: "#39ff14" },
  { id: "glass", label: "ガラス球", kind: "planet", mass: 1.2, size: 0.9, spin: 0.35, obliquity: 8, swatch: "#c8e8f8" },
  { id: "puff", label: "わたぼうし", kind: "planet", mass: 0.05, size: 1.8, spin: 0.25, obliquity: 18, swatch: "#efe8dc" },
  { id: "brick", label: "れんが", kind: "planet", mass: 22, size: 0.55, spin: 0.08, obliquity: 5, swatch: "#6b3a24" },
  { id: "mirror", label: "かがみ", kind: "planet", mass: 2.5, size: 0.75, spin: 0.6, obliquity: 2, swatch: "#d0d8e0" },
  { id: "discoball", label: "ミラーボール", kind: "planet", mass: 3.8, size: 0.88, spin: 1.4, obliquity: 18, swatch: "#c8d4e0" },
  { id: "snowball", label: "ゆきだま", kind: "planet", mass: 0.2, size: 0.7, spin: -0.45, obliquity: 35, swatch: "#f2f7fb" },
  { id: "ember", label: "おにび", kind: "planet", mass: 3.5, size: 0.8, spin: 0.9, obliquity: 14, swatch: "#80d0ff" },
  { id: "contrarian", label: "ぎゃくまわり", kind: "planet", mass: 1.5, size: 0.85, spin: 0.4, obliquity: 22, orbitSign: -1, swatch: "#8866aa" },
  { id: "dice", label: "さいころ", kind: "planet", mass: 0.9, size: 0.65, spin: 1.2, obliquity: 55, swatch: "#f0e8d8" },
  { id: "bubble", label: "しゃぼん", kind: "planet", mass: 0.15, size: 1.1, spin: 0.3, obliquity: 10, swatch: "#b8e0f0" },
  { id: "clock", label: "とけい", kind: "planet", mass: 4, size: 0.95, spin: 0.12, obliquity: 88, swatch: "#e8dcc0" },
  { id: "voidseed", label: "くろつぶ", kind: "planet", mass: 35, size: 0.28, spin: 0.05, obliquity: 0, swatch: "#1a1420" },
  { id: "sparkle", label: "ぴかぴか", kind: "planet", mass: 0.35, size: 0.7, spin: 1.6, obliquity: 20, swatch: "#ffe8a0" },
  { id: "drowsy", label: "ねむい", kind: "planet", mass: 8, size: 1.05, spin: 0.02, obliquity: 4, swatch: "#3a4050" },
  { id: "takoyaki", label: "たこやき", kind: "planet", mass: 28, size: 0.7, spin: 0.15, obliquity: 8, swatch: "#6b2e18" },
  { id: "puddle", label: "みずたまり", kind: "planet", mass: 0.55, size: 1.0, spin: 0.28, obliquity: 6, swatch: "#5a9ec8" },
  { id: "thunder", label: "かみなり", kind: "planet", mass: 2.2, size: 0.8, spin: 1.1, obliquity: 30, swatch: "#c8b0ff" },
  { id: "crumbly", label: "ぼこぼこ", kind: "planet", mass: 1.1, size: 0.72, spin: 0.7, obliquity: 40, swatch: "#9a8a70" },
  { id: "sideslip", label: "よこすべり", kind: "planet", mass: 3.2, size: 0.9, spin: 0.45, obliquity: 78, swatch: "#70a090" },
  { id: "relic", label: "ピンポン", kind: "planet", mass: 6.5, size: 0.5, spin: 0.2, obliquity: 15, swatch: "#f07828" },
  { id: "destroyer", label: "破壊星", kind: "planet", mass: 12000, size: 5.0, spin: 0.04, obliquity: 0, swatch: "#303038" },
];

/** Real solar-system stones (gates the solar preset unlock). */
export const REAL_PLACEABLE_IDS: readonly AppearanceId[] = [
  "mercury",
  "venus",
  "moon",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "asteroid",
];

/** Whimsical unlock stones. */
export const FANTASY_PLACEABLE_IDS: readonly AppearanceId[] = [
  "gaming",
  "glass",
  "puff",
  "brick",
  "mirror",
  "discoball",
  "snowball",
  "ember",
  "contrarian",
  "dice",
  "bubble",
  "clock",
  "voidseed",
  "sparkle",
  "drowsy",
  "takoyaki",
  "puddle",
  "thunder",
  "crumbly",
  "sideslip",
  "relic",
];

/** Palette stones the player can place. Mars is free; the rest unlock. */
export const PLACEABLE_IDS: readonly AppearanceId[] = [
  ...REAL_PLACEABLE_IDS,
  ...FANTASY_PLACEABLE_IDS,
];

/** Appearances that may appear in progress.unlocked (placeables + sandbox sun + earth). */
export const UNLOCKABLE_IDS: readonly AppearanceId[] = [...PLACEABLE_IDS, "earth", "sun"];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id: AppearanceId): CatalogEntry {
  const e = BY_ID.get(id);
  if (!e) {
    throw new Error(`Unknown catalog id: ${id}`);
  }
  return e;
}

export function catalogLabel(id: AppearanceId): string {
  return catalogEntry(id).label;
}

export function makeCatalogBody(id: AppearanceId, pos: Vec3): Body {
  const e = catalogEntry(id);
  return createBody({
    kind: e.kind,
    appearance: e.id,
    mass: e.mass,
    size: e.size,
    spinRate: e.spin,
    obliquity: tilt(e.obliquity),
    orbitSign: e.orbitSign ?? 1,
    pos,
  });
}
