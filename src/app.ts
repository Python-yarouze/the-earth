import * as THREE from "three";
import { freqForBody } from "./audio/notes";
import { Sound } from "./audio/sound";
import { catalogEntry, catalogLabel } from "./game/catalog";
import { createStats, earthOf, evaluateFrame, sunOf, tickFinaleYears, type EarthStats } from "./game/evaluation";
import {
  applyDestroyerGravity,
  createFinale,
  prepareFinaleScene,
  resolveFinaleCollisions,
  spawnDestroyer,
  stabilizeFinaleSun,
  tickFinale,
  type FinaleState,
} from "./game/finale";
import {
  loadPersistedFinaleSnapshot,
  loadPersistedFinaleStats,
  persistFinaleSnapshot,
  persistFinaleStats,
} from "./game/finaleSnapshot";
import {
  clearProgress,
  hasChime,
  hasChimeLoop,
  hasDuplicateAppearance,
  hasExtraSlots,
  hasSolarComplete,
  hasSolarPreset,
  isUnlocked,
  loadProgress,
  markPlayed,
  saveProgress,
  tickUnlocks,
  unlockAllProgress,
  TWELVE_BODY_THRESHOLD,
  type Progress,
  type UnlockContext,
} from "./game/progress";
import { buildShareUrl, decodeShareFromLocation } from "./game/share";
import { randomSandboxBodies } from "./game/randomize";
import { parseSimSpeed, POV_SIM_SCALE, type SimSpeed } from "./game/speed";
import { solarSystemBodies } from "./game/solarsystem";
import {
  canMoveBody,
  canRemoveBody,
  extraBodyCount,
  initialBodies,
  makePlanet,
  planetCount,
  sandboxStage,
  type StageDef,
} from "./game/stages";
import type { Phase } from "./game/state";
import {
  cullMeteors,
  createVisitorClock,
  makeComet,
  makeDarkCompanion,
  makeMeteor,
  makeSwarm,
  makeUnlockMeteor,
  noteCometSpawn,
  noteDarkSpawn,
  noteFlareSpawn,
  noteMeteorSpawn,
  noteShipSpawn,
  noteSwarmSpawn,
  shouldSpawnComet,
  shouldSpawnDarkCompanion,
  shouldSpawnMeteor,
  shouldSpawnShip,
  shouldSpawnSkyFlare,
  shouldSpawnSwarm,
  shipPath,
  type VisitorClock,
} from "./game/visitors";
import {
  applyCircularOrbits,
  applySolarHeat,
  cloneBodies,
  collisionCopy,
  DT,
  G,
  HEIGHT_MAX,
  HEIGHT_MIN,
  isBlackHole,
  isEarthMoon,
  MAX_BODIES,
  resetBodyIds,
  resolveCollisions,
  step,
  stepFinale,
  type AppearanceId,
  type Body,
  type CollisionEvent,
} from "./physics";
import { clone, dist, length, sub, vec3 } from "./physics/vec3";
import { cancelCinema, createCinema, startCinema, tickCinema, type CinemaState } from "./render/cinema";
import { World } from "./render/world";
import { Hud, simTipText, splitTipLines, type HudEdges } from "./ui/hud";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export class Game {
  phase: Phase = "title";
  stage: StageDef = sandboxStage();
  build: Body[] = [];
  live: Body[] = [];
  selectedId: number | null = null;
  pickAppearance: AppearanceId = "mars";
  analysis = false;
  stats: EarthStats = createStats();
  progress: Progress = loadProgress();
  simSpeed: SimSpeed = 1;
  private chimeLoop = false;
  private pendingUnlockMeteors: AppearanceId[] = [];
  private unlockMeteorTimer: number | null = null;
  private notice = "";
  private copied = false;
  private drag: "move" | "lift" | null = null;
  private liftStart = { y: 0, clientY: 0 };
  private pointer = new THREE.Vector2();
  private world: World;
  private hud: Hud;
  private sound = new Sound();
  private lastTs = 0;
  private acc = 0;
  private lastMood = this.stats.mood;
  private earthStart = vec3(80, 0, 0);
  private clickAt: { x: number; y: number } | null = null;
  private visitors: VisitorClock = createVisitorClock();
  private noticeTimer = 0;
  private noticeQueue: string[] = [];
  private tipBlLines: string[] = [];
  private tipBlTimer = 0;
  private tipsOpen = false;
  private shareUrl: string | null = null;
  private balancedFor = 0;
  private watchSaveAcc = 0;
  private longStableNoted = false;
  private cinema: CinemaState = createCinema();
  private cinemaStarted = false;
  private usedSolarPreset = false;
  private buildFromSolarPreset = false;
  private collapseWatchSec = 0;
  private bigBangPending = false;
  private finale: FinaleState = createFinale();
  private hudEdges: HudEdges = { top: false, bottom: false, left: false };
  private hudEdgeIdleSec = 0;
  private static readonly HUD_EDGE_IDLE_CLOSE_SEC = 5;
  private paletteDrag: {
    appearance: AppearanceId;
    startX: number;
    startY: number;
    dragging: boolean;
    pointerId: number;
    source: HTMLElement;
  } | null = null;
  private paletteGhost: HTMLElement | null = null;
  private finaleReturnPhase: Phase | null = null;
  private finaleSnapshot: Body[] | null = null;
  private finaleStatsSnapshot: EarthStats | null = null;
  private finaleYearRate = Math.PI / 8;
  private finaleIsReplay = false;
  private debugResetPrompt = false;
  private konamiIndex = 0;
  private static readonly KONAMI_KEYS = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ] as const;
  /** Positions before the latest physics step — used to smooth slow-motion rendering. */
  private prevSnap = new Map<number, { x: number; y: number; z: number; spin: number }>();

  constructor(world: World, hud: Hud) {
    this.world = world;
    this.hud = hud;
    this.bind();
    const shared = decodeShareFromLocation();
    if (shared) {
      this.loadSharedBuild(shared, "watch");
    } else {
      this.refreshHud();
    }
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  private selected(): Body | null {
    const list = this.phase === "simulate" || this.phase === "watch" ? this.live : this.build;
    return list.find((b) => b.id === this.selectedId && b.alive) ?? null;
  }

  private refreshHud(): void {
    this.hud.render({
      phase: this.phase,
      stage: this.stage,
      selected: this.selected(),
      pickAppearance: this.pickAppearance,
      analysis: this.analysis,
      stats: this.stats,
      progress: this.progress,
      notice: this.notice,
      tipBl: this.tipBlTimer > 0 ? this.tipBlLines : null,
      tipsOpen: this.tipsOpen,
      shareUrl: this.shareUrl,
      simSpeed: this.simSpeed,
      chimeLoop: this.chimeLoop,
      hudEdges: this.hudEdges,
      debugResetPrompt: this.debugResetPrompt,
      finaleReplay: this.finaleIsReplay,
    });
  }

  private resetHudEdges(): void {
    this.hudEdges = { top: false, bottom: false, left: false };
    this.hudEdgeIdleSec = 0;
  }

  private bumpHudEdgeActivity(): void {
    if (this.hudEdges.top || this.hudEdges.bottom || this.hudEdges.left) {
      this.hudEdgeIdleSec = 0;
    }
  }

  private tickHudEdgeIdle(dt: number): void {
    if (!this.hudEdges.top && !this.hudEdges.bottom && !this.hudEdges.left) {
      this.hudEdgeIdleSec = 0;
      return;
    }
    this.hudEdgeIdleSec += dt;
    if (this.hudEdgeIdleSec >= Game.HUD_EDGE_IDLE_CLOSE_SEC) {
      this.resetHudEdges();
      this.hud.syncHudEdges(this.hudEdges);
    }
  }

  private unlockCtx(): UnlockContext {
    return { sessionYears: this.stats.years, realYear: new Date().getFullYear() };
  }

  private simTipLines(): string[] {
    return splitTipLines(simTipText(this.stats.mood), this.copied);
  }

  private flashTipBl(lines: string[]): void {
    this.tipBlLines = lines;
    this.tipBlTimer = 5;
    this.refreshHud();
  }

  private snapshotLive(): void {
    this.prevSnap.clear();
    for (const b of this.live) {
      this.prevSnap.set(b.id, { x: b.pos.x, y: b.pos.y, z: b.pos.z, spin: b.spin });
    }
  }

  /** Blend previous → current physics state for smooth slow-mo (and normal) frames. */
  private displayBodies(alpha: number): Body[] {
    if (this.prevSnap.size === 0) {
      return this.live;
    }
    const a = Math.min(1, Math.max(0, alpha));
    return this.live.map((b) => {
      const p = this.prevSnap.get(b.id);
      if (!p) {
        return b;
      }
      return {
        ...b,
        pos: {
          x: p.x + (b.pos.x - p.x) * a,
          y: p.y + (b.pos.y - p.y) * a,
          z: p.z + (b.pos.z - p.z) * a,
        },
        spin: p.spin + (b.spin - p.spin) * a,
      };
    });
  }

  private show(bodies: Body[]): void {
    this.world.syncBodies(bodies);
    this.world.setSelection(this.phase === "build" ? this.selected() : null);
    this.world.drawVectors(bodies, this.analysis, G);
  }

  private clearObserveFocus(announce = false): void {
    if (this.selectedId === null) {
      return;
    }
    this.selectedId = null;
    if (announce) {
      this.flashTipBl(["全体を見る。"]);
    } else {
      this.refreshHud();
    }
  }

  private setObserveFocus(body: Body): void {
    if (this.cinema.active) {
      cancelCinema(this.cinema);
    }
    if (this.phase === "simulate" || this.phase === "watch") {
      if (hasSolarComplete(this.progress)) {
        this.progress = { ...this.progress, povCameraUsed: true };
        this.applyUnlocks();
      }
    }
    this.selectedId = body.id;
    this.flashTipBl([`${catalogLabel(body.appearance)}から周りを見る。`]);
  }

  private dropObserveFocusIfGone(): void {
    if (this.selectedId === null) {
      return;
    }
    if (this.selected()) {
      return;
    }
    this.selectedId = null;
    this.flashTipBl(["消えたので、全体を見る。"]);
  }

  private pickObserveFocus(e: PointerEvent): void {
    this.ndc(e);
    const hit = this.world.pickBody(this.pointer, this.live);
    const focusable = hit && hit.alive && !hit.ephemeral ? hit : null;
    if (focusable) {
      if (this.selectedId === focusable.id) {
        this.clearObserveFocus(true);
      } else {
        this.setObserveFocus(focusable);
      }
    } else if (this.selectedId !== null) {
      this.clearObserveFocus(true);
    }
    this.show(this.live);
    this.refreshHud();
  }

  private orbit(list: Body[] = this.build, preservePositions = false): void {
    applyCircularOrbits(list, G, { preservePositions });
  }

  private persist(): void {
    saveProgress(this.progress);
  }

  private flashNotice(text: string): void {
    if (this.phase === "finale") {
      return;
    }
    if (this.notice && this.noticeTimer > 0) {
      this.noticeQueue.push(text);
      return;
    }
    this.notice = text;
    this.noticeTimer = 4;
    this.refreshHud();
  }

  private applyUnlocks(silent = false): void {
    const { progress, notices, grantedAppearances } = tickUnlocks(this.progress, this.unlockCtx());
    this.progress = progress;
    this.persist();
    if (!silent) {
      for (const n of notices) {
        this.flashNotice(n);
      }
    }
    for (const id of grantedAppearances) {
      this.queueUnlockMeteor(id);
    }
  }

  private queueUnlockMeteor(id: AppearanceId): void {
    if (this.phase === "simulate" || this.phase === "watch") {
      this.pendingUnlockMeteors.push(id);
      this.pumpUnlockMeteors();
      return;
    }
    this.pendingUnlockMeteors.push(id);
  }

  private pumpUnlockMeteors(): void {
    if (this.unlockMeteorTimer !== null) {
      return;
    }
    if (this.pendingUnlockMeteors.length === 0) {
      return;
    }
    if (this.phase !== "simulate" && this.phase !== "watch") {
      return;
    }
    const id = this.pendingUnlockMeteors.shift();
    if (!id) {
      return;
    }
    if (this.live.filter((b) => b.alive).length < this.bodyCap() + 4) {
      this.live.push(makeUnlockMeteor(id));
    }
    this.unlockMeteorTimer = window.setTimeout(() => {
      this.unlockMeteorTimer = null;
      this.pumpUnlockMeteors();
    }, 500 + Math.floor(Math.random() * 300));
  }

  private noteCollision(ev: CollisionEvent): void {
    if (this.phase === "finale") {
      return;
    }
    const patch: Partial<Progress> = {};
    if (ev.kind === "merge") {
      patch.merges = this.progress.merges + 1;
    } else if (ev.kind === "disrupt") {
      patch.disrupts = this.progress.disrupts + 1;
      patch.merges = this.progress.merges + 1;
    } else if (ev.kind === "shatter" || ev.kind === "destroy") {
      patch.shatters = this.progress.shatters + 1;
    } else if (ev.kind === "swallow") {
      patch.merges = this.progress.merges + 1;
    } else if (ev.kind === "big-bang") {
      patch.bigBangSeen = true;
    }

    const a = this.live.find((b) => b.id === ev.aId);
    const b = this.live.find((b) => b.id === ev.bId);
    if (
      (a?.kind === "sun" && b && b.kind !== "sun") ||
      (b?.kind === "sun" && a && a.kind !== "sun") ||
      (ev.kind === "swallow" && (a?.kind === "sun" || b?.kind === "sun"))
    ) {
      patch.sunImpacts = this.progress.sunImpacts + 1;
    }

    const masses = this.live.filter((x) => x.alive).map((x) => x.mass);
    const maxMass = masses.length ? Math.max(...masses, this.progress.maxMergedMass) : this.progress.maxMergedMass;
    patch.maxMergedMass = maxMass;

    if (this.live.some((x) => x.alive && isBlackHole(x) && !x.ephemeral)) {
      patch.blackHoleSeen = true;
      if (hasSolarComplete(this.progress)) {
        patch.blackHoleSeenPostSolar = true;
      }
    }

    this.progress = { ...this.progress, ...patch };
    const copy = collisionCopy(ev.kind);
    if (copy) {
      this.flashNotice(copy);
    }
    this.applyUnlocks();

    if (ev.kind === "big-bang") {
      this.triggerBigBang();
    }
  }

  private triggerBigBang(): void {
    if (this.bigBangPending) {
      return;
    }
    this.bigBangPending = true;
    this.sound.setAmbient(false);
    this.world.pulse({ x: 0, y: 0, z: 0 }, "big-bang");
    for (const b of this.live) {
      b.alive = false;
    }
    window.setTimeout(() => {
      this.bigBangPending = false;
      this.progress = { ...this.progress, bigBangSeen: true };
      this.applyUnlocks();
      this.flashNotice("もう一度組める");
      this.resetBuild();
    }, 2800);
  }

  private planetCap(): number {
    return this.stage.maxPlanets + (hasExtraSlots(this.progress) ? 4 : 0);
  }

  private bodyCap(): number {
    return MAX_BODIES + (hasExtraSlots(this.progress) ? 4 : 0);
  }

  private tryPlace(e: PointerEvent): void {
    this.ndc(e);
    const p = this.world.planePoint(this.pointer, 0);
    const pick = catalogEntry(this.pickAppearance);
    const placingSun = pick.kind === "sun";
    const placingPlanet = pick.kind === "planet";
    const placingEarth = pick.kind === "earth";
    if (
      !p ||
      !this.stage.allowPlanets ||
      (!placingPlanet && !placingSun && !placingEarth) ||
      !isUnlocked(this.progress, this.pickAppearance) ||
      (!placingSun && planetCount(this.build) >= this.planetCap()) ||
      this.build.filter((b) => b.alive && !b.ephemeral).length >= this.bodyCap()
    ) {
      return;
    }
    const planet = makePlanet(this.pickAppearance, p);
    this.build.push(planet);
    this.buildFromSolarPreset = false;
    this.selectedId = planet.id;
    this.orbit();
    this.sound.click();
    this.refreshHud();
    this.show(this.build);
  }

  private enterStage(stage: StageDef): void {
    this.stopChimeLoop(false);
    resetBodyIds();
    this.stage = stage;
    this.progress = markPlayed(this.progress);
    this.persist();
    this.build = initialBodies(stage);
    this.orbit();
    this.live = [];
    this.selectedId = this.build.find((b) => b.kind === "earth")?.id ?? null;
    this.earthStart = vec3(80, 0, 0);
    this.phase = "build";
    this.stats = createStats();
    this.lastMood = this.stats.mood;
    this.copied = false;
    this.tipsOpen = false;
    this.shareUrl = null;
    this.tipBlTimer = 0;
    this.tipBlLines = [];
    this.usedSolarPreset = false;
    this.buildFromSolarPreset = false;
    this.finale = createFinale();
    this.resetHudEdges();
    this.world.trails.reset();
    this.world.clearShip();
    this.world.clearViews();
    this.world.setWatching(false);
    this.world.resetCamera();
    this.ensurePick();
    this.show(this.build);
    this.refreshHud();
  }

  private ensurePick(): void {
    const allowed = this.stage.sandbox
      ? this.progress.unlocked
      : this.stage.appearances.filter((a) => isUnlocked(this.progress, a));
    if (!allowed.includes(this.pickAppearance)) {
      this.pickAppearance = allowed[0] ?? "mars";
    }
  }

  private startSim(watch = false, skipOrbit = false): void {
    this.stopChimeLoop(false);
    if (!skipOrbit) {
      this.orbit();
    }
    this.live = cloneBodies(this.build);
    this.phase = watch ? "watch" : "simulate";
    this.stats = createStats();
    this.lastMood = this.stats.mood;
    this.acc = 0;
    this.visitors = createVisitorClock();
    this.balancedFor = 0;
    this.longStableNoted = false;
    this.cinema = createCinema();
    this.cinemaStarted = false;
    this.collapseWatchSec = 0;
    this.bigBangPending = false;
    this.selectedId = null;
    this.tipsOpen = false;
    this.shareUrl = null;
    this.prevSnap.clear();
    this.world.trails.reset();
    this.world.trails.setVisible(true);
    this.world.clearShip();
    this.world.setWatching(true);
    this.world.controls.enableRotate = true;
    this.show(this.live);
    this.flashTipBl(this.simTipLines());
    this.sound.start();
    this.pumpUnlockMeteors();
  }

  private resetBuild(): void {
    this.stopChimeLoop(false);
    this.sound.stopFinaleMusic();
    this.clearObserveFocus(false);
    cancelCinema(this.cinema);
    this.cinemaStarted = false;
    this.phase = "build";
    this.live = [];
    this.prevSnap.clear();
    this.stats = createStats();
    this.lastMood = this.stats.mood;
    this.sound.setAmbient(false);
    this.world.trails.reset();
    this.world.clearShip();
    this.world.setWatching(false);
    this.world.resetCamera();
    this.show(this.build);
    this.refreshHud();
  }

  private hasHighPlacement(): boolean {
    return this.build.some((b) => b.alive && !b.ephemeral && Math.abs(b.pos.y) > 8);
  }

  private noteBalanced(): void {
    const twin = hasDuplicateAppearance(this.live);
    const bodies = extraBodyCount(this.live);
    const patch: Partial<Progress> = {
      balances: this.progress.balances + 1,
      twinBalances: this.progress.twinBalances + (twin ? 1 : 0),
    };
    if (this.hasHighPlacement()) {
      patch.tiltedBalances = this.progress.tiltedBalances + 1;
    }
    if (this.buildFromSolarPreset && hasSolarComplete(this.progress)) {
      patch.solarPresetBalanced = true;
    } else if (bodies >= TWELVE_BODY_THRESHOLD) {
      patch.twelveBodyBalances = this.progress.twelveBodyBalances + 1;
    }
    this.progress = { ...this.progress, ...patch };
    this.applyUnlocks();

    const sunCount = this.live.filter((b) => b.alive && b.kind === "sun").length;
    if (sunCount >= 2 && !this.progress.destroyerSeen) {
      this.startFinale();
    }
  }

  private startFinale(opts?: { replay?: boolean }): void {
    if (this.phase === "finale" || this.finale.active) {
      return;
    }
    const replay = opts?.replay ?? false;
    this.finaleIsReplay = replay;
    this.stopChimeLoop(false);
    this.clearObserveFocus(false);
    cancelCinema(this.cinema);
    this.notice = "";
    this.noticeTimer = 0;
    this.noticeQueue = [];
    this.simSpeed = 1;
    this.finale = createFinale();
    this.finale.active = true;
    if (!replay) {
      this.finaleSnapshot = cloneBodies(this.live);
      this.finaleStatsSnapshot = {
        ...this.stats,
        recent: this.stats.recent.slice(),
      };
      persistFinaleSnapshot(this.finaleSnapshot);
      persistFinaleStats(this.stats);
    }
    const earth = earthOf(this.live);
    const sun = sunOf(this.live);
    if (earth?.alive && sun?.alive) {
      const r = dist(earth.pos, sun.pos);
      const rel = length(sub(earth.vel, sun.vel));
      if (r > 1 && rel > 0.04) {
        this.finaleYearRate = rel / r;
      }
    }
    const destroyer = spawnDestroyer(this.live);
    this.live.push(destroyer);
    this.finale.destroyerId = destroyer.id;
    prepareFinaleScene(this.live, destroyer, this.finale);
    if (!replay) {
      this.progress = { ...this.progress, destroyerSeen: true };
      this.applyUnlocks(true);
    }
    this.phase = "finale";
    this.acc = 0;
    this.snapshotLive();
    this.sound.startFinaleMusic();
    this.world.trails.reset();
    this.world.enterFinale(this.finale, this.live);
    this.show(this.live);
    this.refreshHud();
  }

  /** Prefer this session's finale, then the live sim, then the current build, then saved tab data. */
  private resolveFinaleReplayBodies(): Body[] | null {
    if (this.finaleSnapshot && this.finaleSnapshot.length > 0) {
      return cloneBodies(this.finaleSnapshot);
    }
    const simLive = this.live.filter((b) => b.alive && !b.ephemeral);
    if (simLive.length > 0) {
      return cloneBodies(this.live);
    }
    const buildLive = this.build.filter((b) => b.alive && !b.ephemeral);
    if (buildLive.length > 0) {
      return cloneBodies(this.build);
    }
    const persisted = loadPersistedFinaleSnapshot();
    if (persisted && persisted.length > 0) {
      return cloneBodies(persisted);
    }
    return null;
  }

  private replayFinale(): void {
    if (this.phase === "finale" || this.finale.active) {
      return;
    }
    const bodies = this.resolveFinaleReplayBodies();
    if (!bodies || bodies.length === 0) {
      this.flashNotice("まだエンドクレジット用の記録がありません");
      return;
    }
    this.finaleReturnPhase = this.phase;
    this.stopChimeLoop(false);
    this.clearObserveFocus(false);
    cancelCinema(this.cinema);
    if (!this.finaleStatsSnapshot) {
      this.finaleStatsSnapshot = loadPersistedFinaleStats();
    }
    this.world.clearViews();
    this.world.trails.reset();
    this.live = bodies;
    if (this.finaleStatsSnapshot) {
      this.stats = {
        ...this.finaleStatsSnapshot,
        recent: this.finaleStatsSnapshot.recent.slice(),
      };
    } else {
      this.stats = createStats();
    }
    this.acc = 0;
    this.selectedId = null;
    this.notice = "";
    this.noticeTimer = 0;
    this.noticeQueue = [];
    this.simSpeed = 1;
    this.startFinale({ replay: true });
  }

  private endFinale(): void {
    this.sound.stopFinaleMusic();
    this.world.exitFinale();
    this.finaleIsReplay = false;
    this.finale = createFinale();
    const returnPhase = this.finaleReturnPhase;
    this.finaleReturnPhase = null;
    if (returnPhase === "unlocks") {
      this.phase = "unlocks";
      this.world.setWatching(false);
      this.refreshHud();
      this.sound.click();
      return;
    }
    this.enterStage(sandboxStage());
    this.sound.click();
  }

  /** Distance-from-sun arpeggio: flash + tone. Ignores re-entry while playing. */
  private playChime(): void {
    const phrase = this.chimePhrase();
    if (!phrase) {
      return;
    }
    const started = this.sound.playSequence(phrase.freqs, 0.2, (i) => {
      const id = phrase.ids[i];
      if (id !== undefined) {
        this.world.flashBodyNote(id, 0.22);
      }
    });
    if (!started) {
      return;
    }
    this.progress = { ...this.progress, chimesPlayed: this.progress.chimesPlayed + 1 };
    this.applyUnlocks();
  }

  private toggleChimeLoop(): void {
    if (!hasChimeLoop(this.progress)) {
      return;
    }
    if (this.chimeLoop) {
      this.stopChimeLoop();
      return;
    }
    this.chimeLoop = true;
    this.sound.startChimeLoop(() => this.chimePhrase(), {
      gapSec: 0.42,
      pauseSec: 1.8,
      noteDur: 0.36,
      gain: 0.07,
      onStep: (_i, bodyId) => {
        this.world.flashBodyNote(bodyId, 0.16);
      },
    });
    this.refreshHud();
  }

  private stopChimeLoop(refresh = true): void {
    if (!this.chimeLoop && !this.sound.isChimeLooping()) {
      return;
    }
    this.chimeLoop = false;
    this.sound.stopChimeLoop();
    if (refresh) {
      this.refreshHud();
    }
  }

  private chimePhrase(): { freqs: number[]; ids: number[] } | null {
    const list = this.phase === "build" ? this.build : this.live;
    const bodies = list.filter((b) => b.alive && !b.ephemeral);
    if (bodies.length === 0) {
      return null;
    }
    const sun = bodies.find((b) => b.kind === "sun");
    const origin = sun?.pos ?? vec3();
    const sorted = [...bodies].sort((a, b) => dist(a.pos, origin) - dist(b.pos, origin));
    return {
      freqs: sorted.map((b) => freqForBody(b)),
      ids: sorted.map((b) => b.id),
    };
  }

  private loadSharedBuild(bodies: Body[], mode: "watch" | "build"): void {
    this.stopChimeLoop(false);
    resetBodyIds();
    this.stage = sandboxStage();
    this.build = bodies;
    this.orbit(this.build, true);
    const earth = this.build.find((b) => b.kind === "earth");
    this.earthStart = earth ? clone(earth.pos) : vec3(80, 0, 0);
    this.selectedId = earth?.id ?? null;
    this.usedSolarPreset = false;
    this.copied = false;
    this.tipsOpen = false;
    this.shareUrl = null;
    this.tipBlTimer = 0;
    this.tipBlLines = [];
    this.ensurePick();

    if (mode === "watch") {
      this.startSim(true, true);
      return;
    }

    this.clearObserveFocus(false);
    cancelCinema(this.cinema);
    this.cinemaStarted = false;
    this.live = [];
    this.prevSnap.clear();
    this.phase = "build";
    this.stats = createStats();
    this.lastMood = this.stats.mood;
    this.world.trails.reset();
    this.world.clearShip();
    this.world.setWatching(false);
    this.world.resetCamera();
    this.show(this.build);
    this.refreshHud();
  }

  private buildShareUrl(): string {
    const bodies = this.phase === "build" ? this.build : this.live;
    return buildShareUrl(bodies, window.location.origin, window.location.pathname);
  }

  private openShare(): void {
    this.tipsOpen = false;
    if (hasSolarComplete(this.progress)) {
      this.progress = { ...this.progress, shareUsed: true };
      this.applyUnlocks();
    }
    this.shareUrl = this.buildShareUrl();
    this.refreshHud();
    this.sound.click();
  }

  private closeShare(): void {
    if (this.shareUrl === null) {
      return;
    }
    this.shareUrl = null;
    this.refreshHud();
  }

  private async copyShareLink(): Promise<void> {
    const url = this.shareUrl ?? this.buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("このリンクをコピー", url);
    }
    this.copied = true;
    if (hasSolarComplete(this.progress)) {
      this.progress = { ...this.progress, shareUsed: true };
      if (this.stats.everBalanced || this.stats.mood === "balanced") {
        this.progress = { ...this.progress, copiedBalanced: true };
      }
      this.applyUnlocks();
    }
    this.flashTipBl(["リンクをコピーした。"]);
  }

  private shareToX(): void {
    if (hasSolarComplete(this.progress)) {
      this.progress = { ...this.progress, shareUsed: true };
      this.applyUnlocks();
    }
    const url = this.shareUrl ?? this.buildShareUrl();
    const text = "THE EARTH — 軌道のバランスを眺める";
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  private shareToLine(): void {
    if (hasSolarComplete(this.progress)) {
      this.progress = { ...this.progress, shareUsed: true };
      this.applyUnlocks();
    }
    const url = this.shareUrl ?? this.buildShareUrl();
    const intent = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  private static readonly PALETTE_DRAG_THRESHOLD = 10;

  private ensurePaletteGhost(): HTMLElement {
    if (!this.paletteGhost) {
      const el = document.createElement("div");
      el.className = "palette-ghost";
      el.hidden = true;
      el.innerHTML = '<i class="swatch"></i>';
      document.body.appendChild(el);
      this.paletteGhost = el;
    }
    return this.paletteGhost;
  }

  private showPaletteGhost(appearance: AppearanceId, x: number, y: number): void {
    const ghost = this.ensurePaletteGhost();
    const swatch = ghost.querySelector(".swatch");
    if (swatch) {
      swatch.className = `swatch ${appearance}`;
    }
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.hidden = false;
  }

  private hidePaletteGhost(): void {
    if (this.paletteGhost) {
      this.paletteGhost.hidden = true;
    }
  }

  private endPaletteDrag(e: PointerEvent, place: boolean): void {
    if (!this.paletteDrag) {
      return;
    }
    const drag = this.paletteDrag;
    this.paletteDrag = null;
    this.hidePaletteGhost();
    this.world.controls.enabled = true;
    try {
      drag.source.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!place || !drag.dragging) {
      return;
    }
    const canvas = this.world.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      this.pickAppearance = drag.appearance;
      this.tryPlace(e);
    }
  }

  private bindPalettePick(): void {
    this.hud.root.addEventListener("pointerdown", (e) => {
      if (this.phase !== "build") {
        return;
      }
      const item = (e.target as HTMLElement).closest<HTMLElement>(".planet-item[data-id]");
      if (!item) {
        return;
      }
      const id = item.dataset.id as AppearanceId;
      if (!id || !isUnlocked(this.progress, id)) {
        return;
      }
      this.pickAppearance = id;
      this.hud.updatePlanetPick(id);
      this.sound.click();
      this.paletteDrag = {
        appearance: id,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        pointerId: e.pointerId,
        source: item,
      };
    });
  }

  private bind(): void {
    this.hud.on((act, el) => {
      this.sound.resume();
      if (act === "enter" || act === "continue") {
        this.enterStage(sandboxStage());
        this.sound.click();
      } else if (act === "title") {
        this.stopChimeLoop(false);
        this.tipsOpen = false;
        this.shareUrl = null;
        this.resetHudEdges();
        this.phase = "title";
        this.refreshHud();
      } else if (act === "tips") {
        this.shareUrl = null;
        this.tipsOpen = true;
        this.refreshHud();
        this.sound.click();
      } else if (act === "tips-close") {
        this.tipsOpen = false;
        this.refreshHud();
      } else if (act === "share-close") {
        this.closeShare();
      } else if (act === "share-copy") {
        void this.copyShareLink();
      } else if (act === "share-x") {
        this.shareToX();
      } else if (act === "share-line") {
        this.shareToLine();
      } else if (act === "finale-end") {
        this.endFinale();
      } else if (act === "finale-skip" && this.phase === "finale" && this.finaleIsReplay) {
        this.endFinale();
        this.sound.click();
      } else if (act === "finale-replay" && this.progress.destroyerSeen) {
        this.replayFinale();
        this.sound.click();
      } else if (act === "debug-reset-prompt" && this.phase === "title") {
        this.debugResetPrompt = true;
        this.refreshHud();
      } else if (act === "debug-reset-cancel" && this.phase === "title") {
        this.debugResetPrompt = false;
        this.refreshHud();
      } else if (act === "debug-reset-confirm" && this.phase === "title") {
        clearProgress();
        this.progress = loadProgress();
        this.debugResetPrompt = false;
        this.konamiIndex = 0;
        this.refreshHud();
        this.sound.click();
      } else if (act === "unlocks" && this.phase === "build") {
        this.resetHudEdges();
        this.phase = "unlocks";
        this.refreshHud();
        this.sound.click();
      } else if (act === "back-build" && this.phase === "unlocks") {
        this.resetHudEdges();
        this.world.trails.reset();
        this.phase = "build";
        this.refreshHud();
        this.sound.click();
      } else if (act === "start" && this.phase === "build") {
        const earth = this.build.find((b) => b.kind === "earth");
        if (earth && dist(earth.pos, this.earthStart) > 5) {
          this.progress = { ...this.progress, movedEarth: true };
        }
        if (planetCount(this.build) >= 1) {
          this.progress = { ...this.progress, placedExtra: true };
        }
        this.startSim(false);
        this.applyUnlocks();
      } else if (act === "reset") {
        this.resetBuild();
      } else if (act === "claim") {
        const shared = decodeShareFromLocation();
        if (shared) {
          this.loadSharedBuild(shared, "build");
          this.sound.click();
        }
      } else if (act === "analysis") {
        this.analysis = !this.analysis;
        this.refreshHud();
      } else if (act === "share") {
        this.openShare();
      } else if (act === "solar" && this.stage.sandbox && hasSolarPreset(this.progress)) {
        resetBodyIds();
        this.world.clearViews();
        this.build = solarSystemBodies();
        this.usedSolarPreset = true;
        this.buildFromSolarPreset = true;
        this.selectedId = this.build.find((b) => b.kind === "earth")?.id ?? null;
        this.earthStart = clone(this.build.find((b) => b.kind === "earth")?.pos ?? vec3(80, 0, 0));
        this.show(this.build);
        this.refreshHud();
        this.sound.click();
      } else if (act === "random" && this.stage.sandbox && hasSolarPreset(this.progress)) {
        resetBodyIds();
        this.world.clearViews();
        this.world.trails.reset();
        this.build = randomSandboxBodies(this.progress.unlocked);
        this.usedSolarPreset = false;
        this.buildFromSolarPreset = false;
        if (hasSolarComplete(this.progress)) {
          this.progress = { ...this.progress, randomPlacementUsed: true };
          this.applyUnlocks();
        }
        this.selectedId = this.build.find((b) => b.kind === "earth")?.id ?? null;
        this.earthStart = clone(this.build.find((b) => b.kind === "earth")?.pos ?? vec3(80, 0, 0));
        this.pickAppearance = "mars";
        this.ensurePick();
        this.show(this.build);
        this.refreshHud();
        this.sound.click();
      } else if (act === "clear" && this.phase === "build") {
        resetBodyIds();
        this.world.clearViews();
        this.world.trails.reset();
        this.build = initialBodies(this.stage);
        this.orbit();
        this.usedSolarPreset = false;
        this.buildFromSolarPreset = false;
        this.selectedId = this.build.find((b) => b.kind === "earth")?.id ?? null;
        this.earthStart = clone(this.build.find((b) => b.kind === "earth")?.pos ?? vec3(80, 0, 0));
        this.world.resetCamera();
        this.show(this.build);
        this.refreshHud();
        this.sound.click();
      } else if (act === "chime" && (this.phase === "build" || this.phase === "simulate" || this.phase === "watch")) {
        if (hasChime(this.progress)) {
          this.playChime();
        }
      } else if (
        act === "chime-loop" &&
        (this.phase === "build" || this.phase === "simulate" || this.phase === "watch")
      ) {
        if (hasChimeLoop(this.progress)) {
          this.toggleChimeLoop();
        }
      } else if (act === "speed" && (this.phase === "simulate" || this.phase === "watch")) {
        const next = parseSimSpeed(el.dataset.speed);
        if (next !== null) {
          this.simSpeed = next;
          this.refreshHud();
        }
      } else if (act === "focus-all" && (this.phase === "simulate" || this.phase === "watch")) {
        this.clearObserveFocus(true);
        this.show(this.live);
      } else if (act === "hud-edge") {
        const edge = el.dataset.edge;
        if (edge === "top" || edge === "bottom" || edge === "left") {
          this.hudEdges = { ...this.hudEdges, [edge]: !this.hudEdges[edge] };
          this.hud.syncHudEdges(this.hudEdges);
          this.bumpHudEdgeActivity();
          this.sound.click();
        }
      }
    });

    this.bindPalettePick();

    this.hud.root.addEventListener(
      "pointerdown",
      (e) => {
        if ((e.target as HTMLElement).closest(".edge-panel")) {
          this.bumpHudEdgeActivity();
        }
      },
      { capture: true },
    );

    this.hud.root.addEventListener(
      "scroll",
      (e) => {
        if ((e.target as HTMLElement).closest(".edge-panel, .planet-dock")) {
          this.bumpHudEdgeActivity();
        }
      },
      { capture: true },
    );

    const canvas = this.world.renderer.domElement;

    canvas.addEventListener("pointerdown", (e) => {
      if (this.tipsOpen || this.shareUrl) {
        return;
      }
      if (this.phase === "simulate" || this.phase === "watch") {
        if (this.cinema.active) {
          cancelCinema(this.cinema);
          this.world.controls.autoRotate = true;
        }
        this.clickAt = { x: e.clientX, y: e.clientY };
        return;
      }
      if (this.phase !== "build") {
        return;
      }
      this.sound.resume();
      this.ndc(e);
      const hit = this.world.pickBody(this.pointer, this.build);
      if (hit) {
        this.buildFromSolarPreset = false;
        this.selectedId = hit.id;
        this.clickAt = null;
        const locked = !canMoveBody(this.stage, hit);
        this.drag = locked ? null : e.shiftKey ? "lift" : "move";
        this.liftStart = { y: hit.pos.y, clientY: e.clientY };
        this.world.controls.enabled = this.drag === null;
        this.refreshHud();
        this.show(this.build);
        e.preventDefault();
        return;
      }
      this.clickAt = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointermove", (e) => {
      if (this.paletteDrag && e.pointerId === this.paletteDrag.pointerId) {
        const d = this.paletteDrag;
        const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
        if (!d.dragging && dist > Game.PALETTE_DRAG_THRESHOLD) {
          d.dragging = true;
          d.source.setPointerCapture(e.pointerId);
          this.world.controls.enabled = false;
          this.showPaletteGhost(d.appearance, e.clientX, e.clientY);
        }
        if (d.dragging) {
          this.showPaletteGhost(d.appearance, e.clientX, e.clientY);
          e.preventDefault();
        }
        return;
      }
      if (!this.drag || this.phase !== "build") {
        return;
      }
      this.ndc(e);
      const b = this.selected();
      if (!b || !canMoveBody(this.stage, b)) {
        return;
      }
      if (this.drag === "lift") {
        const dy = (this.liftStart.clientY - e.clientY) * 0.22;
        b.pos.y = clamp(this.liftStart.y + dy, HEIGHT_MIN, HEIGHT_MAX);
        this.show(this.build);
        return;
      }
      const p = this.world.planePoint(this.pointer, b.pos.y);
      if (!p) {
        return;
      }
      b.pos.x = p.x;
      b.pos.z = p.z;
      this.show(this.build);
    });

    window.addEventListener("pointerup", (e) => {
      if (this.paletteDrag && e.pointerId === this.paletteDrag.pointerId) {
        const wasDragging = this.paletteDrag.dragging;
        this.endPaletteDrag(e, wasDragging);
        return;
      }
      if (this.drag) {
        this.drag = null;
        this.orbit();
        this.world.controls.enabled = true;
        this.show(this.build);
        this.refreshHud();
        this.clickAt = null;
        return;
      }
      if ((this.phase === "simulate" || this.phase === "watch") && this.clickAt) {
        const moved = Math.hypot(e.clientX - this.clickAt.x, e.clientY - this.clickAt.y);
        this.clickAt = null;
        if (moved < 10) {
          this.pickObserveFocus(e);
        }
        return;
      }
      if (this.phase === "build" && this.clickAt) {
        const moved = Math.hypot(e.clientX - this.clickAt.x, e.clientY - this.clickAt.y);
        this.clickAt = null;
        if (moved < 10) {
          this.tryPlace(e);
        }
      }
    });

    window.addEventListener("pointercancel", (e) => {
      if (this.paletteDrag && e.pointerId === this.paletteDrag.pointerId) {
        this.endPaletteDrag(e, false);
      }
    });

    window.addEventListener("keydown", (e) => {
      if (this.phase === "title") {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === Game.KONAMI_KEYS[this.konamiIndex]) {
          this.konamiIndex += 1;
          if (this.konamiIndex >= Game.KONAMI_KEYS.length) {
            this.konamiIndex = 0;
            this.progress = unlockAllProgress();
            saveProgress(this.progress);
            this.flashNotice("すべて解放（デバッグ）");
            this.refreshHud();
          }
        } else {
          this.konamiIndex = key === Game.KONAMI_KEYS[0] ? 1 : 0;
        }
      }
      if (e.key === "Escape" && (this.tipsOpen || this.shareUrl)) {
        this.tipsOpen = false;
        this.shareUrl = null;
        this.refreshHud();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        this.analysis = !this.analysis;
        if (this.phase === "simulate" || this.phase === "watch") {
          this.refreshHud();
        } else {
          this.show(this.phase === "build" ? this.build : this.live);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.phase !== "build") {
          return;
        }
        const b = this.selected();
        if (b && canRemoveBody(b)) {
          this.build = this.build.filter((x) => x.id !== b.id);
          this.buildFromSolarPreset = false;
          this.selectedId = null;
          this.refreshHud();
          this.show(this.build);
        }
      }
    });

    const onShareNavigate = (): void => {
      const shared = decodeShareFromLocation();
      if (shared) {
        this.loadSharedBuild(shared, "watch");
      }
    };

    window.addEventListener("hashchange", onShareNavigate);
    window.addEventListener("popstate", onShareNavigate);

    window.addEventListener("resize", () => this.world.resize());
  }

  private ndc(e: PointerEvent): void {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  private tickVisitors(): void {
    if (this.phase !== "simulate" && this.phase !== "watch") {
      return;
    }
    const t = this.stats.timeSec;
    const sandbox = this.stage.sandbox || this.phase === "watch";
    if (shouldSpawnMeteor(t, sandbox, this.visitors)) {
      this.live.push(makeMeteor());
      noteMeteorSpawn(this.visitors, t);
      this.progress = { ...this.progress, meteorsSeen: this.progress.meteorsSeen + 1 };
      this.applyUnlocks();
    }
    if (shouldSpawnShip(t, sandbox, this.visitors)) {
      const path = shipPath();
      this.world.spawnShip(path.from, path.to);
      noteShipSpawn(this.visitors, t);
      this.progress = { ...this.progress, shipsSeen: this.progress.shipsSeen + 1 };
      this.applyUnlocks();
    }
    if (shouldSpawnComet(t, sandbox, this.visitors, this.progress)) {
      this.live.push(makeComet());
      noteCometSpawn(this.visitors, t);
      this.progress = { ...this.progress, cometSeen: this.progress.cometSeen + 1 };
      this.applyUnlocks();
    }
    if (shouldSpawnSwarm(t, sandbox, this.visitors, this.progress)) {
      this.live.push(...makeSwarm());
      noteSwarmSpawn(this.visitors, t);
      this.progress = { ...this.progress, swarmSeen: this.progress.swarmSeen + 1 };
      this.applyUnlocks();
    }
    if (shouldSpawnSkyFlare(t, sandbox, this.visitors, this.progress)) {
      this.world.skyFlare();
      noteFlareSpawn(this.visitors, t);
      this.progress = { ...this.progress, flareSeen: this.progress.flareSeen + 1 };
      this.applyUnlocks();
    }
    if (shouldSpawnDarkCompanion(t, sandbox, this.visitors, this.progress)) {
      this.live.push(makeDarkCompanion());
      noteDarkSpawn(this.visitors, t);
      this.applyUnlocks();
    }
    this.live = cullMeteors(this.live);
  }

  private loop(ts: number): void {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;
    this.tickHudEdgeIdle(dt);

    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;
      if (this.noticeTimer <= 0) {
        if (this.noticeQueue.length > 0) {
          this.notice = this.noticeQueue.shift() ?? "";
          this.noticeTimer = 4;
        } else {
          this.notice = "";
        }
        this.refreshHud();
      }
    }

    if (this.tipBlTimer > 0) {
      this.tipBlTimer -= dt;
      if (this.tipBlTimer <= 0) {
        this.tipBlLines = [];
        this.refreshHud();
      }
    }

    if (this.phase === "simulate" || this.phase === "watch") {
      const pov = this.selected();
      const rate = pov ? this.simSpeed * POV_SIM_SCALE : this.simSpeed;
      this.acc += dt * rate;
      let eventKind: string | null = null;
      let steps = 0;
      const maxSteps = Math.max(8, Math.ceil(12 * rate));
      while (this.acc >= DT && steps < maxSteps) {
        this.snapshotLive();
        this.acc -= DT;
        steps += 1;
        if (!this.bigBangPending) {
          step(this.live, DT, G);
          const heat = applySolarHeat(this.live, DT);
          if (heat) {
            eventKind = heat.kind;
            this.world.pulse(heat.pos, heat.kind);
            this.sound.collide(heat.kind);
            this.noteCollision({
              kind: heat.kind,
              aId: heat.aId,
              bId: heat.bId,
              pos: heat.pos,
              relSpeed: heat.relSpeed,
            });
            if (heat.kind === "burn") {
              this.progress = {
                ...this.progress,
                sunImpacts: this.progress.sunImpacts + 1,
              };
            }
          }
          const ev = resolveCollisions(this.live);
          if (ev) {
            eventKind = ev.kind;
            this.world.pulse(ev.pos, ev.kind);
            this.sound.collide(ev.kind);
            this.noteCollision(ev);
          }
        }
        this.stats = evaluateFrame(this.live, this.stats, DT, eventKind);
        eventKind = null;
      }
      this.tickVisitors();
      this.progress = { ...this.progress, watchSec: this.progress.watchSec + dt };

      const earth = this.live.find((b) => b.alive && b.kind === "earth");
      const sun = this.live.find((b) => b.alive && b.kind === "sun");
      const moon = this.live.find((b) => b.alive && b.appearance === "moon");
      if (earth && moon && sun && isEarthMoon(moon, earth, sun)) {
        this.progress = {
          ...this.progress,
          moonSurviveSec: this.progress.moonSurviveSec + dt,
        };
      }

      if (this.stats.mood === "collapsed") {
        this.collapseWatchSec += dt;
        if (this.collapseWatchSec >= 30 && !this.progress.watchedAfterCollapse) {
          const patch: Partial<Progress> = { watchedAfterCollapse: true };
          if (hasSolarComplete(this.progress)) {
            patch.watchedAfterCollapsePostSolar = true;
          }
          this.progress = { ...this.progress, ...patch };
          this.applyUnlocks();
        }
      }

      this.watchSaveAcc += dt;
      if (this.watchSaveAcc > 5) {
        this.watchSaveAcc = 0;
        this.persist();
        this.applyUnlocks();
      }
      if (this.stats.mood === "balanced") {
        this.balancedFor += dt;
        this.sound.setAmbient(true);
        if (!this.cinemaStarted && (this.usedSolarPreset || this.balancedFor > 2)) {
          this.cinemaStarted = true;
          startCinema(this.cinema);
          this.world.controls.autoRotate = false;
        }
        if (this.balancedFor >= 60 && !this.longStableNoted) {
          this.longStableNoted = true;
          this.progress = { ...this.progress, longStables: this.progress.longStables + 1 };
          this.applyUnlocks();
        }
      } else {
        this.balancedFor = 0;
        this.sound.setAmbient(false);
      }
      if (this.stats.mood !== this.lastMood) {
        this.lastMood = this.stats.mood;
        if (this.stats.mood === "balanced") {
          this.noteBalanced();
        }
        if (this.phase === "simulate" || this.phase === "watch") {
          this.flashTipBl(this.simTipLines());
        }
      }

    }

    if (this.phase === "finale") {
      this.acc += dt;
      let steps = 0;
      const maxSteps = 8;
      let finaleEvent: ReturnType<typeof resolveFinaleCollisions> = null;
      while (this.acc >= DT && steps < maxSteps) {
        stabilizeFinaleSun(this.live, this.finale);
        this.snapshotLive();
        this.acc -= DT;
        steps += 1;
        stepFinale(this.live, DT, G);
        stabilizeFinaleSun(this.live, this.finale);
        const ev = resolveFinaleCollisions(this.live, this.finale);
        if (ev) {
          finaleEvent = ev;
        }
      }
      const destroyer = this.live.find((b) => b.id === this.finale.destroyerId && b.alive);
      tickFinale(this.finale, dt, destroyer);
      if (destroyer) {
        applyDestroyerGravity(this.live, destroyer, this.finale, dt, G);
      }
      this.stats = tickFinaleYears(this.stats, dt, this.finaleYearRate);
      this.dropObserveFocusIfGone();
      const display = this.displayBodies(this.acc / DT);
      this.world.trails.push(display);
      this.show(display);
      if (finaleEvent?.kind === "big-bang") {
        this.world.supernova(finaleEvent.pos);
      } else if (finaleEvent) {
        this.world.pulse(finaleEvent.pos, finaleEvent.kind);
      }
      this.hud.setTime(this.stats);
      this.hud.updateFinaleCredits(this.finale.elapsed, this.finale.sunExplodedAt);
    } else if (this.phase === "simulate" || this.phase === "watch") {
      this.dropObserveFocusIfGone();
      const display = this.displayBodies(this.acc / DT);
      const focus =
        this.selectedId === null
          ? null
          : (display.find((b) => b.id === this.selectedId && b.alive && !b.ephemeral) ?? null);
      if (this.cinema.active && !focus) {
        tickCinema(this.cinema, dt, display, this.world.camera, this.world.controls);
      } else {
        this.world.follow(display, focus);
      }

      this.world.trails.push(display);
      this.show(display);
      this.hud.setTime(this.stats);
    } else if (this.phase === "build") {
      this.show(this.build);
    }

    this.world.render(dt);
    requestAnimationFrame(this.loop);
  }
}
