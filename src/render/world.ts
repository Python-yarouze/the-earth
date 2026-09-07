import * as THREE from "three";
import type { Body } from "../physics/body";
import { G } from "../physics/constants";
import { accelerations } from "../physics/engine";
import { length } from "../physics/vec3";
import { BodyView, createCometFlybyMesh, loadBodyTextures, type BodyTextures, visualRadius } from "./bodies";
import {
  createCamera,
  createControls,
  createRenderer,
  createScene,
  DEFAULT_CAMERA_EYE,
  DEFAULT_CONTROLS_TARGET,
  DEFAULT_MAX_DISTANCE,
  DEFAULT_MIN_DISTANCE,
  intersectHorizontal,
  physicsToWorld,
} from "./camera";
import { setupFinaleCamera, updateFinaleCamera } from "./cinema";
import type { FinaleState } from "../game/finale";
import { addStarfield } from "./stars";
import { TrailField } from "./trails";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface NovaBurst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  maxAge: number;
}

interface NovaShockwave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxScale: number;
}

let particleSoftTex: THREE.CanvasTexture | null = null;

function softParticleTexture(): THREE.CanvasTexture {
  if (particleSoftTex) {
    return particleSoftTex;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,220,180,0.65)");
  g.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  particleSoftTex = new THREE.CanvasTexture(canvas);
  particleSoftTex.colorSpace = THREE.SRGBColorSpace;
  return particleSoftTex;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly raycaster = new THREE.Raycaster();
  private _textures: BodyTextures;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private sharedMaps: Set<THREE.Texture>;
  private lastBodies: readonly Body[] = [];
  private views = new Map<number, BodyView>();
  /** One PointLight per living sun — lit face always faces the actual sun. */
  private sunLights: THREE.PointLight[] = [];
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  readonly trails: TrailField;
  private arrows = new THREE.Group();
  private selectRing: THREE.Mesh;
  private flash: THREE.PointLight;
  private flashLife = 0;
  private flashDuration = 1;
  private flashPeak = 18;
  private novaBursts: NovaBurst[] = [];
  private novaWaves: NovaShockwave[] = [];
  private sky: THREE.Mesh;
  private grid: THREE.GridHelper;
  private ship: THREE.Group | null = null;
  private shipT = 0;
  private shipLife = 0;
  private shipFrom = new THREE.Vector3();
  private shipTo = new THREE.Vector3();
  private cometFlyby: THREE.Group | null = null;
  private cometFlybyT = 0;
  private cometFlybyLife = 0;
  private cometFlybyFrom = new THREE.Vector3();
  private cometFlybyTo = new THREE.Vector3();
  private skyFlareAge = 0;
  private skyFlareColor = new THREE.Color(0xffc8a0);
  private showHeightGuides = true;
  private watching = false;
  private povFocus: Body | null = null;
  private povFocusId: number | null = null;
  private readonly _lookDir = new THREE.Vector3();
  private readonly _eye = new THREE.Vector3();
  private readonly _com = new THREE.Vector3();
  private readonly ambientBase = 0.28;
  private readonly ambientBaseColor = new THREE.Color(0x7a8aa8);
  private finaleActive = false;
  private finaleState: FinaleState | null = null;
  private lastFinaleBodies: readonly Body[] = [];
  private savedDamping = true;
  private savedAmbient = 0.28;

  constructor(
    canvas: HTMLCanvasElement,
    textures: BodyTextures,
    skyTex: THREE.Texture,
  ) {
    this._textures = textures;
    this.sharedMaps = new Set(
      Object.values(textures).filter((t): t is THREE.Texture => t instanceof THREE.Texture),
    );
    this.sharedMaps.add(skyTex);
    this.renderer = createRenderer(canvas);
    this.scene = createScene();
    this.camera = createCamera();
    this.controls = createControls(this.camera, canvas);
    this.sky = addStarfield(this.scene, skyTex);
    this.applyEnvironment(skyTex);
    this.trails = new TrailField(this.scene);
    this.scene.add(this.arrows);

    this.grid = new THREE.GridHelper(520, 20, 0x4a4e58, 0x22242c);
    const gridMat = this.grid.material;
    if (!Array.isArray(gridMat)) {
      gridMat.transparent = true;
      gridMat.opacity = 0.32;
    }
    this.scene.add(this.grid);

    // Soft fill so night sides stay readable; day still dominated by sun PointLights.
    this.ambient = new THREE.AmbientLight(this.ambientBaseColor, this.ambientBase);
    this.hemi = new THREE.HemisphereLight(0x3a4860, 0x0c1018, 0.32);
    this.flash = new THREE.PointLight(0xffe6b0, 0, 180, 1.4);
    const ringGeo = new THREE.RingGeometry(1.05, 1.18, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf3efe4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.selectRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.visible = false;
    this.scene.add(this.ambient, this.hemi, this.flash, this.selectRing);
    this.bindContextRestore(canvas);
  }

  get textures(): BodyTextures {
    return this._textures;
  }

  private applyEnvironment(skyTex: THREE.Texture): void {
    if (this.envRT) {
      this.envRT.dispose();
      this.envRT = null;
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromEquirectangular(skyTex);
    pmrem.dispose();
    this.envRT = envRT;
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 1.35;
  }

  private bindContextRestore(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      void this.reloadGraphics();
    });
  }

  async reloadGraphics(): Promise<void> {
    this._textures = await loadBodyTextures();
    this.sharedMaps = new Set(
      Object.values(this._textures).filter((t): t is THREE.Texture => t instanceof THREE.Texture),
    );
    const sky = await new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load("./env/milkyway.jpg", resolve, undefined, reject);
    });
    sky.colorSpace = THREE.SRGBColorSpace;
    this.sharedMaps.add(sky);
    const skyMat = this.sky.material;
    if (skyMat instanceof THREE.MeshBasicMaterial) {
      skyMat.map = sky;
      skyMat.needsUpdate = true;
    }
    this.applyEnvironment(sky);
    this.clearViews();
    if (this.lastBodies.length > 0) {
      this.syncBodies(this.lastBodies);
    }
  }

  resetCamera(): void {
    this.povFocus = null;
    this.povFocusId = null;
    this.trails.setVisible(true);
    this.controls.enablePan = true;
    this.controls.minDistance = DEFAULT_MIN_DISTANCE;
    this.controls.maxDistance = DEFAULT_MAX_DISTANCE;
    this.controls.autoRotate = false;
    this.camera.position.copy(DEFAULT_CAMERA_EYE);
    this.controls.target.copy(DEFAULT_CONTROLS_TARGET);
    this.camera.lookAt(DEFAULT_CONTROLS_TARGET);
    this.controls.update();
  }

  static async create(canvas: HTMLCanvasElement): Promise<World> {
    const textures = await loadBodyTextures();
    const sky = await new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load("./env/milkyway.jpg", resolve, undefined, reject);
    });
    sky.colorSpace = THREE.SRGBColorSpace;
    return new World(canvas, textures, sky);
  }

  setWatching(watching: boolean): void {
    this.watching = watching;
    this.grid.visible = !watching;
    this.showHeightGuides = !watching;
    if (!this.finaleActive) {
      this.controls.autoRotate = watching && !this.povFocus;
    }
    this.controls.autoRotateSpeed = 0.48;
    if (!watching && this.povFocus) {
      this.endBodyPov([]);
    }
  }

  /** Scripted finale shot: hide build aids, lock auto-rotate, brighten fill light. */
  enterFinale(state: FinaleState, bodies: readonly Body[]): void {
    this.finaleActive = true;
    this.finaleState = state;
    this.lastFinaleBodies = bodies;
    this.watching = true;
    this.povFocus = null;
    this.povFocusId = null;
    this.grid.visible = false;
    this.showHeightGuides = false;
    this.trails.setVisible(true);
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enabled = true;
    this.savedDamping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.autoRotate = false;
    this.savedAmbient = this.ambient.intensity;
    this.ambient.intensity = 0.46;
    this.trails.reset();
    setupFinaleCamera(state, this.camera, this.controls, bodies);
  }

  exitFinale(): void {
    this.finaleActive = false;
    this.finaleState = null;
    this.lastFinaleBodies = [];
    this.controls.enableDamping = this.savedDamping;
    this.controls.autoRotate = false;
    this.ambient.intensity = this.savedAmbient;
    this.controls.minDistance = DEFAULT_MIN_DISTANCE;
    this.controls.maxDistance = DEFAULT_MAX_DISTANCE;
    this.camera.near = 0.5;
    this.camera.far = 4000;
    this.camera.updateProjectionMatrix();
    this.trails.reset();
  }

  isFinaleActive(): boolean {
    return this.finaleActive;
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  syncBodies(bodies: readonly Body[]): void {
    if (this.finaleActive) {
      this.lastFinaleBodies = bodies;
    }
    this.lastBodies = bodies;
    const ids = new Set(bodies.map((b) => b.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id)) {
        this.scene.remove(view.group);
        view.dispose(this.sharedMaps);
        this.views.delete(id);
      }
    }
    for (const b of bodies) {
      let view = this.views.get(b.id);
      if (view && view.appearance !== b.appearance) {
        this.scene.remove(view.group);
        view.dispose(this.sharedMaps);
        this.views.delete(b.id);
        view = undefined;
      }
      if (!view) {
        view = new BodyView(b, this._textures);
        this.views.set(b.id, view);
        this.scene.add(view.group);
      }
      view.sync(b, this.showHeightGuides);
    }
    this.syncSunLights(bodies);
  }

  /**
   * PointLight at each sun. DirectionalLight was aiming at the moving centroid,
   * so the lit face drifted and then snapped — wrong for orbiting planets.
   * Intensity is candela (three r170); ~12000 keeps Earth (r≈80) readable.
   */
  private syncSunLights(bodies: readonly Body[]): void {
    const suns = bodies.filter((b) => b.alive && b.kind === "sun");
    while (this.sunLights.length < suns.length) {
      const light = new THREE.PointLight(0xfff0c8, 12000, 0, 2);
      this.scene.add(light);
      this.sunLights.push(light);
    }
    while (this.sunLights.length > suns.length) {
      const light = this.sunLights.pop();
      if (light) {
        this.scene.remove(light);
        light.dispose();
      }
    }
    suns.forEach((sun, i) => {
      const light = this.sunLights[i]!;
      light.position.copy(physicsToWorld(sun.pos));
      const massScale = Math.max(0.35, sun.mass / 1000);
      light.intensity = 12000 * massScale;
      light.distance = 0;
      light.decay = 2;
      light.visible = true;
    });
  }

  clearViews(): void {
    for (const view of this.views.values()) {
      this.scene.remove(view.group);
      view.dispose(this.sharedMaps);
    }
    this.views.clear();
  }

  flashBodyNote(bodyId: number, durationSec = 0.22): void {
    this.views.get(bodyId)?.flashNote(durationSec);
  }

  pickBody(ndc: THREE.Vector2, bodies: readonly Body[]): Body | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const view of this.views.values()) {
      view.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          meshes.push(o);
        }
      });
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) {
      return null;
    }
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && obj.userData.bodyId === undefined) {
      obj = obj.parent;
    }
    const id = obj?.userData.bodyId as number | undefined;
    return bodies.find((b) => b.id === id && b.alive) ?? null;
  }

  planePoint(ndc: THREE.Vector2, heightY = 0): { x: number; y: number; z: number } | null {
    const hit = intersectHorizontal(this.raycaster, this.camera, ndc, heightY);
    if (!hit) {
      return null;
    }
    return { x: hit.x, y: heightY, z: hit.z };
  }

  setSelection(body: Body | null): void {
    if (!body || !body.alive) {
      this.selectRing.visible = false;
      return;
    }
    const w = physicsToWorld(body.pos);
    const r = visualRadius(body);
    this.selectRing.position.copy(w);
    this.selectRing.scale.setScalar(r);
    this.selectRing.visible = true;
  }

  drawVectors(bodies: readonly Body[], analysis: boolean, g = G): void {
    this.arrows.clear();
    if (!analysis) {
      return;
    }
    const acc = accelerations(bodies, g);
    bodies.forEach((b, i) => {
      if (!b.alive) {
        return;
      }
      const center = physicsToWorld(b.pos);
      const R = visualRadius(b);
      if (length(b.vel) > 0.15) {
        const dir = new THREE.Vector3(b.vel.x, b.vel.y, b.vel.z).normalize();
        const origin = center.clone().addScaledVector(dir, R);
        const len = Math.min(28, 4 + length(b.vel) * 0.22);
        const color = b.kind === "earth" ? 0x9ecbff : 0xd9d3c5;
        this.arrows.add(new THREE.ArrowHelper(dir, origin, len, color, 3.2, 1.8));
      }
      if (acc[i] && length(acc[i]) > 0.05) {
        const gdir = new THREE.Vector3(acc[i].x, acc[i].y, acc[i].z).normalize();
        const origin = center.clone().addScaledVector(gdir, R);
        this.arrows.add(new THREE.ArrowHelper(gdir, origin, 10, 0xc9785a, 2.4, 1.4));
      }
    });
  }

  pulse(
    pos: { x: number; y: number; z: number },
    kind: string,
  ): void {
    const w = physicsToWorld(pos);
    this.flash.position.copy(w);
    this.flash.color.setHex(
      kind === "earth-lost"
        ? 0xff8866
        : kind === "destroy" || kind === "shatter" || kind === "burn"
          ? 0xffd27a
          : kind === "swallow"
            ? 0x884466
            : kind === "supernova"
              ? 0xfff4e8
              : 0xffffff,
    );
    if (kind === "supernova") {
      this.flashPeak = 140;
      this.flashDuration = 4.2;
    } else if (kind === "big-bang") {
      this.flashPeak = 52;
      this.flashDuration = 2.6;
    } else if (kind === "merge") {
      this.flashPeak = 8;
      this.flashDuration = 1;
    } else {
      this.flashPeak = 18;
      this.flashDuration = 1;
    }
    this.flashLife = this.flashDuration;
    this.flash.intensity = this.flashPeak;
  }

  /** Procedural supernova burst (Three.js particles — no external asset). */
  supernova(pos: { x: number; y: number; z: number }): void {
    const w = physicsToWorld(pos);
    this.pulse(pos, "supernova");
    this.skyFlareColor.setHex(0xffe8c8);
    this.skyFlareAge = 3.2;

    const count = 1400;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 55 + Math.random() * 145;
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.cos(phi) * speed * 0.42;
      const vz = Math.sin(phi) * Math.sin(theta) * speed;
      positions[i * 3] = vx * 0.02;
      positions[i * 3 + 1] = vy * 0.02;
      positions[i * 3 + 2] = vz * 0.02;
      velocities[i * 3] = vx;
      velocities[i * 3 + 1] = vy;
      velocities[i * 3 + 2] = vz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: softParticleTexture(),
      size: 7,
      color: 0xffeedd,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.position.copy(w);
    this.scene.add(points);
    this.novaBursts.push({ points, velocities, age: 0, maxAge: 5.5 });

    for (let ring = 0; ring < 2; ring++) {
      const wave = new THREE.Mesh(
        new THREE.RingGeometry(4 + ring * 6, 10 + ring * 8, 72),
        new THREE.MeshBasicMaterial({
          color: ring === 0 ? 0xffffff : 0xffaa66,
          transparent: true,
          opacity: 0.75 - ring * 0.2,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      wave.position.copy(w);
      wave.lookAt(this.camera.position);
      this.scene.add(wave);
      this.novaWaves.push({ mesh: wave, age: ring * 0.12, maxAge: 2.8, maxScale: 48 + ring * 22 });
    }
  }

  private tickSupernova(dt: number): void {
    for (let i = this.novaBursts.length - 1; i >= 0; i--) {
      const burst = this.novaBursts[i]!;
      burst.age += dt;
      const u = burst.age / burst.maxAge;
      const posAttr = burst.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let p = 0; p < arr.length; p += 3) {
        arr[p] += burst.velocities[p]! * dt;
        arr[p + 1] += burst.velocities[p + 1]! * dt;
        arr[p + 2] += burst.velocities[p + 2]! * dt;
      }
      posAttr.needsUpdate = true;
      const mat = burst.points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 0.95 * (1 - u * u));
      mat.size = 7 + u * 10;
      if (burst.age >= burst.maxAge) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        mat.dispose();
        this.novaBursts.splice(i, 1);
      }
    }
    for (let i = this.novaWaves.length - 1; i >= 0; i--) {
      const wave = this.novaWaves[i]!;
      wave.age += dt;
      const u = wave.age / wave.maxAge;
      const scale = 1 + u * wave.maxScale;
      wave.mesh.scale.setScalar(scale);
      const mat = wave.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (0.75 - u) * (1 - u));
      if (wave.age >= wave.maxAge) {
        this.scene.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        mat.dispose();
        this.novaWaves.splice(i, 1);
      }
    }
  }

  skyFlare(): void {
    this.skyFlareAge = 1.6;
    this.ambient.color.copy(this.skyFlareColor);
    this.ambient.intensity = 0.55;
  }

  spawnShip(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): void {
    this.clearShip();
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 5.2, 7),
      new THREE.MeshStandardMaterial({
        color: 0xd4dae2,
        metalness: 0.55,
        roughness: 0.32,
        emissive: 0x6a7888,
        emissiveIntensity: 0.28,
      }),
    );
    hull.rotation.x = Math.PI / 2;
    const cabin = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x9ed0ff,
        metalness: 0.2,
        roughness: 0.25,
        emissive: 0x2a7098,
        emissiveIntensity: 0.65,
      }),
    );
    cabin.position.z = 0.55;
    const finMat = new THREE.MeshStandardMaterial({
      color: 0xb0b8c4,
      metalness: 0.4,
      roughness: 0.4,
      emissive: 0x445566,
      emissiveIntensity: 0.2,
    });
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.55), finMat);
      fin.position.set(side * 0.85, 0, -0.6);
      fin.rotation.z = side * 0.35;
      g.add(fin);
    }
    const exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 1.8, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    exhaust.rotation.x = -Math.PI / 2;
    exhaust.position.z = -2.6;
    g.add(hull, cabin, exhaust);
    this.ship = g;
    this.shipFrom.set(from.x, from.y, from.z);
    this.shipTo.set(to.x, to.y, to.z);
    this.shipT = 0;
    this.shipLife = 14;
    this.scene.add(this.ship);
  }

  clearShip(): void {
    if (this.ship) {
      this.scene.remove(this.ship);
      this.ship = null;
    }
  }

  /** Decorative comet streak (title / feedback) — not a physics body. */
  spawnCometFlyby(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): void {
    this.clearCometFlyby();
    const g = createCometFlybyMesh(5.5);
    this.cometFlyby = g;
    this.cometFlybyFrom.set(from.x, from.y, from.z);
    this.cometFlybyTo.set(to.x, to.y, to.z);
    this.cometFlybyT = 0;
    this.cometFlybyLife = 6.5;
    g.position.copy(this.cometFlybyFrom);
    g.lookAt(this.cometFlybyTo);
    this.scene.add(g);
  }

  clearCometFlyby(): void {
    if (this.cometFlyby) {
      this.scene.remove(this.cometFlyby);
      this.cometFlyby = null;
    }
  }

  render(dt: number): void {
    this.sky.rotation.y += dt * 0.003;
    this.tickSupernova(dt);
    if (this.flashLife > 0) {
      this.flashLife = Math.max(0, this.flashLife - dt);
      const u = this.flashDuration > 0 ? this.flashLife / this.flashDuration : 0;
      this.flash.intensity = this.flashPeak * u;
    }
    if (this.skyFlareAge > 0) {
      this.skyFlareAge = Math.max(0, this.skyFlareAge - dt * 0.7);
      const u = this.skyFlareAge / 1.6;
      this.ambient.color.lerpColors(this.ambientBaseColor, this.skyFlareColor, u);
      this.ambient.intensity = this.ambientBase + 0.5 * u;
    } else {
      this.ambient.color.copy(this.ambientBaseColor);
      this.ambient.intensity = this.ambientBase;
    }
    if (this.ship) {
      this.shipT += dt;
      const u = Math.min(1, this.shipT / this.shipLife);
      this.ship.position.lerpVectors(this.shipFrom, this.shipTo, u);
      this.ship.lookAt(this.shipTo);
      if (u >= 1) {
        this.clearShip();
      }
    }
    if (this.cometFlyby) {
      this.cometFlybyT += dt;
      const u = Math.min(1, this.cometFlybyT / this.cometFlybyLife);
      this.cometFlyby.position.lerpVectors(this.cometFlybyFrom, this.cometFlybyTo, u);
      this.cometFlyby.lookAt(this.cometFlybyTo);
      if (u >= 1) {
        this.clearCometFlyby();
      }
    }
    this.controls.update();
    if (this.finaleActive) {
      this.controls.autoRotate = false;
      if (this.finaleState) {
        updateFinaleCamera(
          this.finaleState,
          this.camera,
          this.controls,
          this.lastFinaleBodies,
          performance.now(),
        );
      }
    } else if (this.povFocus) {
      this.anchorBodyPov(this.povFocus);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Mass-center follow, or attach camera to a body and look outward. */
  follow(bodies: readonly Body[], focus: Body | null = null): void {
    const next = focus && focus.alive && !focus.ephemeral ? focus : null;
    if (next) {
      if (!this.povFocus || this.povFocusId !== next.id) {
        this.beginBodyPov(next, bodies);
      }
      this.povFocus = next;
      this.povFocusId = next.id;
      return;
    }
    if (this.povFocus) {
      this.endBodyPov(bodies);
    }
    const live = bodies.filter((b) => b.alive && !b.ephemeral);
    if (live.length === 0) {
      return;
    }
    this.massCenterInto(live, this._com);
    this.controls.target.lerp(this._com, 0.04);
  }

  private beginBodyPov(body: Body, bodies: readonly Body[]): void {
    this.trails.setVisible(false);
    this.controls.autoRotate = false;
    this.controls.enablePan = false;
    this.povEyeInto(body, this._eye);
    this.povLookInto(body, bodies, this._lookDir);
    this._lookDir.sub(this._eye);
    if (this._lookDir.lengthSq() < 1e-4) {
      this._lookDir.set(0, 0, -1);
    } else {
      this._lookDir.normalize();
    }
    this.camera.position.copy(this._eye);
    this.controls.target.copy(this._eye).addScaledVector(this._lookDir, 180);
    this.controls.minDistance = DEFAULT_MIN_DISTANCE;
    this.controls.maxDistance = DEFAULT_MAX_DISTANCE;
    this.controls.update();
  }

  private endBodyPov(bodies: readonly Body[]): void {
    this.povFocus = null;
    this.povFocusId = null;
    this.trails.setVisible(true);
    this.controls.enablePan = true;
    this.controls.minDistance = DEFAULT_MIN_DISTANCE;
    this.controls.maxDistance = DEFAULT_MAX_DISTANCE;
    this.controls.autoRotate = this.watching;
    const live = bodies.filter((b) => b.alive && !b.ephemeral);
    if (live.length > 0) {
      this.massCenterInto(live, this._com);
      this._lookDir.copy(this.camera.position).sub(this._com);
      if (this._lookDir.lengthSq() < 1) {
        this._lookDir.set(72, 88, 168);
      } else {
        this._lookDir.setLength(Math.min(420, Math.max(160, this._lookDir.length())));
      }
      this.camera.position.copy(this._com).add(this._lookDir);
      this.controls.target.copy(this._com);
      this.controls.update();
    }
  }

  /** Keep the eye on the body; OrbitControls only changes look direction. */
  private anchorBodyPov(body: Body): void {
    this.povEyeInto(body, this._eye);
    this._lookDir.copy(this.controls.target).sub(this.camera.position);
    let dist = this._lookDir.length();
    if (dist < 1e-3) {
      this._lookDir.set(0, 0, -1);
      dist = 180;
    } else {
      this._lookDir.multiplyScalar(1 / dist);
      dist = Math.min(720, Math.max(48, dist));
    }
    this.camera.position.copy(this._eye);
    this.controls.target.copy(this._eye).addScaledVector(this._lookDir, dist);
  }

  private povEyeInto(body: Body, out: THREE.Vector3): void {
    const r = visualRadius(body);
    out.copy(physicsToWorld(body.pos));
    // Stand just outside the body so the mesh does not fill the lens.
    out.y += Math.max(r * 1.08, 4);
  }

  private povLookInto(body: Body, bodies: readonly Body[], out: THREE.Vector3): void {
    const sun = bodies.find((b) => b.alive && b.kind === "sun" && b.id !== body.id);
    if (sun) {
      out.copy(physicsToWorld(sun.pos));
      return;
    }
    const others = bodies.filter((b) => b.alive && !b.ephemeral && b.id !== body.id);
    if (others.length > 0) {
      this.massCenterInto(others, out);
      return;
    }
    out.set(0, 0, 0);
  }

  private massCenterInto(bodies: readonly Body[], out: THREE.Vector3): void {
    let mx = 0;
    let my = 0;
    let mz = 0;
    let m = 0;
    for (const b of bodies) {
      mx += b.pos.x * b.mass;
      my += b.pos.y * b.mass;
      mz += b.pos.z * b.mass;
      m += b.mass;
    }
    out.set(mx / m, my / m, mz / m);
  }
}
