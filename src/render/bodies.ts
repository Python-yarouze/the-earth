import * as THREE from "three";
import type { AppearanceId, Body } from "../physics/body";
import { FANTASY_PLACEABLE_IDS } from "../game/catalog";
import { physicsToWorld } from "./camera";
import { buildFantasyGlobe, syncClockHands, syncEmberAura, type ClockHands } from "./fantasy";

export interface BodyTextures {
  sun: THREE.Texture;
  earth: THREE.Texture;
  clouds: THREE.Texture;
  moon: THREE.Texture;
  mercury: THREE.Texture;
  venus: THREE.Texture;
  mars: THREE.Texture;
  jupiter: THREE.Texture;
  saturn: THREE.Texture;
  uranus: THREE.Texture;
  neptune: THREE.Texture;
  puff?: THREE.Texture;
  brick?: THREE.Texture;
  snowball?: THREE.Texture;
  ember?: THREE.Texture;
  contrarian?: THREE.Texture;
  clock?: THREE.Texture;
}

const DRAW: Record<AppearanceId, number> = {
  sun: 1.08,
  earth: 1.15,
  moon: 3.2,
  mercury: 4.2,
  venus: 3.2,
  mars: 3.4,
  jupiter: 2.15,
  saturn: 2.2,
  uranus: 2.4,
  neptune: 2.4,
  pluto: 4.4,
  asteroid: 4.0,
  meteor: 3.6,
  comet: 3.8,
  blackhole: 0.55,
  gaming: 3.2,
  glass: 3.0,
  puff: 2.4,
  brick: 3.6,
  mirror: 3.1,
  discoball: 2.9,
  snowball: 3.4,
  ember: 3.2,
  contrarian: 3.0,
  dice: 3.5,
  bubble: 2.6,
  clock: 2.8,
  voidseed: 4.8,
  sparkle: 3.3,
  drowsy: 2.7,
  takoyaki: 3.2,
  puddle: 2.9,
  thunder: 3.1,
  crumbly: 3.4,
  sideslip: 2.9,
  relic: 2.0,
  destroyer: 0.55,
};

const MIN_R: Partial<Record<AppearanceId, number>> = {
  sun: 18,
  earth: 3.2,
  moon: 1.1,
  mercury: 3.0,
  pluto: 1.4,
  asteroid: 1.3,
  meteor: 1.6,
  comet: 1.8,
  blackhole: 2.4,
  puff: 6.5,
  brick: 4.2,
  voidseed: 2.2,
  dice: 4.0,
  bubble: 5.5,
  drowsy: 5.8,
  takoyaki: 4.5,
  puddle: 5.2,
  crumbly: 4.0,
  relic: 2.8,
  destroyer: 90,
};

const FANTASY_SET = new Set<string>([...FANTASY_PLACEABLE_IDS, "destroyer"]);

export function visualRadius(body: Body): number {
  const draw = DRAW[body.appearance] ?? 3;
  const min = body.kind === "sun" ? 18 : (MIN_R[body.appearance] ?? 5.2);
  return Math.max(body.radius * draw, min);
}

function softPointTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function rockMap(kind: "asteroid" | "meteor"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "meteor" ? "#3a342e" : "#6a6054";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 4 + Math.random() * 18;
    const shade = kind === "meteor" ? 40 + Math.random() * 35 : 70 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${shade + 20},${shade - 5},${shade - 20},0.55)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "meteor") {
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = `rgba(255,${120 + Math.random() * 80},40,${0.25 + Math.random() * 0.35})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.lineTo(Math.random() * size, Math.random() * size);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function icyCometMap(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c8d8e8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 8 + Math.random() * 20);
    g.addColorStop(0, `rgba(255,255,255,${0.4 + Math.random() * 0.4})`);
    g.addColorStop(0.5, `rgba(160,200,230,${0.25})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function lumpyRockGeometry(r: number, detail: number, lump: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + lump * Math.sin(i * 12.7) * Math.cos(i * 5.3);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

type DebrisBuild = { globe: THREE.Mesh; motionAura?: THREE.Group };

function buildDebrisBody(appearance: AppearanceId, r: number): DebrisBuild {
  const soft = softPointTexture();
  if (appearance === "comet") {
    const globe = new THREE.Mesh(
      lumpyRockGeometry(r * 0.85, 2, 0.08),
      new THREE.MeshStandardMaterial({
        map: icyCometMap(),
        color: 0xffffff,
        roughness: 0.45,
        metalness: 0.08,
        emissive: 0x6a98b8,
        emissiveIntensity: 0.35,
      }),
    );
    const motionAura = new THREE.Group();
    motionAura.name = "motionAura";
    const coma = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.55, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0xa8d8f0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    motionAura.add(coma);
    const ion = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.55, r * 5.5, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x88c8ff,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    ion.rotation.x = Math.PI / 2;
    ion.position.z = -r * 2.6;
    motionAura.add(ion);
    const dustCount = 60;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const t = i / dustCount;
      const spread = r * (0.2 + t * 1.1);
      const ang = i * 1.7;
      dustPos[i * 3] = Math.cos(ang) * spread;
      dustPos[i * 3 + 1] = Math.sin(ang * 1.3) * spread * 0.55;
      dustPos[i * 3 + 2] = -r * (0.4 + t * 5.2);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    motionAura.add(
      new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          map: soft,
          color: 0xd0e8ff,
          size: r * 0.22,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        }),
      ),
    );
    return { globe, motionAura };
  }

  if (appearance === "meteor") {
    const globe = new THREE.Mesh(
      lumpyRockGeometry(r, 1, 0.16),
      new THREE.MeshStandardMaterial({
        map: rockMap("meteor"),
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0.12,
        emissive: 0x4a2010,
        emissiveIntensity: 0.45,
        flatShading: true,
      }),
    );
    globe.scale.set(1, 0.78, 0.9);
    const motionAura = new THREE.Group();
    motionAura.name = "motionAura";
    const streak = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.35, r * 2.8, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    streak.rotation.x = Math.PI / 2;
    streak.position.z = -r * 1.4;
    motionAura.add(streak);
    const sparkCount = 24;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      const t = Math.random();
      sparkPos[i * 3] = (Math.random() - 0.5) * r * 0.6;
      sparkPos[i * 3 + 1] = (Math.random() - 0.5) * r * 0.6;
      sparkPos[i * 3 + 2] = -r * (0.3 + t * 2.4);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    motionAura.add(
      new THREE.Points(
        sparkGeo,
        new THREE.PointsMaterial({
          map: soft,
          color: 0xffc070,
          size: r * 0.14,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        }),
      ),
    );
    return { globe, motionAura };
  }

  // asteroid
  const globe = new THREE.Mesh(
    lumpyRockGeometry(r, 2, 0.14),
    new THREE.MeshStandardMaterial({
      map: rockMap("asteroid"),
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.04,
      flatShading: true,
    }),
  );
  globe.scale.set(1.05, 0.82, 0.92);
  return { globe };
}

function tex(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

async function optionalTex(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture | undefined> {
  try {
    return await tex(loader, url);
  } catch {
    return undefined;
  }
}

export async function loadBodyTextures(): Promise<BodyTextures> {
  const loader = new THREE.TextureLoader();
  const [sun, earth, clouds, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune] =
    await Promise.all([
      tex(loader, "./bodies/sun.jpg"),
      tex(loader, "./bodies/earth.jpg"),
      tex(loader, "./bodies/earth_clouds.jpg"),
      tex(loader, "./bodies/moon.jpg"),
      tex(loader, "./bodies/mercury.jpg"),
      tex(loader, "./bodies/venus.jpg"),
      tex(loader, "./bodies/mars.jpg"),
      tex(loader, "./bodies/jupiter.jpg"),
      tex(loader, "./bodies/saturn.jpg"),
      tex(loader, "./bodies/uranus.jpg"),
      tex(loader, "./bodies/neptune.jpg"),
    ]);
  const [puff, brick, snowball, ember, contrarian, clock] = await Promise.all([
    optionalTex(loader, "./bodies/puff.jpg"),
    optionalTex(loader, "./bodies/brick.jpg"),
    optionalTex(loader, "./bodies/snowball.jpg"),
    optionalTex(loader, "./bodies/ember.jpg"),
    optionalTex(loader, "./bodies/contrarian.jpg"),
    optionalTex(loader, "./bodies/clock.jpg"),
  ]);
  clouds.wrapS = clouds.wrapT = THREE.RepeatWrapping;
  return {
    sun,
    earth,
    clouds,
    moon,
    mercury,
    venus,
    mars,
    jupiter,
    saturn,
    uranus,
    neptune,
    puff,
    brick,
    snowball,
    ember,
    contrarian,
    clock,
  };
}

function planetMaterial(map: THREE.Texture, extras?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x000000,
    emissiveIntensity: 0,
    ...extras,
  });
}

function makeNameSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "600 36px 'IBM Plex Sans', 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(8, 10, 16, 0.85)";
    ctx.lineWidth = 8;
    ctx.strokeText(text, 128, 34);
    ctx.fillStyle = "#f3efe4";
    ctx.fillText(text, 128, 34);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }),
  );
  sprite.scale.set(14, 3.5, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

function mapFor(appearance: AppearanceId, textures: BodyTextures): THREE.Texture | null {
  if (
    appearance === "meteor" ||
    appearance === "sun" ||
    appearance === "asteroid" ||
    appearance === "blackhole" ||
    appearance === "comet"
  ) {
    return null;
  }
  if (appearance === "pluto") {
    return textures.moon;
  }
  if (FANTASY_SET.has(appearance)) {
    return null;
  }
  const table = textures as unknown as Record<string, THREE.Texture | undefined>;
  return table[appearance] ?? null;
}


function hash01(seedA: number, seedB: number): number {
  let n = (seedA * 374761393 + seedB * 668265263) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = (n * 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/**
 * Real lightning is mostly dark, punctuated by short, rapid-fire flash
 * bursts. Model that as: long dark gaps between cycles, with a brief
 * stuttering burst window (bright flash / mid glow / dark) near the start
 * of each cycle.
 */
function thunderIntensity(bodyId: number, nowSec: number): number {
  const cycleLen = 2.2 + hash01(bodyId, 999) * 1.8;
  const cycleIndex = Math.floor(nowSec / cycleLen);
  const phase = nowSec / cycleLen - cycleIndex;
  const burstFrac = (0.1 + hash01(bodyId, cycleIndex * 7 + 1) * 0.22) / cycleLen;
  if (phase > burstFrac) {
    return 0;
  }
  const bucket = Math.floor(nowSec * 45);
  const roll = hash01(bodyId + cycleIndex * 131, bucket);
  if (roll > 0.75) {
    return 1.5 + hash01(bodyId, bucket + 11) * 0.6;
  }
  if (roll > 0.45) {
    return 0.4 + hash01(bodyId, bucket + 3) * 0.35;
  }
  return 0;
}


export class BodyView {
  readonly group: THREE.Group;
  readonly id: number;
  readonly appearance: AppearanceId;
  private globe: THREE.Mesh;
  private clouds?: THREE.Mesh;
  private atmosphere?: THREE.Mesh;
  private corona?: THREE.Mesh;
  private rings?: THREE.Mesh;
  private label?: THREE.Sprite;
  private drop: THREE.Line;
  private restVisual: number;
  private restScale = new THREE.Vector3(1, 1, 1);
  private gamingMat?: THREE.MeshStandardMaterial;
  private thunderMat?: THREE.MeshStandardMaterial;
  private discoballStudMats: THREE.MeshStandardMaterial[] = [];
  private discoballFlares: THREE.Sprite[] = [];
  private discoballGlow?: THREE.Sprite;
  private discoballBokeh?: THREE.Points;
  private clockHands?: ClockHands;
  private destroyerAura?: THREE.Group;
  private emberAura?: THREE.Group;
  private motionAura?: THREE.Group;
  private emberMat?: THREE.MeshStandardMaterial;
  private noteFlashUntil = 0;
  private noteFlashDur = 0.22;
  private noteFlashBase = 0;
  private noteFlashBoost = 0;
  private sunFlashColor?: THREE.Color;

  constructor(body: Body, textures: BodyTextures) {
    this.id = body.id;
    this.appearance = body.appearance;
    this.group = new THREE.Group();
    this.group.userData.bodyId = body.id;
    const r = visualRadius(body);
    this.restVisual = r;

    if (body.kind === "sun") {
      const mat = new THREE.MeshBasicMaterial({ map: textures.sun });
      this.globe = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), mat);
      const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
      });
      this.corona = new THREE.Mesh(new THREE.SphereGeometry(r * 1.18, 32, 24), coronaMat);
      this.group.add(this.globe, this.corona);
    } else if (body.kind === "earth") {
      this.globe = new THREE.Mesh(
        new THREE.SphereGeometry(r, 64, 48),
        planetMaterial(textures.earth, { roughness: 0.72, metalness: 0.04 }),
      );
      const cloudMat = new THREE.MeshStandardMaterial({
        map: textures.clouds,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      });
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 48, 36), cloudMat);
      const atm = new THREE.MeshStandardMaterial({
        color: 0x8fd4ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      });
      this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(r * 1.14, 32, 24), atm);
      this.label = makeNameSprite("地球");
      this.label.position.y = r + 4;
      this.group.add(this.globe, this.clouds, this.atmosphere, this.label);
    } else if (body.appearance === "blackhole") {
      this.globe = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 18),
        new THREE.MeshStandardMaterial({
          color: 0x050308,
          roughness: 1,
          metalness: 0.2,
          emissive: 0x220811,
          emissiveIntensity: 0.45,
        }),
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.55, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0x4a2030,
          transparent: true,
          opacity: 0.22,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      this.corona = halo;
      this.group.add(this.globe, halo);
    } else if (body.kind === "meteor" || body.appearance === "asteroid" || body.appearance === "comet") {
      const built = buildDebrisBody(body.appearance, r);
      this.globe = built.globe;
      this.group.add(this.globe);
      if (built.motionAura) {
        this.motionAura = built.motionAura;
        this.group.add(this.motionAura);
      }
    } else if (FANTASY_SET.has(body.appearance)) {
      const built = buildFantasyGlobe(body, textures, r);
      this.globe = built.globe;
      this.group.add(this.globe);
      if (built.rings) {
        this.rings = built.rings;
        this.group.add(this.rings);
      }
      if (built.adornments) {
        for (const piece of built.adornments) {
          this.globe.add(piece);
        }
      }
      if (built.clockHands) {
        this.clockHands = built.clockHands;
      }
      if (built.destroyerAura) {
        this.destroyerAura = built.destroyerAura;
        this.group.add(this.destroyerAura);
      }
      if (built.emberAura) {
        this.emberAura = built.emberAura;
        this.group.add(this.emberAura);
      }
      if (body.appearance === "gaming" && this.globe.material instanceof THREE.MeshStandardMaterial) {
        this.gamingMat = this.globe.material;
      }
      if (body.appearance === "thunder" && this.globe.material instanceof THREE.MeshStandardMaterial) {
        this.thunderMat = this.globe.material;
      }
      if (body.appearance === "ember" && this.globe.material instanceof THREE.MeshStandardMaterial) {
        this.emberMat = this.globe.material;
      }
      if (body.appearance === "discoball") {
        if (built.discoballStudMats) {
          this.discoballStudMats = built.discoballStudMats;
        }
        if (built.discoballFlares) {
          this.discoballFlares = built.discoballFlares;
        }
        this.discoballGlow = built.discoballGlow;
        this.discoballBokeh = built.discoballBokeh;
      }
    } else {
      const map = mapFor(body.appearance, textures) ?? textures.mars;
      const extras =
        body.appearance === "jupiter"
          ? { roughness: 0.55, metalness: 0.08 }
          : body.appearance === "neptune" || body.appearance === "uranus"
            ? { roughness: 0.42, metalness: 0.12 }
            : { roughness: 1, metalness: 0 };
      this.globe = new THREE.Mesh(new THREE.SphereGeometry(r, 56, 40), planetMaterial(map, extras));
      this.group.add(this.globe);
      if (body.appearance === "saturn") {
        this.rings = new THREE.Mesh(
          new THREE.RingGeometry(r * 1.35, r * 2.15, 64),
          new THREE.MeshStandardMaterial({
            color: 0xc4b896,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            depthWrite: false,
            roughness: 0.85,
            metalness: 0.05,
          }),
        );
        this.rings.rotation.x = Math.PI * 0.48;
        this.group.add(this.rings);
      }
    }

    const dropMat = new THREE.LineBasicMaterial({
      color: 0x8a8678,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ]),
      dropMat,
    );
    this.drop.frustumCulled = false;
    this.group.add(this.drop);
    this.restScale.copy(this.globe.scale);
    this.sync(body);
  }

  sync(body: Body, showHeightGuide = true): void {
    const w = physicsToWorld(body.pos);
    this.group.position.copy(w);
    const s = visualRadius(body) / this.restVisual;
    this.globe.scale.copy(this.restScale).multiplyScalar(s);
    this.clouds?.scale.setScalar(s);
    this.atmosphere?.scale.setScalar(s);
    this.corona?.scale.setScalar(s);
    this.rings?.scale.setScalar(s);
    if (this.motionAura) {
      this.motionAura.scale.setScalar(s);
      const speed = Math.hypot(body.vel.x, body.vel.y, body.vel.z);
      if (speed > 1e-4) {
        // Tail / streak points opposite travel direction (+Z of aura faces velocity).
        const forward = new THREE.Vector3(body.vel.x / speed, body.vel.y / speed, body.vel.z / speed);
        this.motionAura.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      }
    }
    if (this.destroyerAura) {
      this.destroyerAura.scale.setScalar(s);
      const speed = Math.hypot(body.vel.x, body.vel.y, body.vel.z);
      if (speed > 1e-4) {
        const forward = new THREE.Vector3(body.vel.x / speed, body.vel.y / speed, body.vel.z / speed);
        this.destroyerAura.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      }
      const now = performance.now() * 0.001;
      for (const child of this.destroyerAura.children) {
        const spin = child.userData.spin as number | undefined;
        if (typeof spin === "number") {
          child.rotation.y = now * spin;
        }
      }
    }
    if (this.emberAura) {
      this.emberAura.scale.setScalar(s);
      const nowSec = performance.now() * 0.001;
      syncEmberAura(this.emberAura, body.id, nowSec);
    }
    if (this.emberMat && this.noteFlashUntil <= 0) {
      const nowSec = performance.now() * 0.001;
      const pulse = 0.55 + 0.45 * Math.sin(nowSec * 8.5 + body.id);
      const pulse2 = 0.5 + 0.5 * Math.sin(nowSec * 13.1 + body.id * 0.6);
      this.emberMat.emissiveIntensity = 0.95 + 0.55 * pulse + 0.25 * pulse2;
      this.emberMat.emissive.setRGB(0.45 + 0.2 * pulse2, 0.82 + 0.15 * pulse, 1);
    }
    if (this.label) {
      this.label.position.y = visualRadius(body) + 4;
    }
    this.globe.rotation.order = "ZXY";
    this.globe.rotation.z = body.obliquity;
    this.globe.rotation.y = body.spin;
    if (this.clouds) {
      this.clouds.rotation.order = "ZXY";
      this.clouds.rotation.z = body.obliquity;
      this.clouds.rotation.y = body.spin * 1.15;
    }
    if (this.gamingMat) {
      const now = performance.now();
      const hue = ((now * 0.0025 + body.id * 0.07) % 1 + 1) % 1;
      this.gamingMat.emissive.setHSL(hue, 0.95, 0.5);
      this.gamingMat.emissiveIntensity = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin(now * 0.012));
    }
    if (this.thunderMat && this.noteFlashUntil <= 0) {
      const nowSec = performance.now() / 1000;
      this.thunderMat.emissiveIntensity = thunderIntensity(body.id, nowSec);
    }
    if (this.discoballStudMats.length > 0) {
      const nowSec = performance.now() / 1000;
      const bucket = Math.floor(nowSec * 18);
      for (let i = 0; i < this.discoballStudMats.length; i++) {
        const roll = hash01(body.id + i * 17, bucket + i);
        const pulse = hash01(body.id + i, bucket + i * 3 + 1);
        const intensity = roll > 0.88 ? 0.9 + pulse * 0.3 : roll > 0.55 ? 0.15 + pulse * 0.25 : 0.05 + pulse * 0.12;
        this.discoballStudMats[i]!.emissiveIntensity = intensity;
        if (roll > 0.88) {
          const hue = (i * 0.11 + nowSec * 0.35) % 1;
          this.discoballStudMats[i]!.emissive.setHSL(hue, 0.35, 0.72);
        } else {
          this.discoballStudMats[i]!.emissive.setHex(0xd0d8e0);
        }
      }
    }
    if (this.discoballFlares.length > 0) {
      const nowSec = performance.now() / 1000;
      const bucket = Math.floor(nowSec * 9);
      const rr = visualRadius(body);
      for (let i = 0; i < this.discoballFlares.length; i++) {
        const flare = this.discoballFlares[i]!;
        const mat = flare.material as THREE.SpriteMaterial;
        const roll = hash01(body.id * 3 + i * 29, bucket + i * 5);
        const pulse = hash01(body.id + i * 11, bucket + i * 7 + 3);
        if (roll > 0.72) {
          mat.opacity = 0.5 + pulse * 0.5;
          flare.scale.setScalar(rr * (0.7 + pulse * 0.6));
        } else {
          mat.opacity = 0;
        }
      }
    }
    if (this.discoballGlow) {
      const mat = this.discoballGlow.material as THREE.SpriteMaterial;
      const now = performance.now();
      mat.opacity = 0.28 + 0.14 * (0.5 + 0.5 * Math.sin(now * 0.0009 + body.id));
      const hue = ((now * 0.00006 + body.id * 0.13) % 1 + 1) % 1;
      mat.color.setHSL(hue, 0.25, 0.86);
    }
    if (this.discoballBokeh) {
      const mat = this.discoballBokeh.material;
      if (mat instanceof THREE.PointsMaterial) {
        const now = performance.now();
        mat.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.004 + body.id));
        mat.size = visualRadius(body) * (0.28 + 0.08 * (0.5 + 0.5 * Math.sin(now * 0.006)));
      }
    }
    if (this.clockHands) {
      syncClockHands(this.clockHands);
    }
    this.tickNoteFlash();
    const dropAttr = this.drop.geometry.getAttribute("position") as THREE.BufferAttribute;
    dropAttr.setXYZ(0, 0, 0, 0);
    dropAttr.setXYZ(1, 0, -body.pos.y, 0);
    dropAttr.needsUpdate = true;
    this.drop.visible = showHeightGuide && Math.abs(body.pos.y) > 0.4 && !body.ephemeral;
    this.group.visible = body.alive;
  }

  /** Brief emissive flash when the body is "played" as a note. */
  flashNote(durationSec = 0.22): void {
    const mat = this.globe.material;
    this.noteFlashDur = Math.max(0.05, durationSec);
    this.noteFlashUntil = performance.now() / 1000 + this.noteFlashDur;
    if (mat instanceof THREE.MeshStandardMaterial) {
      this.noteFlashBase = mat.emissiveIntensity;
      this.noteFlashBoost = Math.max(1.1, this.noteFlashBase + 0.85);
      if (mat.emissive.r + mat.emissive.g + mat.emissive.b < 0.05) {
        mat.emissive.setHex(0xfff2c8);
      }
      mat.emissiveIntensity = this.noteFlashBoost;
      return;
    }
    if (mat instanceof THREE.MeshBasicMaterial) {
      if (!this.sunFlashColor) {
        this.sunFlashColor = mat.color.clone();
      }
      mat.color.setHex(0xffffff);
    }
  }

  private tickNoteFlash(): void {
    if (this.noteFlashUntil <= 0) {
      return;
    }
    const now = performance.now() / 1000;
    const mat = this.globe.material;
    if (now >= this.noteFlashUntil) {
      this.noteFlashUntil = 0;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.emissiveIntensity = this.noteFlashBase;
      } else if (mat instanceof THREE.MeshBasicMaterial && this.sunFlashColor) {
        mat.color.copy(this.sunFlashColor);
      }
      return;
    }
    const u = Math.max(0, (this.noteFlashUntil - now) / this.noteFlashDur);
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.emissiveIntensity = this.noteFlashBase + (this.noteFlashBoost - this.noteFlashBase) * u;
    }
  }

  dispose(sharedMaps: ReadonlySet<THREE.Texture>): void {
    this.group.traverse((obj) => {
      if (
        !(
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Sprite ||
          obj instanceof THREE.Line ||
          obj instanceof THREE.Points
        )
      ) {
        return;
      }
      if ("geometry" in obj && obj.geometry) {
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) {
          continue;
        }
        detachAndDisposeMaterial(mat, sharedMaps);
      }
    });
  }
}

function detachAndDisposeMaterial(mat: THREE.Material, sharedMaps: ReadonlySet<THREE.Texture>): void {
  const withMap = mat as THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
  if (withMap.map) {
    if (!sharedMaps.has(withMap.map)) {
      withMap.map.dispose();
    }
    withMap.map = null;
  }
  mat.dispose();
}
