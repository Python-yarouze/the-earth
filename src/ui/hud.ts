import { catalogLabel, PLACEABLE_IDS, UNLOCKABLE_IDS } from "../game/catalog";
import {
  appearanceFlavor,
  appearanceHint,
  DISCOVERIES,
  discoveryFlavor,
  discoveryHint,
  hasDiscovery,
} from "../game/discoveries";
import type { EarthStats, Mood } from "../game/evaluation";
import {
  EXTRA_DEFS,
  extraFlavor,
  hasChime,
  hasChimeLoop,
  hasExtra,
  hasSolarPreset,
  isUnlocked,
  unlockTotal,
  type Progress,
} from "../game/progress";
import { formatSpeed, SIM_SPEEDS, type SimSpeed } from "../game/speed";
import type { StageDef } from "../game/stages";
import type { Phase } from "../game/state";
import type { AppearanceId, Body } from "../physics/body";

export function splitTipLines(text: string, copied = false): string[] {
  const lines = text
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (copied) {
    lines.push("リンクをコピーした。");
  }
  return lines;
}

export function buildTipText(stage: StageDef | null): string {
  if (stage?.allowPlanets) {
    return "空をドラッグでカメラ。短くクリックで置く。月は地球の近くで衛星になる。";
  }
  if (stage?.canMoveEarth) {
    return "ドラッグで距離、Shift で高さ。空をドラッグでカメラ。";
  }
  return "START を押す。地球はすでに軌道に乗っている。";
}

export function simTipText(mood: Mood): string {
  if (mood === "collapsed") {
    return "バランスが崩れた。宇宙は動き続ける。";
  }
  if (mood === "balanced") {
    return "静かなバランス。";
  }
  return "地球が太陽を1周すると1年。惑星をクリックすると、そこから周りを見る。";
}

function tipCaptionBl(lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }
  return `<div class="hud-caption hud-caption-bl">${lines
    .map((line) => `<p class="hud-caption-line">${line}</p>`)
    .join("")}</div>`;
}

function tipsButton(): string {
  return `<button type="button" class="tips-btn" data-act="tips" aria-label="遊び方" title="遊び方">!</button>`;
}

function tipsPanel(): string {
  return `<div class="tips-layer">
    <button type="button" class="tips-backdrop" data-act="tips-close" aria-label="閉じる"></button>
    <div class="tips-panel" role="dialog" aria-modal="true" aria-labelledby="tips-title">
      <header class="tips-head">
        <p class="kicker">THE EARTH</p>
        <h2 id="tips-title">遊び方</h2>
        <button type="button" class="ghost tips-close" data-act="tips-close">閉じる</button>
      </header>
      <div class="tips-body">
        <section>
          <h3>はじめに</h3>
          <p>いまの地球も、軌道のバランスのうえにある。惑星を置いて START。その軌道が続くかを眺める。</p>
        </section>
        <section>
          <h3>配置</h3>
          <ul>
            <li>左の惑星を選び、空を短くクリックで置く。</li>
            <li>惑星をドラッグで距離、Shift＋ドラッグで高さ。</li>
            <li>空をドラッグでカメラを動かす。</li>
            <li>月は地球の近くに置くと衛星になる。</li>
            <li>いらない惑星は Delete で消せる。</li>
          </ul>
        </section>
        <section>
          <h3>観察</h3>
          <ul>
            <li>地球が太陽を1周すると1年。</li>
            <li>惑星をクリックすると、そこから周りを見る。もう一度クリックか「全体視点」で戻る。</li>
            <li>速度を変えると、時間の流れが変わる。</li>
            <li>分析で、速度と重力の矢印が見える。</li>
          </ul>
        </section>
        <section>
          <h3>楽しみ方</h3>
          <ul>
            <li>静かなバランスを、ただ眺める。</li>
            <li>図鑑の惑星を少しずつ増やしていく。</li>
            <li>共有で、誰かが組んだ系を眺める。</li>
            <li>崩れても宇宙は動き続ける。やり直して、また組む。</li>
          </ul>
        </section>
      </div>
    </div>
  </div>`;
}

function moodLine(mood: Mood): string {
  if (mood === "balanced") {
    return "安定した";
  }
  if (mood === "collapsed") {
    return "崩れた";
  }
  return "観察中";
}

function formatYearClock(stats: EarthStats | null): string {
  if (!stats) {
    return "0年";
  }
  return `${stats.years}年`;
}

function speedControls(simSpeed: SimSpeed): string {
  return `<div class="speed" role="group" aria-label="再生速度">
    ${SIM_SPEEDS.map(
      (s) =>
        `<button type="button" class="ghost speed-btn ${s === simSpeed ? "on" : ""}" data-act="speed" data-speed="${s}">${formatSpeed(s)}</button>`,
    ).join("")}
  </div>`;
}

function unlockCard(opts: {
  open: boolean;
  name: string;
  hint: string;
  flavor: string;
  swatch?: string;
  icon?: string;
}): string {
  const { open, name, hint, flavor, swatch, icon } = opts;
  const orbClass = open
    ? swatch
      ? `orb swatch ${swatch}`
      : `orb icon ${icon ?? "find"}`
    : swatch
      ? "orb swatch locked"
      : `orb icon locked ${icon ?? "find"}`;
  const title = open ? name : "？";
  const blurb = open ? flavor : hint;
  const blurbClass = open ? "blurb flavor" : "blurb hint";
  return `<article class="unlock-card ${open ? "open" : "locked"}"${open ? "" : ` title="${hint}"`}>
    <div class="unlock-visual" aria-hidden="true">
      <i class="${orbClass}"></i>
    </div>
    <div class="unlock-body">
      <h3 class="name">${title}</h3>
      <p class="${blurbClass}">${blurb}</p>
    </div>
  </article>`;
}

function chimeButtons(progress: Progress, chimeLoop: boolean): string {
  if (!hasChime(progress)) {
    return "";
  }
  const loop = hasChimeLoop(progress)
    ? `<button class="ghost ${chimeLoop ? "on" : ""}" data-act="chime-loop">${chimeLoop ? "ながし中" : "ながす"}</button>`
    : "";
  return `<button class="ghost" data-act="chime">奏でる</button>${loop}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sharePanel(url: string): string {
  const safe = escapeHtml(url);
  return `<div class="tips-layer share-layer">
    <button type="button" class="tips-backdrop" data-act="share-close" aria-label="閉じる"></button>
    <div class="tips-panel share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <header class="tips-head">
        <p class="kicker">THE EARTH</p>
        <h2 id="share-title">共有</h2>
        <button type="button" class="ghost tips-close" data-act="share-close">閉じる</button>
      </header>
      <div class="tips-body">
        <section>
          <h3>この軌道</h3>
          <p>誰かへ渡せる。リンクを開けば、同じ配置を眺められる。</p>
          <p class="share-url">${safe}</p>
          <div class="share-actions">
            <button type="button" class="cta" data-act="share-copy">コピー</button>
            <button type="button" class="ghost" data-act="share-x">X に投稿</button>
            <button type="button" class="ghost" data-act="share-line">LINE で送る</button>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

export class Hud {
  readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  on(fn: (act: string, el: HTMLElement) => void): void {
    this.root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (!el || el.hasAttribute("disabled")) {
        return;
      }
      fn(el.dataset.act ?? "", el);
    });
  }

  render(opts: {
    phase: Phase;
    stage: StageDef | null;
    selected: Body | null;
    pickAppearance: AppearanceId;
    analysis: boolean;
    stats: EarthStats | null;
    progress: Progress;
    notice: string;
    tipBl: string[] | null;
    tipsOpen: boolean;
    shareUrl: string | null;
    simSpeed: SimSpeed;
    chimeLoop: boolean;
  }): void {
    const {
      phase,
      stage,
      selected,
      pickAppearance,
      analysis,
      stats,
      progress,
      notice,
      tipBl,
      tipsOpen,
      shareUrl,
      simSpeed,
      chimeLoop,
    } = opts;

    if (phase === "title") {
      this.root.innerHTML = `
        <section class="overlay center">
          <p class="kicker">軌道の実験</p>
          <h1>THE EARTH</h1>
          <p class="lead">いまの地球も、軌道のバランスのうえにある。</p>
          ${
            progress.hasPlayed
              ? `<button class="cta" data-act="continue">つづける</button>`
              : `<button class="cta" data-act="enter">はじめる</button>`
          }
        </section>`;
      return;
    }

    const { have, total } = unlockTotal(progress);
    const count = `<span class="count">${have} / ${total}</span>`;

    if (phase === "unlocks") {
      const stones = UNLOCKABLE_IDS.map((id) =>
        unlockCard({
          open: isUnlocked(progress, id),
          name: catalogLabel(id),
          hint: appearanceHint(id),
          flavor: appearanceFlavor(id),
          swatch: id,
        }),
      ).join("");
      const extras = EXTRA_DEFS.map((e) =>
        unlockCard({
          open: hasExtra(progress, e.id),
          name: e.label,
          hint: e.hint,
          flavor: extraFlavor(e.id),
          icon: e.id,
        }),
      ).join("");
      const finds = DISCOVERIES.map((d) =>
        unlockCard({
          open: hasDiscovery(progress, d.id),
          name: d.notice,
          hint: discoveryHint(d.id) || d.hint,
          flavor: discoveryFlavor(d.id),
          icon: d.id,
        }),
      ).join("");
      this.root.innerHTML = `
        <section class="overlay stages unlocks">
          <header class="topbar">
            <p class="kicker">THE EARTH · 図鑑</p>
            <div class="top-actions">
              ${count}
              <button class="ghost" data-act="back-build">戻る</button>
            </div>
          </header>
          <h2>置ける惑星</h2>
          <div class="stage-grid unlock-grid">${stones}</div>
          <h2>ひろがったこと</h2>
          <div class="stage-grid unlock-grid">${extras}</div>
          <h2>見つけたこと</h2>
          <div class="stage-grid unlock-grid">${finds}</div>
        </section>`;
      return;
    }

    const paletteIds = stage?.sandbox
      ? [
          ...(isUnlocked(progress, "sun") ? (["sun"] as AppearanceId[]) : []),
          ...PLACEABLE_IDS,
        ]
      : (stage?.appearances ?? []);
    const planetItems = stage?.allowPlanets
      ? paletteIds
          .filter((a) => isUnlocked(progress, a))
          .map((a) => {
            const name = catalogLabel(a);
            return `<button class="planet-item ${a === pickAppearance ? "on" : ""}" data-act="appear" data-id="${a}" title="${name}" aria-label="${name}" aria-pressed="${a === pickAppearance}">
              <i class="swatch ${a}"></i>
              <span class="planet-name">${name}</span>
            </button>`;
          })
          .join("")
      : "";

    const selectedName = selected ? catalogLabel(selected.appearance) : "";
    const noticeCaption = notice
      ? `<p class="hud-caption hud-caption-tl">${notice}</p>`
      : "";
    const tipBlCaption = tipBl ? tipCaptionBl(tipBl) : "";
    const tipsUi = `${tipsButton()}${tipsOpen ? tipsPanel() : ""}`;
    const shareUi = shareUrl ? sharePanel(shareUrl) : "";

    const leftDock =
      stage?.allowPlanets && planetItems
        ? `<aside class="edge edge-left" aria-label="置く惑星">
            <div class="edge-panel">
              <div class="planet-dock" role="toolbar">
                ${planetItems}
              </div>
              <div class="planet-dock-actions">
                ${
                  stage.sandbox && hasSolarPreset(progress)
                    ? `<button class="ghost" data-act="solar">太陽系</button>
                      <button class="ghost" data-act="random">ランダム</button>`
                    : ""
                }
                <button class="ghost" data-act="clear">リセット</button>
              </div>
            </div>
          </aside>`
        : "";

    if (phase === "build") {
      this.root.innerHTML = `
        <div class="hud edge-hud">
          ${leftDock}
          ${noticeCaption}
          ${tipBlCaption}
          ${tipsUi}
          ${shareUi}
          <div class="edge edge-top">
            <div class="edge-panel">
              <header class="topbar">
                <p class="kicker">THE EARTH · ${stage?.title ?? ""}</p>
                <div class="top-actions">
                  ${count}
                  <button class="ghost" data-act="unlocks">図鑑</button>
                </div>
              </header>
              <p class="prompt">${stage?.prompt ?? ""}</p>
              ${selected ? `<p class="sel-line">選択中 · ${selectedName}</p>` : ""}
            </div>
          </div>
          <div class="edge edge-bottom">
            <div class="edge-panel">
              <div class="row bar-actions">
                ${chimeButtons(progress, chimeLoop)}
                <button class="ghost" data-act="share">共有</button>
                <button class="cta" data-act="start">START</button>
              </div>
            </div>
          </div>
        </div>`;
      return;
    }

    if (phase === "simulate" || phase === "watch") {
      const mood = stats?.mood ?? "watching";
      const watch = phase === "watch";
      const focusLine = selected
        ? `<p class="sel-line">${selectedName}から見る</p>`
        : "";
      this.root.innerHTML = `
        <div class="hud edge-hud slim">
          ${noticeCaption}
          ${tipBlCaption}
          ${shareUi}
          <span class="hud-year" data-time>${formatYearClock(stats)}</span>
          <div class="edge edge-top">
            <div class="edge-panel">
              <header class="topbar">
                <p class="kicker">${moodLine(mood)}</p>
                <div class="top-actions">
                  ${speedControls(simSpeed)}
                </div>
              </header>
              ${focusLine}
            </div>
          </div>
          <div class="edge edge-bottom">
            <div class="edge-panel">
              <div class="row bar-actions">
                ${chimeButtons(progress, chimeLoop)}
                <button class="ghost ${analysis ? "on" : ""}" data-act="analysis">分析</button>
                ${selected ? `<button class="ghost on" data-act="focus-all">全体視点</button>` : ""}
                <button class="ghost" data-act="share">共有</button>
                ${
                  watch
                    ? `<button class="cta" data-act="claim">自分でも組む</button>`
                    : `<button class="${mood === "collapsed" ? "cta" : "ghost"}" data-act="reset">やり直す</button>`
                }
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  setTime(stats: EarthStats): void {
    const el = this.root.querySelector("[data-time]");
    if (el) {
      el.textContent = formatYearClock(stats);
    }
  }
}
