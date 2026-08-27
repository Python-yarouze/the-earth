import type { AppearanceId } from "../physics/body";
import { REAL_PLACEABLE_IDS, UNLOCKABLE_IDS, catalogLabel } from "./catalog";
import {
  DISCOVERIES,
  evaluateDiscoveries,
  type DiscoveryId,
} from "./discoveries";

const KEY = "the-earth-unlocks";

export type ExtraUnlock = "solarsystem" | "extraSlots" | "zen" | "chime" | "chimeLoop";

export interface ExtraDef {
  id: ExtraUnlock;
  label: string;
  hint: string;
  /** Unlocked catalog blurb. */
  flavor: string;
}

/** 奏でる plays needed before ながす unlocks. */
export const CHIME_LOOP_THRESHOLD = 5;

export const EXTRA_DEFS: readonly ExtraDef[] = [
  {
    id: "solarsystem",
    label: "太陽系を置く",
    hint: "太陽系の石をすべてそろえた先に",
    flavor: "いまの太陽系を、ひと息で並べ直せる。",
  },
  {
    id: "extraSlots",
    label: "置ける数が増えた",
    hint: "もっと長く眺めた先に",
    flavor: "空に置ける惑星の上限が、少しだけ広がる。",
  },
  {
    id: "zen",
    label: "静けさを覚えた",
    hint: "長い時間、軌道を見守った先に",
    flavor: "眺め続けた手応え。ねむい石への道でもある。",
  },
  {
    id: "chime",
    label: "奏でる",
    hint: "同じ惑星が二つある安定の先に",
    flavor: "同じ星が二つ以上ある安定で、系が音になる。距離の順に光って鳴る。",
  },
  {
    id: "chimeLoop",
    label: "ながす",
    hint: "奏でるを何度か聴いた先に",
    flavor: "一度きりでなく、系の音が静かにながれ続ける。",
  },
];

const EXTRAS: ExtraUnlock[] = EXTRA_DEFS.map((e) => e.id);

export function extraLabel(id: ExtraUnlock): string {
  return EXTRA_DEFS.find((e) => e.id === id)?.label ?? id;
}

export function extraHint(id: ExtraUnlock): string {
  return EXTRA_DEFS.find((e) => e.id === id)?.hint ?? "まだ見ぬこと";
}

export function extraFlavor(id: ExtraUnlock): string {
  return EXTRA_DEFS.find((e) => e.id === id)?.flavor ?? "";
}

export function hasExtra(progress: Progress, id: ExtraUnlock): boolean {
  return progress.extras.includes(id);
}

export function hasChime(progress: Progress): boolean {
  return progress.extras.includes("chime");
}

export function hasChimeLoop(progress: Progress): boolean {
  return progress.extras.includes("chimeLoop");
}

export interface Progress {
  unlocked: AppearanceId[];
  extras: ExtraUnlock[];
  discoveries: DiscoveryId[];
  hasPlayed: boolean;
  watchSec: number;
  balances: number;
  tiltedBalances: number;
  fourBodyBalances: number;
  jupiterBalances: number;
  longStables: number;
  twinBalances: number;
  meteorsSeen: number;
  shipsSeen: number;
  merges: number;
  shatters: number;
  disrupts: number;
  sunImpacts: number;
  maxMergedMass: number;
  moonSurviveSec: number;
  cometSeen: number;
  swarmSeen: number;
  flareSeen: number;
  blackHoleSeen: boolean;
  bigBangSeen: boolean;
  watchedAfterCollapse: boolean;
  copiedBalanced: boolean;
  movedEarth: boolean;
  placedExtra: boolean;
  /** Successful 奏でる plays; gates ながす. */
  chimesPlayed: number;
}

const DISCOVERY_IDS = new Set(DISCOVERIES.map((d) => d.id));

export function defaultProgress(): Progress {
  return {
    unlocked: ["mars"],
    extras: [],
    discoveries: [],
    hasPlayed: false,
    watchSec: 0,
    balances: 0,
    tiltedBalances: 0,
    fourBodyBalances: 0,
    jupiterBalances: 0,
    longStables: 0,
    twinBalances: 0,
    meteorsSeen: 0,
    shipsSeen: 0,
    merges: 0,
    shatters: 0,
    disrupts: 0,
    sunImpacts: 0,
    maxMergedMass: 0,
    moonSurviveSec: 0,
    cometSeen: 0,
    swarmSeen: 0,
    flareSeen: 0,
    blackHoleSeen: false,
    bigBangSeen: false,
    watchedAfterCollapse: false,
    copiedBalanced: false,
    movedEarth: false,
    placedExtra: false,
    chimesPlayed: 0,
  };
}

function uniqueIds(ids: AppearanceId[]): AppearanceId[] {
  return [...new Set(ids)];
}

function uniqueExtras(extras: ExtraUnlock[]): ExtraUnlock[] {
  return [...new Set(extras.filter((e) => EXTRAS.includes(e)))];
}

function uniqueDiscoveries(ids: unknown): DiscoveryId[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  return [...new Set(ids.filter((id): id is DiscoveryId => DISCOVERY_IDS.has(id as DiscoveryId)))];
}

export function loadProgress(): Progress {
  const fallback = defaultProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const unlocked = uniqueIds(
      (parsed.unlocked ?? ["mars"]).filter((id): id is AppearanceId =>
        UNLOCKABLE_IDS.includes(id as AppearanceId),
      ),
    );
    if (!unlocked.includes("mars")) {
      unlocked.unshift("mars");
    }
    const extras = uniqueExtras(parsed.extras ?? []);
    if (extras.includes("solarsystem") && !unlocked.includes("sun")) {
      unlocked.push("sun");
    }
    return {
      ...fallback,
      unlocked,
      extras,
      discoveries: uniqueDiscoveries(parsed.discoveries),
      hasPlayed: Boolean(parsed.hasPlayed),
      watchSec: Number(parsed.watchSec) || 0,
      balances: Number(parsed.balances) || 0,
      tiltedBalances: Number(parsed.tiltedBalances) || 0,
      fourBodyBalances: Number(parsed.fourBodyBalances) || 0,
      jupiterBalances: Number(parsed.jupiterBalances) || 0,
      longStables: Number(parsed.longStables) || 0,
      twinBalances: Number(parsed.twinBalances) || 0,
      meteorsSeen: Number(parsed.meteorsSeen) || 0,
      shipsSeen: Number(parsed.shipsSeen) || 0,
      merges: Number(parsed.merges) || 0,
      shatters: Number(parsed.shatters) || 0,
      disrupts: Number(parsed.disrupts) || 0,
      sunImpacts: Number(parsed.sunImpacts) || 0,
      maxMergedMass: Number(parsed.maxMergedMass) || 0,
      moonSurviveSec: Number(parsed.moonSurviveSec) || 0,
      cometSeen: Number(parsed.cometSeen) || 0,
      swarmSeen: Number(parsed.swarmSeen) || 0,
      flareSeen: Number(parsed.flareSeen) || 0,
      blackHoleSeen: Boolean(parsed.blackHoleSeen),
      bigBangSeen: Boolean(parsed.bigBangSeen),
      watchedAfterCollapse: Boolean(parsed.watchedAfterCollapse),
      copiedBalanced: Boolean(parsed.copiedBalanced || (parsed as { copiedShare?: boolean }).copiedShare),
      movedEarth: Boolean(parsed.movedEarth),
      placedExtra: Boolean(parsed.placedExtra),
      chimesPlayed: Number(parsed.chimesPlayed) || 0,
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

export function isUnlocked(progress: Progress, id: AppearanceId): boolean {
  return progress.unlocked.includes(id);
}

export function hasSolarPreset(progress: Progress): boolean {
  return progress.extras.includes("solarsystem");
}

export function hasExtraSlots(progress: Progress): boolean {
  return progress.extras.includes("extraSlots");
}

export function unlockTotal(progress: Progress): { have: number; total: number } {
  return {
    have: progress.unlocked.length + progress.extras.length + progress.discoveries.length,
    total: UNLOCKABLE_IDS.length + EXTRAS.length + DISCOVERIES.length,
  };
}

function grant(
  progress: Progress,
  id: AppearanceId,
  notices: string[],
  granted: AppearanceId[],
): Progress {
  if (progress.unlocked.includes(id)) {
    return progress;
  }
  notices.push(`${catalogLabel(id)}が置けるようになった`);
  granted.push(id);
  return { ...progress, unlocked: [...progress.unlocked, id] };
}

function grantExtra(progress: Progress, extra: ExtraUnlock, notice: string, notices: string[]): Progress {
  if (progress.extras.includes(extra)) {
    return progress;
  }
  notices.push(notice);
  return { ...progress, extras: [...progress.extras, extra] };
}

/**
 * Mostly paced by total watch time; a few whimsical stones keep special gates.
 */
export function tickUnlocks(progress: Progress): {
  progress: Progress;
  notices: string[];
  grantedAppearances: AppearanceId[];
} {
  const notices: string[] = [];
  const grantedAppearances: AppearanceId[] = [];
  let next = progress;
  const t = next.watchSec;

  // Real planets — time ladder.
  if (t >= 60) {
    next = grant(next, "mercury", notices, grantedAppearances);
  }
  if (t >= 180) {
    next = grant(next, "venus", notices, grantedAppearances);
  }
  if (t >= 360) {
    next = grant(next, "moon", notices, grantedAppearances);
  }
  if (t >= 600) {
    next = grant(next, "jupiter", notices, grantedAppearances);
  }
  if (t >= 900) {
    next = grant(next, "saturn", notices, grantedAppearances);
  }
  if (t >= 1200) {
    next = grant(next, "uranus", notices, grantedAppearances);
  }
  if (t >= 1800) {
    next = grant(next, "neptune", notices, grantedAppearances);
  }
  if (t >= 2700) {
    next = grant(next, "pluto", notices, grantedAppearances);
  }
  if (t >= 3600) {
    next = grant(next, "asteroid", notices, grantedAppearances);
  }

  // Fantasy — mostly time.
  if (t >= 480) {
    next = grant(next, "gaming", notices, grantedAppearances);
  }
  if (t >= 720) {
    next = grant(next, "glass", notices, grantedAppearances);
  }
  if (t >= 960) {
    next = grant(next, "puff", notices, grantedAppearances);
  }
  if (t >= 1200) {
    next = grant(next, "brick", notices, grantedAppearances);
  }
  if (t >= 1500) {
    next = grant(next, "mirror", notices, grantedAppearances);
  }
  if (t >= 1650) {
    next = grant(next, "discoball", notices, grantedAppearances);
  }
  if (t >= 1800) {
    next = grant(next, "dice", notices, grantedAppearances);
  }
  if (t >= 2100) {
    next = grant(next, "bubble", notices, grantedAppearances);
  }
  if (t >= 2400) {
    next = grant(next, "clock", notices, grantedAppearances);
  }
  if (t >= 3000) {
    next = grant(next, "contrarian", notices, grantedAppearances);
  }
  if (t >= 3300) {
    next = grant(next, "takoyaki", notices, grantedAppearances);
  }
  if (t >= 3900) {
    next = grant(next, "sideslip", notices, grantedAppearances);
  }
  if (t >= 4500) {
    next = grant(next, "drowsy", notices, grantedAppearances);
  }

  // Special fantasy gates.
  if (next.moonSurviveSec >= 30) {
    next = grant(next, "snowball", notices, grantedAppearances);
  }
  if (next.sunImpacts >= 1) {
    next = grant(next, "ember", notices, grantedAppearances);
  }
  if (next.watchedAfterCollapse || next.blackHoleSeen) {
    next = grant(next, "voidseed", notices, grantedAppearances);
  }
  if (next.shipsSeen >= 1) {
    next = grant(next, "sparkle", notices, grantedAppearances);
  }
  if (next.cometSeen >= 1) {
    next = grant(next, "puddle", notices, grantedAppearances);
  }
  if (next.flareSeen >= 1) {
    next = grant(next, "thunder", notices, grantedAppearances);
  }
  if (next.shatters >= 2) {
    next = grant(next, "crumbly", notices, grantedAppearances);
  }
  if (next.sunImpacts >= 3) {
    next = grant(next, "relic", notices, grantedAppearances);
  }

  if (REAL_PLACEABLE_IDS.every((id) => next.unlocked.includes(id))) {
    next = grantExtra(next, "solarsystem", "いまの太陽系が置けるようになった", notices);
  }
  if (next.extras.includes("solarsystem")) {
    next = grant(next, "sun", notices, grantedAppearances);
  }
  if (t >= 2400 || next.balances >= 10) {
    next = grantExtra(next, "extraSlots", "置ける数が増えた", notices);
  }
  if (t >= 7200) {
    next = grantExtra(next, "zen", "静けさを覚えた", notices);
  }
  if (next.twinBalances >= 1) {
    next = grantExtra(next, "chime", "系が鳴るようになった", notices);
  }
  if (next.chimesPlayed >= CHIME_LOOP_THRESHOLD) {
    next = grantExtra(next, "chimeLoop", "音がながせるようになった", notices);
  }

  const discovered = evaluateDiscoveries(next);
  next = discovered.progress;
  notices.push(...discovered.notices);

  return { progress: next, notices, grantedAppearances };
}

export function markPlayed(progress: Progress): Progress {
  if (progress.hasPlayed) {
    return progress;
  }
  return { ...progress, hasPlayed: true };
}

/** True when any non-ephemeral appearance appears at least twice. */
export function hasDuplicateAppearance(bodies: readonly { alive: boolean; ephemeral?: boolean; appearance: AppearanceId }[]): boolean {
  const counts = new Map<AppearanceId, number>();
  for (const b of bodies) {
    if (!b.alive || b.ephemeral) {
      continue;
    }
    counts.set(b.appearance, (counts.get(b.appearance) ?? 0) + 1);
  }
  for (const n of counts.values()) {
    if (n >= 2) {
      return true;
    }
  }
  return false;
}
