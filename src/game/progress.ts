import type { AppearanceId } from "../physics/body";
import { REAL_PLACEABLE_IDS, UNLOCKABLE_IDS, catalogLabel } from "./catalog";
import {
  DISCOVERIES,
  evaluateDiscoveries,
  type DiscoveryId,
} from "./discoveries";

const KEY = "the-earth-unlocks";

export type ExtraUnlock = "solarsystem" | "extraSlots" | "zen" | "chime" | "chimeLoop";

/** Cumulative watch time required before the sun stone unlocks. */
export const SUN_WATCH_SEC = 14400;

/** Long stable (60s) episodes required for sun unlock. */
export const SUN_LONG_STABLES = 3;

/** Manual body count for twelveBodyBalances / sideslip. */
export const TWELVE_BODY_THRESHOLD = 12;

export interface ExtraDef {
  id: ExtraUnlock;
  label: string;
  hint: string;
  flavor: string;
}

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
  chimesPlayed: number;
  povCameraUsed: boolean;
  shareUsed: boolean;
  randomPlacementUsed: boolean;
  solarPresetBalanced: boolean;
  twelveBodyBalances: number;
  destroyerSeen: boolean;
  /** Counters snapshotted when the solar-system gate first opens. */
  postSolarBaselines: PostSolarBaselines | null;
  watchedAfterCollapsePostSolar: boolean;
  blackHoleSeenPostSolar: boolean;
}

export interface PostSolarBaselines {
  watchSec: number;
  sessionYears: number;
  sunImpacts: number;
  moonSurviveSec: number;
  shipsSeen: number;
  shatters: number;
  twinBalances: number;
  tiltedBalances: number;
  twelveBodyBalances: number;
  longStables: number;
  cometSeen: number;
}

export interface UnlockContext {
  sessionYears: number;
  realYear: number;
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
    povCameraUsed: false,
    shareUsed: false,
    randomPlacementUsed: false,
    solarPresetBalanced: false,
    twelveBodyBalances: 0,
    destroyerSeen: false,
    postSolarBaselines: null,
    watchedAfterCollapsePostSolar: false,
    blackHoleSeenPostSolar: false,
  };
}

function zeroPostSolarBaselines(): PostSolarBaselines {
  return {
    watchSec: 0,
    sessionYears: 0,
    sunImpacts: 0,
    moonSurviveSec: 0,
    shipsSeen: 0,
    shatters: 0,
    twinBalances: 0,
    tiltedBalances: 0,
    twelveBodyBalances: 0,
    longStables: 0,
    cometSeen: 0,
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

export function hasSolarComplete(progress: Progress): boolean {
  return REAL_PLACEABLE_IDS.every((id) => progress.unlocked.includes(id));
}

/** Snapshot counters when the solar gate opens; only growth after this counts for non-solar unlocks. */
export function capturePostSolarBaselines(progress: Progress, ctx: UnlockContext): Progress {
  if (!hasSolarComplete(progress) || progress.postSolarBaselines) {
    return progress;
  }
  const baselines: PostSolarBaselines = {
    watchSec: progress.watchSec,
    sessionYears: ctx.sessionYears,
    sunImpacts: progress.sunImpacts,
    moonSurviveSec: progress.moonSurviveSec,
    shipsSeen: progress.shipsSeen,
    shatters: progress.shatters,
    twinBalances: progress.twinBalances,
    tiltedBalances: progress.tiltedBalances,
    twelveBodyBalances: progress.twelveBodyBalances,
    longStables: progress.longStables,
    cometSeen: progress.cometSeen,
  };
  return {
    ...progress,
    postSolarBaselines: baselines,
    povCameraUsed: false,
    shareUsed: false,
    randomPlacementUsed: false,
    solarPresetBalanced: false,
    watchedAfterCollapsePostSolar: false,
    blackHoleSeenPostSolar: false,
  };
}

type PostSolarCounterKey = Exclude<keyof PostSolarBaselines, "sessionYears">;

function postSolarCount(progress: Progress, key: PostSolarCounterKey): number {
  if (!hasSolarComplete(progress)) {
    return 0;
  }
  const baselines = progress.postSolarBaselines ?? zeroPostSolarBaselines();
  return Math.max(0, progress[key] - baselines[key]);
}

function postSolarYears(progress: Progress, ctx: UnlockContext): number {
  if (!hasSolarComplete(progress)) {
    return 0;
  }
  const baselines = progress.postSolarBaselines ?? zeroPostSolarBaselines();
  return Math.max(0, ctx.sessionYears - baselines.sessionYears);
}

function sunUnlockReady(progress: Progress): boolean {
  return (
    hasSolarComplete(progress) &&
    postSolarCount(progress, "watchSec") >= SUN_WATCH_SEC &&
    postSolarCount(progress, "twelveBodyBalances") >= 1 &&
    postSolarCount(progress, "longStables") >= SUN_LONG_STABLES
  );
}

export function loadProgress(): Progress {
  const fallback = defaultProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<Progress> & {
      fourBodyBalances?: number;
      eightBodyBalances?: number;
    };
    const unlocked = uniqueIds(
      (parsed.unlocked ?? ["mars"]).filter((id): id is AppearanceId =>
        UNLOCKABLE_IDS.includes(id as AppearanceId),
      ),
    );
    if (!unlocked.includes("mars")) {
      unlocked.unshift("mars");
    }
    const extras = uniqueExtras(parsed.extras ?? []);
    const twelveBodyBalances =
      Number(parsed.twelveBodyBalances) ||
      Number((parsed as { eightBodyBalances?: number }).eightBodyBalances) ||
      (Number((parsed as { fourBodyBalances?: number }).fourBodyBalances) >= 1 ? 1 : 0);
    const solarComplete = REAL_PLACEABLE_IDS.every((id) => unlocked.includes(id));
    const loaded: Progress = {
      ...fallback,
      unlocked,
      extras,
      discoveries: uniqueDiscoveries(parsed.discoveries),
      hasPlayed: Boolean(parsed.hasPlayed),
      watchSec: Number(parsed.watchSec) || 0,
      balances: Number(parsed.balances) || 0,
      tiltedBalances: Number(parsed.tiltedBalances) || 0,
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
      povCameraUsed: Boolean(parsed.povCameraUsed),
      shareUsed: Boolean(parsed.shareUsed),
      randomPlacementUsed: Boolean(parsed.randomPlacementUsed),
      solarPresetBalanced: Boolean(parsed.solarPresetBalanced),
      twelveBodyBalances,
      destroyerSeen: Boolean(parsed.destroyerSeen),
      postSolarBaselines: solarComplete
        ? (parsed.postSolarBaselines ?? zeroPostSolarBaselines())
        : null,
      watchedAfterCollapsePostSolar: Boolean(parsed.watchedAfterCollapsePostSolar),
      blackHoleSeenPostSolar: Boolean(parsed.blackHoleSeenPostSolar),
    };
    return loaded;
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

function grantFantasy(
  progress: Progress,
  id: AppearanceId,
  notices: string[],
  granted: AppearanceId[],
): Progress {
  if (!hasSolarComplete(progress)) {
    return progress;
  }
  return grant(progress, id, notices, granted);
}

export function tickUnlocks(
  progress: Progress,
  ctx: UnlockContext = { sessionYears: 0, realYear: new Date().getFullYear() },
): {
  progress: Progress;
  notices: string[];
  grantedAppearances: AppearanceId[];
} {
  const notices: string[] = [];
  const grantedAppearances: AppearanceId[] = [];
  let next = progress;
  const t = next.watchSec;

  // Real planets — cumulative watch time (always counts from game start).
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

  next = capturePostSolarBaselines(next, ctx);

  const years = postSolarYears(next, ctx);
  const impacts = postSolarCount(next, "sunImpacts");
  const moonSec = postSolarCount(next, "moonSurviveSec");
  const ships = postSolarCount(next, "shipsSeen");
  const shatters = postSolarCount(next, "shatters");
  const twins = postSolarCount(next, "twinBalances");
  const tilted = postSolarCount(next, "tiltedBalances");
  const twelve = postSolarCount(next, "twelveBodyBalances");
  const stables = postSolarCount(next, "longStables");
  const comets = postSolarCount(next, "cometSeen");

  // Fantasy — session years (after solar complete, post-gate years only).
  if (years >= 50) {
    next = grantFantasy(next, "puff", notices, grantedAppearances);
  }
  if (years >= 100) {
    next = grantFantasy(next, "clock", notices, grantedAppearances);
  }
  if (years >= 200) {
    next = grantFantasy(next, "contrarian", notices, grantedAppearances);
  }
  if (years >= 400) {
    next = grantFantasy(next, "gaming", notices, grantedAppearances);
  }

  // Sun impact ladder (post-gate impacts only).
  if (impacts >= 10) {
    next = grantFantasy(next, "brick", notices, grantedAppearances);
  }
  if (impacts >= 20) {
    next = grantFantasy(next, "thunder", notices, grantedAppearances);
  }
  if (impacts >= 50) {
    next = grantFantasy(next, "relic", notices, grantedAppearances);
  }
  if (impacts >= 100) {
    next = grantFantasy(next, "ember", notices, grantedAppearances);
  }

  // Visitor / collapse fantasy (post-gate only).
  if (moonSec >= 30) {
    next = grantFantasy(next, "snowball", notices, grantedAppearances);
  }
  if (next.watchedAfterCollapsePostSolar || next.blackHoleSeenPostSolar) {
    next = grantFantasy(next, "voidseed", notices, grantedAppearances);
  }
  if (ships >= 1) {
    next = grantFantasy(next, "sparkle", notices, grantedAppearances);
  }
  if (comets >= 1) {
    next = grantFantasy(next, "puddle", notices, grantedAppearances);
  }
  if (shatters >= 2) {
    next = grantFantasy(next, "crumbly", notices, grantedAppearances);
  }

  // Action fantasy (flags only set after solar gate in app.ts).
  if (next.povCameraUsed) {
    next = grantFantasy(next, "glass", notices, grantedAppearances);
  }
  if (twins >= 1) {
    next = grantFantasy(next, "mirror", notices, grantedAppearances);
  }
  if (next.shareUsed) {
    next = grantFantasy(next, "discoball", notices, grantedAppearances);
  }
  if (next.randomPlacementUsed) {
    next = grantFantasy(next, "dice", notices, grantedAppearances);
  }
  if (next.solarPresetBalanced) {
    next = grantFantasy(next, "bubble", notices, grantedAppearances);
  }
  if (stables >= 2) {
    next = grantFantasy(next, "drowsy", notices, grantedAppearances);
  }
  if (tilted >= 1) {
    next = grantFantasy(next, "takoyaki", notices, grantedAppearances);
  }
  if (twelve >= 1) {
    next = grantFantasy(next, "sideslip", notices, grantedAppearances);
  }

  // Earth — post-gate session years reach real calendar year.
  if (years >= ctx.realYear) {
    next = grantFantasy(next, "earth", notices, grantedAppearances);
  }

  // Solar preset extra (not the sun stone).
  if (hasSolarComplete(next)) {
    next = grantExtra(next, "solarsystem", "いまの太陽系が置けるようになった", notices);
  }

  // Sun stone — strict separate gate.
  if (sunUnlockReady(next)) {
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

  const discovered = evaluateDiscoveries(next, ctx);
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

export function hasDuplicateAppearance(
  bodies: readonly { alive: boolean; ephemeral?: boolean; appearance: AppearanceId }[],
): boolean {
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
