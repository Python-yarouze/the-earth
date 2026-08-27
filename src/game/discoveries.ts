import type { AppearanceId } from "../physics/body";
import { REAL_PLACEABLE_IDS, catalogLabel } from "./catalog";
import type { ExtraUnlock, Progress } from "./progress";

export type DiscoveryId =
  | "first-merge"
  | "first-shatter"
  | "triple-merge"
  | "moon-lived"
  | "sun-fed"
  | "after-collapse-watch"
  | "comet-seen"
  | "swarm-seen"
  | "flare-seen"
  | "blackhole-seen"
  | "bigbang-seen";

export interface DiscoveryDef {
  id: DiscoveryId;
  notice: string;
  hint: string;
  /** Unlocked catalog blurb. */
  flavor: string;
  ready: (p: Progress) => boolean;
}

export const DISCOVERIES: readonly DiscoveryDef[] = [
  {
    id: "first-merge",
    notice: "くっついて、ひとつになった",
    hint: "ゆっくりぶつかった先に",
    flavor: "やさしく触れた石は、質量をあわせてひとつになる。",
    ready: (p) => p.merges >= 1,
  },
  {
    id: "first-shatter",
    notice: "砕けて、かけらが飛んだ",
    hint: "速くぶつかった先に",
    flavor: "勢いよくぶつかると、かけらが散って宇宙がざわつく。",
    ready: (p) => p.shatters >= 1,
  },
  {
    id: "triple-merge",
    notice: "何度もくっついた石を見た",
    hint: "何度もひとつになった先に",
    flavor: "くっつけるほど、重く大きな石が育っていく。",
    ready: (p) => p.merges >= 3,
  },
  {
    id: "moon-lived",
    notice: "月が地球のそばに残った",
    hint: "月を地球の近くに置いた先に",
    flavor: "地球のそばに置くと、月は衛星として回り続ける。",
    ready: (p) => p.moonSurviveSec >= 30,
  },
  {
    id: "sun-fed",
    notice: "何かが太陽に落ちた",
    hint: "太陽に触れた先に",
    flavor: "近づきすぎた石は熱され、やがて太陽に呑まれる。",
    ready: (p) => p.sunImpacts >= 1,
  },
  {
    id: "after-collapse-watch",
    notice: "崩れたあとも、しばらく見ていた",
    hint: "崩れたあとも眺めた先に",
    flavor: "崩れても宇宙は続く。その余韻を見届けた証。",
    ready: (p) => p.watchedAfterCollapse,
  },
  {
    id: "comet-seen",
    notice: "長い尾が通った",
    hint: "砕けた宇宙を長く眺めた先に",
    flavor: "尾を引く訪問者。みずたまりの石への道でもある。",
    ready: (p) => p.cometSeen >= 1,
  },
  {
    id: "swarm-seen",
    notice: "小さな石の群れが通った",
    hint: "尾を見たあとに",
    flavor: "小さな石が群れで横切る、にぎやかな通り雨。",
    ready: (p) => p.swarmSeen >= 1,
  },
  {
    id: "flare-seen",
    notice: "遠い空が一瞬、色づいた",
    hint: "長い静けさの先に",
    flavor: "遠い空の閃光。かみなりの石への道でもある。",
    ready: (p) => p.flareSeen >= 1,
  },
  {
    id: "blackhole-seen",
    notice: "暗く重い点が生まれた",
    hint: "重くなりすぎた系で",
    flavor: "重さが限界を超えると、暗く小さな点が生まれうる。",
    ready: (p) => p.blackHoleSeen,
  },
  {
    id: "bigbang-seen",
    notice: "すべてが光に還った",
    hint: "暗い点が中心を吞んだ先に",
    flavor: "中心が吞み込まれたとき、すべてが一瞬の光に還る。",
    ready: (p) => p.bigBangSeen,
  },
];

const BY_ID = new Map(DISCOVERIES.map((d) => [d.id, d]));

export function discoveryHint(id: DiscoveryId): string {
  return BY_ID.get(id)?.hint ?? "";
}

export function discoveryFlavor(id: DiscoveryId): string {
  return BY_ID.get(id)?.flavor ?? "";
}

/** Blurred unlock hints for locked catalog chips. */
export function appearanceHint(id: AppearanceId): string {
  switch (id) {
    case "mercury":
      return "しばらく軌道を見た先に";
    case "venus":
      return "もう少し眺めた先に";
    case "moon":
      return "眺めを重ねた先に";
    case "jupiter":
      return "長く見守った先に";
    case "saturn":
      return "さらに長く眺めた先に";
    case "uranus":
      return "長い時間の先に";
    case "neptune":
      return "もっと長い眺めの先に";
    case "pluto":
      return "遠い時間の先に";
    case "asteroid":
      return "長い観察の果てに";
    case "sun":
      return "太陽系の石をそろえた先に";
    case "gaming":
      return "しばらく遊んだ先に";
    case "glass":
      return "眺めを続けた先に";
    case "puff":
      return "もう少し長く見た先に";
    case "brick":
      return "長く見守った先に";
    case "mirror":
      return "さらに長く眺めた先に";
    case "discoball":
      return "かがみを見たあとに";
    case "snowball":
      return "月がそばに残った先に";
    case "ember":
      return "太陽に触れた先に";
    case "contrarian":
      return "長い時間の先に";
    case "dice":
      return "眺めを重ねた先に";
    case "bubble":
      return "もっと長く見た先に";
    case "clock":
      return "長い観察の先に";
    case "voidseed":
      return "崩れたあとも見たか、暗い点を見た先に";
    case "sparkle":
      return "船を見た先に";
    case "drowsy":
      return "とても長く眺めた先に";
    case "takoyaki":
      return "長い時間の先に";
    case "puddle":
      return "長い尾を見た先に";
    case "thunder":
      return "空が一瞬色づいた先に";
    case "crumbly":
      return "何度か砕けた先に";
    case "sideslip":
      return "遠い時間の先に";
    case "relic":
      return "太陽に何度も触れた先に";
    default:
      return "まだ見ぬ惑星";
  }
}

/** Unlocked catalog blurb — feel and quirks of the stone. */
export function appearanceFlavor(id: AppearanceId): string {
  switch (id) {
    case "mars":
      return "最初から置ける赤い惑星。地球のとなりで、軌道の釣り合いを試しやすい。";
    case "mercury":
      return "小さくて軽い。太陽の近くで、細い軌道を描く。";
    case "venus":
      return "地球に近い重さ。ゆっくりと逆向きに回る。";
    case "earth":
      return "この世界の主役。年は、この惑星が太陽を周るたび進む。いまの地球も、こうしたバランスのうえにある。";
    case "moon":
      return "軽い衛星。地球の近くに置くと、そばを回り続ける。";
    case "jupiter":
      return "巨大で重い。系の重心を引きずるガスの巨石。地球の軌道にも影を落とす。";
    case "saturn":
      return "輪をまとった巨石。遠い軌道でも、全体の釣り合いに効く。";
    case "uranus":
      return "大きく傾いた氷の巨石。遠い配置の一端。";
    case "neptune":
      return "遠くて青い。長い軌道が、系の外側を支える。";
    case "pluto":
      return "小さく遠い端の石。境界のバランスを示す。";
    case "asteroid":
      return "いびつなかけら。小さな質量でも、通り過ぎれば軌道を揺らす。";
    case "sun":
      return "中心の火。置くと系の心臓になり、地球を含む軌道の基準になる。";
    case "gaming":
      return "くるくると色が変わる、にぎやかな奇想石。";
    case "glass":
      return "透き通って硬い。長い静けさが磨いた球。";
    case "puff":
      return "ふわっと大きく、質量は控えめ。わたのような石。";
    case "brick":
      return "ずっしり重い、赤茶色のれんが。置くだけで重心が動く。";
    case "mirror":
      return "鏡面の石。安定した系を映すように静か。";
    case "discoball":
      return "きらめくミラーボール。回るたび、小さな光が散る。";
    case "snowball":
      return "やわらかいゆきだま。自転が逆向きに回る。";
    case "ember":
      return "青白く揺れるおにび。太陽に触れた記憶を宿す。";
    case "contrarian":
      return "みんなと逆向きに公転する、ひねくれ石。";
    case "dice":
      return "六面のさいころ。各面に目があり、軌道の偶然を転がす。";
    case "bubble":
      return "うすい膜のしゃぼん。軽いが、見た目は大きい。";
    case "clock":
      return "円盤のとけい。針はいまの時を刻む。眺め続けた時間の土産。";
    case "voidseed":
      return "小さく暗い種。崩れたあとの余韻、または暗い点から。";
    case "sparkle":
      return "金属光沢でくるくる回る、ぴかぴかの訪問記念。";
    case "drowsy":
      return "ほとんど回らない、ねむそうな暗い石。";
    case "takoyaki":
      return "ずっしり焦げ目のたこやき。爪楊枝つき。長い時間の味。";
    case "puddle":
      return "半透明の青。彗星の尾を見たあとにたまる。";
    case "thunder":
      return "点滅するかみなり石。空の閃光の名残。";
    case "crumbly":
      return "ぼこぼこの低ポリ。砕けた衝撃の手触り。";
    case "sideslip":
      return "大きく傾いてよこすべり。長い眺めの先の奇想。";
    case "relic":
      return "オレンジのピンポン玉。太陽に何度も落ちた記憶のかたち。";
    default:
      return "この惑星の気配は、まだ言葉にならない。";
  }
}

export function hasDiscovery(progress: Progress, id: DiscoveryId): boolean {
  return progress.discoveries.includes(id);
}

export function canSpawnComet(progress: Progress): boolean {
  return hasDiscovery(progress, "first-shatter") || progress.shatters >= 1;
}

export function canSpawnSwarm(progress: Progress): boolean {
  return progress.cometSeen >= 1 || hasDiscovery(progress, "comet-seen");
}

export function canSpawnSkyFlare(progress: Progress): boolean {
  return progress.extras.includes("zen") || progress.watchSec >= 3600;
}

export function canSpawnDarkCompanion(progress: Progress): boolean {
  return progress.blackHoleSeen || hasDiscovery(progress, "blackhole-seen");
}

export function evaluateDiscoveries(progress: Progress): { progress: Progress; notices: string[] } {
  const notices: string[] = [];
  let next = progress;
  const found = new Set(next.discoveries);
  for (const d of DISCOVERIES) {
    if (found.has(d.id) || !d.ready(next)) {
      continue;
    }
    found.add(d.id);
    notices.push(d.notice);
  }
  if (notices.length > 0) {
    next = { ...next, discoveries: [...found] as DiscoveryId[] };
  }
  return { progress: next, notices };
}

export function discoveryTotal(progress: Progress): { have: number; total: number } {
  return {
    have: progress.discoveries.length,
    total: DISCOVERIES.length,
  };
}

/** Re-export helpers used by unlock counting. */
export function catalogUnlockTargets(): { placeables: number; extras: ExtraUnlock[] } {
  return { placeables: REAL_PLACEABLE_IDS.length, extras: ["solarsystem", "extraSlots", "zen"] };
}

export function grantLabel(id: AppearanceId): string {
  return `${catalogLabel(id)}が置けるようになった`;
}
