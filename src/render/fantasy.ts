import * as THREE from "three";
import type { AppearanceId, Body } from "../physics/body";

export type FantasyTextures = {
  puff?: THREE.Texture;
  contrarian?: THREE.Texture;
  mars: THREE.Texture;
};

export type ClockHands = {
  hour: THREE.Object3D;
  minute: THREE.Object3D;
  second: THREE.Object3D;
};

export type FantasyBuild = {
  globe: THREE.Mesh;
  rings?: THREE.Mesh;
  adornments?: THREE.Object3D[];
  clockHands?: ClockHands;
};

function solid(extras: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x000000,
    emissiveIntensity: 0,
    ...extras,
  });
}

function canvasTex(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    draw(ctx, size);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function brickMap(): THREE.CanvasTexture {
  return canvasTex((ctx, size) => {
    ctx.fillStyle = "#4a2c1c";
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const cols = 4;
    const bh = size / rows;
    const bw = size / cols;
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : bw * 0.5;
      for (let col = -1; col <= cols; col++) {
        const x = col * bw + offset;
        const y = row * bh;
        const shade = 0.78 + ((row * 3 + col * 5) % 5) * 0.04;
        ctx.fillStyle = `rgb(${Math.floor(110 * shade)},${Math.floor(58 * shade)},${Math.floor(36 * shade)})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
  });
}

function clockFaceMap(): THREE.CanvasTexture {
  return canvasTex((ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = "#f3ebd4";
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a4630";
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const major = i % 5 === 0;
      const r0 = c * (major ? 0.72 : 0.82);
      const r1 = c * 0.9;
      ctx.strokeStyle = major ? "#3a2c1c" : "#8a7860";
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a2c1c";
    ctx.font = `600 ${Math.floor(size * 0.11)}px 'IBM Plex Sans', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(h), c + Math.cos(a) * c * 0.58, c + Math.sin(a) * c * 0.58);
    }
    ctx.beginPath();
    ctx.arc(c, c, 6, 0, Math.PI * 2);
    ctx.fill();
  }, 512);
}

function pipLayout(n: number, d: number): Array<[number, number]> {
  if (n === 1) {
    return [[0, 0]];
  }
  if (n === 2) {
    return [
      [-d, -d],
      [d, d],
    ];
  }
  if (n === 3) {
    return [
      [-d, -d],
      [0, 0],
      [d, d],
    ];
  }
  if (n === 4) {
    return [
      [-d, -d],
      [-d, d],
      [d, -d],
      [d, d],
    ];
  }
  if (n === 5) {
    return [
      [-d, -d],
      [-d, d],
      [0, 0],
      [d, -d],
      [d, d],
    ];
  }
  return [
    [-d, -d],
    [-d, 0],
    [-d, d],
    [d, -d],
    [d, 0],
    [d, d],
  ];
}

function buildDice(r: number): FantasyBuild {
  const side = r * 1.45;
  const h = side / 2;
  const globe = new THREE.Mesh(
    new THREE.BoxGeometry(side, side, side),
    solid({ color: 0xf4eee2, roughness: 0.7, flatShading: true }),
  );
  const pipMat = solid({ color: 0x1a1410, roughness: 0.9 });
  const pipR = side * 0.07;
  const d = h * 0.42;
  const faces: Array<{ n: number; place: (u: number, v: number) => THREE.Vector3 }> = [
    { n: 1, place: (u, v) => new THREE.Vector3(u, h + pipR * 0.2, v) },
    { n: 6, place: (u, v) => new THREE.Vector3(u, -h - pipR * 0.2, v) },
    { n: 2, place: (u, v) => new THREE.Vector3(u, v, h + pipR * 0.2) },
    { n: 5, place: (u, v) => new THREE.Vector3(u, v, -h - pipR * 0.2) },
    { n: 3, place: (u, v) => new THREE.Vector3(h + pipR * 0.2, v, u) },
    { n: 4, place: (u, v) => new THREE.Vector3(-h - pipR * 0.2, v, u) },
  ];
  const adornments: THREE.Object3D[] = [];
  for (const face of faces) {
    for (const [u, v] of pipLayout(face.n, d)) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(pipR, 8, 6), pipMat);
      pip.position.copy(face.place(u, v));
      adornments.push(pip);
    }
  }
  return { globe, adornments };
}

function buildEmber(r: number): FantasyBuild {
  // 鬼火: pale blue will-o'-wisp — soft additive lobes, not orange cones.
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.42, 24, 16),
    solid({
      color: 0xd8f0ff,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0x80d8ff,
      emissiveIntensity: 1.1,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const lobes: Array<{ y: number; s: number; x: number; z: number; op: number; hue: number }> = [
    { y: 0.35, s: 0.85, x: 0, z: 0, op: 0.55, hue: 0xb8ecff },
    { y: 0.7, s: 0.7, x: 0.1, z: -0.06, op: 0.45, hue: 0x9ad8ff },
    { y: 0.55, s: 0.65, x: -0.12, z: 0.08, op: 0.4, hue: 0xe8ffff },
    { y: 0.95, s: 0.48, x: 0.04, z: 0.04, op: 0.35, hue: 0xffffff },
    { y: 0.25, s: 0.55, x: -0.05, z: -0.12, op: 0.3, hue: 0x70c8ff },
  ];
  for (const lobe of lobes) {
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.38 * lobe.s, 16, 12),
      new THREE.MeshBasicMaterial({
        color: lobe.hue,
        transparent: true,
        opacity: lobe.op,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    flame.scale.set(0.85, 1.55, 0.85);
    flame.position.set(r * lobe.x, r * lobe.y, r * lobe.z);
    adornments.push(flame);
  }
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.15, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0x60b0ff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  adornments.push(aura);
  return { globe, adornments };
}

function buildSnowball(r: number): FantasyBuild {
  const geo = new THREE.IcosahedronGeometry(r, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + 0.035 * Math.sin(i * 17.1) * Math.cos(i * 9.3);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const globe = new THREE.Mesh(
    geo,
    solid({
      color: 0xf4f8fc,
      roughness: 0.98,
      metalness: 0,
      flatShading: false,
    }),
  );
  const rim = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r * 1.06, 2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  return { globe, adornments: [rim] };
}

function buildDiscoball(r: number): FantasyBuild {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const globe = new THREE.Mesh(
    geo,
    solid({
      color: 0xeef2f8,
      roughness: 0.12,
      metalness: 0.92,
      flatShading: true,
      envMapIntensity: 1.8,
      emissive: 0x8a9aaa,
      emissiveIntensity: 0.18,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const studMat = solid({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 1,
    envMapIntensity: 2,
    emissive: 0xd0d8e0,
    emissiveIntensity: 0.2,
  });
  const tmp = new THREE.Vector3();
  const faces = geo.index;
  const pos = geo.attributes.position;
  if (faces) {
    for (let i = 0; i < faces.count; i += 3) {
      tmp.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        const idx = faces.getX(i + k);
        tmp.x += pos.getX(idx);
        tmp.y += pos.getY(idx);
        tmp.z += pos.getZ(idx);
      }
      tmp.multiplyScalar(1 / 3);
      const stud = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.1, r * 0.025), studMat);
      stud.position.copy(tmp).multiplyScalar(1.03);
      stud.lookAt(0, 0, 0);
      adornments.push(stud);
    }
  }
  return { globe, adornments };
}

function buildBrick(r: number): FantasyBuild {
  const map = brickMap();
  const globe = new THREE.Mesh(
    new THREE.BoxGeometry(r * 1.7, r * 0.95, r * 1.05),
    solid({ map, color: 0xffffff, roughness: 0.92, flatShading: true }),
  );
  return { globe };
}

function buildClock(r: number): FantasyBuild {
  const thickness = r * 0.2;
  const geo = new THREE.CylinderGeometry(r, r, thickness, 48);
  geo.rotateX(Math.PI / 2);
  const globe = new THREE.Mesh(
    geo,
    solid({ map: clockFaceMap(), color: 0xffffff, roughness: 0.55, metalness: 0.08 }),
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.98, r * 0.06, 8, 48),
    solid({ color: 0x8a7050, roughness: 0.45, metalness: 0.35 }),
  );
  rim.position.z = thickness * 0.15;

  const handMat = solid({ color: 0x2a2018, roughness: 0.55, metalness: 0.15 });
  const secondMat = solid({ color: 0xb04030, roughness: 0.5 });
  const makeHand = (len: number, width: number, mat: THREE.Material) => {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(width, len, width * 0.35), mat);
    hand.position.y = len * 0.42;
    const pivot = new THREE.Group();
    pivot.add(hand);
    pivot.position.z = thickness * 0.55;
    return pivot;
  };
  const hour = makeHand(r * 0.42, r * 0.07, handMat);
  const minute = makeHand(r * 0.62, r * 0.05, handMat);
  const second = makeHand(r * 0.72, r * 0.025, secondMat);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 10, 8), handMat);
  cap.position.z = thickness * 0.55;

  return {
    globe,
    adornments: [rim, hour, minute, second, cap],
    clockHands: { hour, minute, second },
  };
}

function buildTakoyaki(r: number): FantasyBuild {
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 24),
    solid({
      color: 0x6b2e18,
      roughness: 0.42,
      metalness: 0.06,
      emissive: 0x2a1008,
      emissiveIntensity: 0.14,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const sauce = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.52, 16, 12),
    solid({
      color: 0x3a140c,
      roughness: 0.18,
      metalness: 0.15,
      emissive: 0x1a0804,
      emissiveIntensity: 0.08,
    }),
  );
  sauce.scale.set(1.05, 0.55, 1.05);
  sauce.position.y = r * 0.55;
  adornments.push(sauce);
  const seedMat = solid({ color: 0x1c1410, roughness: 0.95 });
  for (let i = 0; i < 9; i++) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(r * 0.055, 6, 4), seedMat);
    const theta = (i / 9) * Math.PI * 2 + 0.2;
    const phi = 0.28 + (i % 3) * 0.12;
    seed.position.set(
      Math.sin(phi) * Math.cos(theta) * r * 0.98,
      Math.cos(phi) * r * 0.98,
      Math.sin(phi) * Math.sin(theta) * r * 0.98,
    );
    adornments.push(seed);
  }
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.028, r * 0.038, r * 1.15, 6),
    solid({ color: 0xe8d8b0, roughness: 0.8, metalness: 0.02 }),
  );
  stick.position.set(r * 0.12, r * 0.92, r * 0.05);
  stick.rotation.z = -0.22;
  stick.rotation.x = 0.12;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(r * 0.04, r * 0.12, 6),
    solid({ color: 0xd0c090, roughness: 0.75 }),
  );
  tip.position.set(0, r * 0.58, 0);
  stick.add(tip);
  adornments.push(stick);
  return { globe, adornments };
}

export function buildFantasyGlobe(
  body: Body,
  textures: FantasyTextures,
  r: number,
): FantasyBuild {
  const id: AppearanceId = body.appearance;

  if (id === "dice") {
    return buildDice(r);
  }
  if (id === "ember") {
    return buildEmber(r);
  }
  if (id === "snowball") {
    return buildSnowball(r);
  }
  if (id === "discoball") {
    return buildDiscoball(r);
  }
  if (id === "brick") {
    return buildBrick(r);
  }
  if (id === "clock") {
    return buildClock(r);
  }
  if (id === "takoyaki") {
    return buildTakoyaki(r);
  }
  if (id === "relic") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({ color: 0xf07828, roughness: 0.42, metalness: 0.04 }),
      ),
    };
  }
  if (id === "gaming") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({ color: 0x18181c, emissive: 0x39ff14, emissiveIntensity: 0.95, roughness: 0.35, metalness: 0.2 }),
      ),
    };
  }
  if (id === "glass") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({
          color: 0xc8e8f8,
          roughness: 0.08,
          metalness: 0.75,
          transparent: true,
          opacity: 0.78,
          envMapIntensity: 1.5,
        }),
      ),
    };
  }
  if (id === "mirror") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 48, 36),
        solid({
          color: 0xf4f7fb,
          roughness: 0.06,
          metalness: 1,
          envMapIntensity: 2.1,
          emissive: 0xa8b4c0,
          emissiveIntensity: 0.12,
        }),
      ),
    };
  }
  if (id === "puff") {
    const map = textures.puff;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      solid({
        map: map ?? undefined,
        color: map ? 0xffffff : 0xefe8dc,
        roughness: 1,
        transparent: true,
        opacity: 0.92,
      }),
    );
    const adornments: THREE.Object3D[] = [];
    const fluff = solid({ color: 0xf6f0e6, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 12, 8), fluff);
      const a = (i / 7) * Math.PI * 2;
      cloud.position.set(Math.cos(a) * r * 0.55, Math.sin(a * 1.3) * r * 0.25, Math.sin(a) * r * 0.55);
      adornments.push(cloud);
    }
    return { globe, adornments };
  }
  if (id === "contrarian") {
    const map = textures.contrarian ?? textures.mars;
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({ map, color: 0xffffff, roughness: 0.7, emissive: 0x402060, emissiveIntensity: 0.15 }),
      ),
    };
  }
  if (id === "bubble") {
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 28),
      solid({
        color: 0xb8e0f0,
        roughness: 0.12,
        metalness: 0.25,
        transparent: true,
        opacity: 0.38,
      }),
    );
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.2, r * 1.5, 48),
      new THREE.MeshStandardMaterial({
        color: 0xe8f8ff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.35,
      }),
    );
    rings.rotation.x = Math.PI * 0.42;
    return { globe, rings };
  }
  if (id === "voidseed") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 20, 14),
        solid({ color: 0x0a0610, roughness: 1, metalness: 0.4, emissive: 0x2a0830, emissiveIntensity: 0.35 }),
      ),
    };
  }
  if (id === "sparkle") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({ color: 0xfff6d0, roughness: 0.12, metalness: 1, emissive: 0xffe090, emissiveIntensity: 0.45 }),
      ),
    };
  }
  if (id === "drowsy") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 22),
        solid({ color: 0x2a3040, roughness: 1, metalness: 0, emissive: 0x101018, emissiveIntensity: 0.06 }),
      ),
    };
  }
  if (id === "puddle") {
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 28),
      solid({
        color: 0x5a9ec8,
        roughness: 0.08,
        metalness: 0.4,
        transparent: true,
        opacity: 0.68,
      }),
    );
    globe.scale.set(1.35, 0.32, 1.35);
    return { globe };
  }
  if (id === "thunder") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 40, 28),
        solid({ color: 0x282038, roughness: 0.4, metalness: 0.45, emissive: 0xc8b0ff, emissiveIntensity: 0.6 }),
      ),
    };
  }
  if (id === "crumbly") {
    return {
      globe: new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 5),
        solid({ color: 0x9a8a70, roughness: 0.95, flatShading: true }),
      ),
    };
  }
  if (id === "sideslip") {
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 28),
      solid({ color: 0x70a090, roughness: 0.5, metalness: 0.18 }),
    );
    globe.scale.set(1.55, 0.55, 0.85);
    return { globe };
  }

  return {
    globe: new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), solid({ color: 0x888888 })),
  };
}

/** Drive clock hands from wall-clock time (radians around local Z). */
export function syncClockHands(hands: ClockHands): void {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  hands.second.rotation.z = (-s / 60) * Math.PI * 2;
  hands.minute.rotation.z = (-m / 60) * Math.PI * 2;
  hands.hour.rotation.z = (-h / 12) * Math.PI * 2;
}
