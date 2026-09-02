import * as THREE from "three";
import type { AppearanceId, Body } from "../physics/body";
import { FANTASY_PLACEABLE_IDS } from "../game/catalog";
import { physicsToWorld } from "./camera";
import { buildFantasyGlobe, syncClockHands, type ClockHands } from "./fantasy";

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
  destroyer: 0.45,
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
  destroyer: 48,
};

const FANTASY_SET = new Set<string>([...FANTASY_PLACEABLE_IDS, "destroyer"]);

export function visualRadius(body: Body): number {
  const draw = DRAW[body.appearance] ?? 3;
  const min = body.kind === "sun" ? 18 : (MIN_R[body.appearance] ?? 5.2);
  return Math.max(body.radius * draw, min);
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
      const color = body.appearance === "comet" ? 0xa8c4d8 : 0x5a5048;
      this.globe = new THREE.Mesh(
        new THREE.SphereGeometry(r, 10, 8),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          metalness: 0.05,
          emissive: body.appearance === "comet" ? 0x335566 : 0x000000,
          emissiveIntensity: body.appearance === "comet" ? 0.2 : 0,
        }),
      );
      this.globe.scale.set(1, 0.72, body.appearance === "comet" ? 1.4 : 0.88);
      this.group.add(this.globe);
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
      if (body.appearance === "gaming" && this.globe.material instanceof THREE.MeshStandardMaterial) {
        this.gamingMat = this.globe.material;
      }
      if (body.appearance === "thunder" && this.globe.material instanceof THREE.MeshStandardMaterial) {
        this.thunderMat = this.globe.material;
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
    if (body.kind === "meteor" || body.appearance === "asteroid" || body.appearance === "comet") {
      this.globe.scale.set(s, s * 0.72, body.appearance === "comet" ? s * 1.4 : s * 0.88);
    }
    this.clouds?.scale.setScalar(s);
    this.atmosphere?.scale.setScalar(s);
    this.corona?.scale.setScalar(s);
    this.rings?.scale.setScalar(s);
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
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line)) {
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
