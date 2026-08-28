import * as THREE from "three";
import { freqForBody } from "./audio/notes";
import { Sound } from "./audio/sound";
import { catalogEntry, catalogLabel } from "./game/catalog";
import { createStats, evaluateFrame, type EarthStats } from "./game/evaluation";
import {
  hasChime,
  hasChimeLoop,
  hasDuplicateAppearance,
  hasExtraSlots,
  hasSolarPreset,
  isUnlocked,
  loadProgress,
  markPlayed,
  saveProgress,
  tickUnlocks,
  type Progress,
} from "./game/progress";
import { buildShareUrl, decodeShareFromLocation, shareableBodies } from "./game/share";
import { randomSandboxBodies } from "./game/randomize";
import { parseSimSpeed, POV_SIM_SCALE, type SimSpeed } from "./game/speed";
import { solarSystemBodies } from "./game/solarsystem";
import {
  canMoveBody,
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
  type AppearanceId,
  type Body,
  type CollisionEvent,
} from "./physics";
import { clone, dist, vec3 } from "./physics/vec3";
import { cancelCinema, createCinema, startCinema, tickCinema, type CinemaState } from "./render/cinema";
import { World } from "./render/world";
import { Hud, simTipText, splitTipLines } from "./ui/hud";

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
  private collapseWatchSec = 0;
  private bigBangPending = false;
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
    });
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
    if (this.notice && this.noticeTimer > 0) {
      this.noticeQueue.push(text);
      return;
    }
    this.notice = text;
    this.noticeTimer = 4;
    this.refreshHud();
  }

  private applyUnlocks(): void {
    const { progress, notices, grantedAppearances } = tickUnlocks(this.progress);
    this.progress = progress;
    this.persist();
    for (const n of notices) {
      this.flashNotice(n);
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
    if (
      !p ||
      !this.stage.allowPlanets ||
      (!placingPlanet && !placingSun) ||
      !isUnlocked(this.progress, this.pickAppearance) ||
      (!placingSun && planetCount(this.build) >= this.planetCap()) ||
      this.build.filter((b) => b.alive && !b.ephemeral).length >= this.bodyCap()
    ) {
      return;
    }
    const planet = makePlanet(this.pickAppearance, p);
    this.build.push(planet);
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
    if (this.stats.everBalanced || this.stats.mood === "balanced") {
      this.progress = { ...this.progress, copiedBalanced: true };
    }
    this.applyUnlocks();
    this.flashTipBl(["リンクをコピーした。"]);
  }

  private shareToX(): void {
    const url = this.shareUrl ?? this.buildShareUrl();
    const text = "THE EARTH — 軌道のバランスを眺める";
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  private shareToLine(): void {
    const url = this.shareUrl ?? this.buildShareUrl();
    const intent = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
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
      } else if (act === "unlocks" && this.phase === "build") {
        this.phase = "unlocks";
        this.refreshHud();
        this.sound.click();
      } else if (act === "back-build" && this.phase === "unlocks") {
        this.phase = "build";
        this.refreshHud();
        this.sound.click();
      } else if (act === "appear") {
        const id = el.dataset.id as AppearanceId;
        if (isUnlocked(this.progress, id)) {
          this.pickAppearance = id;
          this.refreshHud();
        }
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
      }
    });

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

    window.addEventListener("keydown", (e) => {
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
        if (b && b.kind === "planet") {
          this.build = this.build.filter((x) => x.id !== b.id);
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
          this.progress = { ...this.progress, watchedAfterCollapse: true };
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
          const earthBuild = this.build.find((b) => b.kind === "earth");
          const twin = hasDuplicateAppearance(this.live);
          this.progress = {
            ...this.progress,
            balances: this.progress.balances + 1,
            twinBalances: this.progress.twinBalances + (twin ? 1 : 0),
            tiltedBalances:
              this.progress.tiltedBalances + (earthBuild && Math.abs(earthBuild.pos.y) > 8 ? 1 : 0),
            fourBodyBalances:
              this.progress.fourBodyBalances + (extraBodyCount(this.live) >= 4 ? 1 : 0),
            jupiterBalances:
              this.progress.jupiterBalances +
              (shareableBodies(this.build).some((b) => b.appearance === "jupiter") ? 1 : 0),
          };
          this.applyUnlocks();
        }
        this.flashTipBl(this.simTipLines());
      }

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
