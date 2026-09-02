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
import {
  CREDITS_BUTTON_OPACITY,
  CREDIT_SECTIONS,
  CREDITS_SCROLL_SEC,
  creditsScrollDurationSec,
  creditsScrollEndPct,
  FINALE_THANKS_TEXT,
  FINALE_EPILOGUE_LINES,
  finaleCreditsPhase,
  finaleEpilogueFrame,
  type CreditSection,
} from "../game/finale";

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

function renderCreditSection(section: CreditSection): string {
  if (section.variant === "title") {
    return `<div class="credits-block credits-block-title">${section.lines
      .map((line) => `<p class="credits-title">${line}</p>`)
      .join("")}</div>`;
  }
  const label = section.label ? `<p class="credits-label">${section.label}</p>` : "";
  const lines = section.lines.map((line) => `<p class="credits-line">${line}</p>`).join("");
  return `<div class="credits-block">${label}${lines}</div>`;
}

function creditsPanel(showSkip: boolean): string {
  const blocks = CREDIT_SECTIONS.map(renderCreditSection).join("");
  const skip = showSkip
    ? `<button type="button" class="credits-skip" data-act="finale-skip" aria-label="エンドクレジットをスキップ">スキップ</button>`
    : "";
  return `${skip}<div class="credits-roll" aria-live="polite" style="--credits-btn-opacity: ${CREDITS_BUTTON_OPACITY}">
    <div class="credits-scroll rolling">${blocks}</div>
    <div class="credits-epilogue" aria-live="polite" aria-hidden="true">
      <p class="credits-epilogue-line"></p>
    </div>
    <p class="credits-thanks">${FINALE_THANKS_TEXT}</p>
    <button type="button" class="cta credits-end" data-act="finale-end">やり直す</button>
  </div>`;
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

export type HudEdge = "top" | "bottom" | "left";

export type HudEdges = Record<HudEdge, boolean>;

const EDGE_TAB_MARK: Record<HudEdge, { closed: string; open: string }> = {
  top: { closed: "▾", open: "▴" },
  bottom: { closed: "▴", open: "▾" },
  left: { closed: "›", open: "‹" },
};

export function edgeTabMark(edge: HudEdge, open: boolean): string {
  return open ? EDGE_TAB_MARK[edge].open : EDGE_TAB_MARK[edge].closed;
}

function edgeShell(
  edge: HudEdge,
  label: string,
  open: boolean,
  inner: string,
  tag: "aside" | "div" = "div",
  attrs = "",
): string {
  const mark = edgeTabMark(edge, open);
  const tab = `<button type="button" class="edge-tab edge-tab-${edge}" data-act="hud-edge" data-edge="${edge}" aria-expanded="${open}" aria-label="${label}" title="${label}">${mark}</button>`;
  const panel = `<div class="edge-panel">${inner}</div>`;
  const drawer = edge === "bottom" ? `${tab}${panel}` : `${panel}${tab}`;
  const openClass = open ? " edge-open" : "";
  const shell = `<div class="edge-drawer">${drawer}</div>`;
  if (tag === "aside") {
    return `<aside class="edge edge-${edge}${openClass}" ${attrs}>${shell}</aside>`;
  }
  return `<div class="edge edge-${edge}${openClass}" ${attrs}>${shell}</div>`;
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
            <li>いらない惑星や追加した太陽は Delete で消せる。</li>
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

  updatePlanetPick(id: AppearanceId): void {
    for (const el of this.root.querySelectorAll<HTMLElement>(".planet-item[data-id]")) {
      const on = el.dataset.id === id;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", String(on));
    }
    const sel = this.root.querySelector(".sel-line");
    if (sel) {
      sel.textContent = `選択中 · ${catalogLabel(id)}`;
    }
  }

  /** Toggle edge panels without re-rendering — keeps CSS slide transitions alive. */
  syncHudEdges(edges: HudEdges): void {
    for (const edge of ["top", "bottom", "left"] as const) {
      const shell = this.root.querySelector(`.edge-${edge}`);
      if (!shell) {
        continue;
      }
      shell.classList.toggle("edge-open", edges[edge]);
      const tab = shell.querySelector<HTMLButtonElement>(".edge-tab");
      if (tab) {
        tab.setAttribute("aria-expanded", String(edges[edge]));
        tab.textContent = edgeTabMark(edge, edges[edge]);
      }
    }
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
    hudEdges?: HudEdges;
    debugResetPrompt?: boolean;
    finaleReplay?: boolean;
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
      hudEdges = { top: false, bottom: false, left: false },
      debugResetPrompt = false,
      finaleReplay = false,
    } = opts;

    if (phase === "title") {
      const resetUi = debugResetPrompt
        ? `<div class="title-debug-confirm">
            <p>すべての解放と記録が消えます。</p>
            <div class="title-debug-actions">
              <button type="button" class="ghost" data-act="debug-reset-cancel">やめる</button>
              <button type="button" class="cta danger" data-act="debug-reset-confirm">初期化する</button>
            </div>
          </div>`
        : `<button type="button" class="ghost title-debug-reset" data-act="debug-reset-prompt">進行を初期化</button>`;
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
          <footer class="title-debug">${resetUi}</footer>
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
      const finaleReplay = progress.destroyerSeen
        ? `<h2>エンドクレジット</h2>
          <div class="unlock-actions">
            <button type="button" class="cta" data-act="finale-replay">エンドクレジットを見る</button>
          </div>`
        : "";
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
          ${finaleReplay}
        </section>`;
      return;
    }

    const paletteIds = stage?.sandbox
      ? [
          ...(isUnlocked(progress, "sun") ? (["sun"] as AppearanceId[]) : []),
          ...(isUnlocked(progress, "earth") ? (["earth"] as AppearanceId[]) : []),
          ...PLACEABLE_IDS,
        ]
      : (stage?.appearances ?? []);
    const planetItems = stage?.allowPlanets
      ? paletteIds
          .filter((a) => isUnlocked(progress, a))
          .map((a) => {
            const name = catalogLabel(a);
            return `<button type="button" class="planet-item ${a === pickAppearance ? "on" : ""}" data-id="${a}" title="${name}" aria-label="${name}" aria-pressed="${a === pickAppearance}">
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

    if (phase === "build") {
      const topInner = `
        <header class="topbar">
          <p class="kicker">THE EARTH · ${stage?.title ?? ""}</p>
          <div class="top-actions">
            ${count}
            <button class="ghost" data-act="unlocks">図鑑</button>
          </div>
        </header>
        <p class="prompt">${stage?.prompt ?? ""}</p>
        ${selected ? `<p class="sel-line">選択中 · ${selectedName}</p>` : ""}
      `;
      const planetDockInner =
        stage?.allowPlanets && planetItems
          ? `<div class="planet-dock" role="toolbar">
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
            </div>`
          : "";
      const bottomInner = `
        <div class="row bar-actions">
          ${chimeButtons(progress, chimeLoop)}
          <button class="ghost" data-act="share">共有</button>
          <button class="cta" data-act="start">START</button>
        </div>
      `;
      const leftDock = planetDockInner
        ? edgeShell("left", "惑星", hudEdges.left, planetDockInner, "aside", 'aria-label="置く惑星"')
        : "";

      const dockScroll = this.root.querySelector<HTMLElement>(".planet-dock")?.scrollTop ?? 0;

      this.root.innerHTML = `
        <div class="hud edge-hud">
          ${leftDock}
          ${noticeCaption}
          ${tipBlCaption}
          ${tipsUi}
          ${shareUi}
          ${edgeShell("top", "情報", hudEdges.top, topInner)}
          ${edgeShell("bottom", "操作", hudEdges.bottom, bottomInner)}
        </div>`;

      const dock = this.root.querySelector<HTMLElement>(".planet-dock");
      if (dock) {
        dock.scrollTop = dockScroll;
      }
      return;
    }

    if (phase === "finale") {
      this.root.innerHTML = `
        <div class="hud edge-hud slim finale-hud">
          ${creditsPanel(finaleReplay)}
          <span class="hud-year" data-time>${formatYearClock(stats)}</span>
        </div>`;
      return;
    }

    if (phase === "simulate" || phase === "watch") {
      const mood = stats?.mood ?? "watching";
      const watch = phase === "watch";
      const focusLine = selected
        ? `<p class="sel-line">${selectedName}から見る</p>`
        : "";
      const topInner = `
        <header class="topbar">
          <p class="kicker">${moodLine(mood)}</p>
          <div class="top-actions">
            ${speedControls(simSpeed)}
          </div>
        </header>
        ${focusLine}
      `;
      const bottomInner = `
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
      `;
      this.root.innerHTML = `
        <div class="hud edge-hud slim">
          ${noticeCaption}
          ${tipBlCaption}
          ${shareUi}
          <span class="hud-year" data-time>${formatYearClock(stats)}</span>
          ${edgeShell("top", "情報", hudEdges.top, topInner)}
          ${edgeShell("bottom", "操作", hudEdges.bottom, bottomInner)}
        </div>`;
    }
  }

  setTime(stats: EarthStats): void {
    const el = this.root.querySelector("[data-time]");
    if (el) {
      el.textContent = formatYearClock(stats);
    }
  }

  /** Measure credits height, scroll fully off-screen, then phase into thank-you. */
  layoutFinaleCredits(roll: HTMLElement): number {
    const scroll = roll.querySelector<HTMLElement>(".credits-scroll");
    if (!scroll) {
      return CREDITS_SCROLL_SEC;
    }
    if (scroll.dataset.laidOut !== "1") {
      const h = scroll.offsetHeight;
      const vh = window.innerHeight;
      const endY = creditsScrollEndPct(h, vh);
      const duration = creditsScrollDurationSec(h, vh);
      scroll.style.setProperty("--credits-end-y", `${endY}%`);
      scroll.style.animationDuration = `${duration}s`;
      scroll.dataset.laidOut = "1";
      roll.dataset.scrollSec = String(duration);
    }
    return Number(roll.dataset.scrollSec) || CREDITS_SCROLL_SEC;
  }

  /** Advance credits phases: scroll → epilogue → thank-you → subtle button. */
  updateFinaleCredits(elapsed: number, sunExplodedAt: number | null = null): void {
    const roll = this.root.querySelector<HTMLElement>(".credits-roll");
    if (!roll) {
      return;
    }
    const scrollSec = this.layoutFinaleCredits(roll);
    const phase = finaleCreditsPhase(elapsed, scrollSec, sunExplodedAt);
    roll.classList.toggle("credits-phase-thanks", phase === "thanks" || phase === "button");
    roll.classList.toggle("credits-phase-button", phase === "button");
    roll.classList.toggle("credits-phase-epilogue", phase === "epilogue");

    const epilogue = roll.querySelector<HTMLElement>(".credits-epilogue");
    const epilogueLine = roll.querySelector<HTMLElement>(".credits-epilogue-line");
    if (epilogue && epilogueLine) {
      const frame = finaleEpilogueFrame(elapsed, sunExplodedAt);
      if (frame.visible) {
        epilogueLine.textContent = FINALE_EPILOGUE_LINES[frame.lineIndex] ?? "";
        epilogueLine.classList.toggle("credits-epilogue-hope", frame.hope);
        epilogue.style.opacity = String(frame.opacity);
        epilogue.setAttribute("aria-hidden", "false");
      } else {
        epilogue.style.opacity = "0";
        epilogue.setAttribute("aria-hidden", "true");
      }
    }
  }
}
