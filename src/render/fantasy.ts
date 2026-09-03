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
  destroyerAura?: THREE.Group;
  emberAura?: THREE.Group;
  discoballStudMats?: THREE.MeshStandardMaterial[];
  discoballFlares?: THREE.Sprite[];
  discoballGlow?: THREE.Sprite;
  discoballBokeh?: THREE.Points;
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

/** Soft round glow — white core fading to nothing. Used for glints and ambient halos. */
function softGlowTexture(size = 128): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const c = s / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.22)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }, size);
}

/** Four-point star flare — a bright core with two crossed light spikes, like a lens glint. */
function starFlareTexture(size = 128): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const c = s / 2;
    const core = ctx.createRadialGradient(c, c, 0, c, c, s * 0.5);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(0.14, "rgba(255,255,255,0.9)");
    core.addColorStop(0.4, "rgba(255,255,255,0.12)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "lighter";
    const spike = (len: number, w: number, alpha: number) => {
      const grad = ctx.createLinearGradient(c - len, c, c + len, c);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(c - len, c - w / 2, len * 2, w);
    };
    spike(s * 0.5, s * 0.045, 0.85);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-c, -c);
    spike(s * 0.5, s * 0.045, 0.85);
    ctx.restore();
  }, size);
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

/** Dark chassis with neon grid + RGB strips (emissive animation tints the glow). */
function gamingMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#0c0c10";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(40, 255, 120, 0.22)";
    ctx.lineWidth = 1;
    const step = s / 16;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(s, i * step);
      ctx.stroke();
    }
    const bands = [
      { y: 0.18, h: 0.06, colors: ["#ff2244", "#44ff66", "#4488ff"] },
      { y: 0.48, h: 0.05, colors: ["#ff44cc", "#44ffff", "#ffaa22"] },
      { y: 0.78, h: 0.07, colors: ["#66ff33", "#ff6622", "#8866ff"] },
    ];
    for (const band of bands) {
      const by = s * band.y;
      const bh = s * band.h;
      const bw = s / band.colors.length;
      for (let i = 0; i < band.colors.length; i++) {
        ctx.fillStyle = band.colors[i]!;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(i * bw + 2, by, bw - 4, bh);
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      const x = ((i * 47) % s) + 4;
      const y = ((i * 91) % s) + 4;
      ctx.fillStyle = i % 3 === 0 ? "#39ff14" : i % 3 === 1 ? "#ff44aa" : "#44aaff";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }, 512);
}

/** Soap-film iridescence — soft rainbow swirls on a pale film. */
function bubbleMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "rgba(200, 230, 245, 0.35)";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const cx = c + Math.cos(i * 0.9) * s * 0.18;
      const cy = c + Math.sin(i * 1.1) * s * 0.16;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * (0.22 + (i % 3) * 0.06));
      const hue = (i * 47) % 360;
      g.addColorStop(0, `hsla(${hue}, 85%, 72%, 0.55)`);
      g.addColorStop(0.45, `hsla(${(hue + 40) % 360}, 70%, 60%, 0.28)`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `hsla(${(i * 70 + 20) % 360}, 80%, 70%, 0.35)`;
      ctx.lineWidth = 2 + (i % 2);
      ctx.beginPath();
      ctx.ellipse(c, c, s * (0.28 + i * 0.06), s * (0.22 + i * 0.05), i * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const highlight = ctx.createRadialGradient(c * 0.7, c * 0.65, 0, c * 0.7, c * 0.65, s * 0.2);
    highlight.addColorStop(0, "rgba(255,255,255,0.65)");
    highlight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, s, s);
  }, 512);
}

/** Storm body albedo — charcoal clouds. */
function thunderAlbedoMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#1a1524";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 28; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * (0.08 + Math.random() * 0.12));
      const v = 30 + Math.floor(Math.random() * 40);
      g.addColorStop(0, `rgba(${v},${v - 8},${v + 20},0.7)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 512);
}

/** Lightning veins for emissiveMap — white strokes on black. */
function thunderEmissiveMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, s, s);
    const bolt = (x0: number, y0: number, segs: number, spread: number) => {
      let x = x0;
      let y = y0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < segs; i++) {
        x += (Math.random() - 0.5) * spread;
        y += s / segs;
        ctx.lineTo(x, y);
        if (Math.random() > 0.55) {
          const bx = x + (Math.random() - 0.5) * spread * 0.8;
          const by = y + s / segs * 0.6;
          ctx.moveTo(x, y);
          ctx.lineTo(bx, by);
          ctx.moveTo(x, y);
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(200,180,255,0.45)";
      ctx.lineWidth = 6;
      ctx.stroke();
    };
    bolt(s * 0.35, s * 0.05, 10, s * 0.12);
    bolt(s * 0.62, s * 0.1, 9, s * 0.1);
    bolt(s * 0.2, s * 0.35, 7, s * 0.09);
    bolt(s * 0.78, s * 0.4, 8, s * 0.11);
  }, 512);
}

/** Gold / silver glitter ground. */
function sparkleMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const base = ctx.createLinearGradient(0, 0, s, s);
    base.addColorStop(0, "#f5e6b8");
    base.addColorStop(0.45, "#e8d090");
    base.addColorStop(1, "#d0c8b0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const bright = Math.random();
      if (bright > 0.82) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 + bright * 0.4})`;
      } else if (bright > 0.5) {
        ctx.fillStyle = `rgba(255,220,120,${0.4 + bright * 0.4})`;
      } else {
        ctx.fillStyle = `rgba(180,160,120,${0.25 + bright * 0.3})`;
      }
      const sz = bright > 0.9 ? 2.2 : 0.8 + Math.random() * 1.4;
      ctx.fillRect(x, y, sz, sz);
    }
  }, 512);
}

/** Near-black seed with faint purple mottling. */
function voidseedMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#06040a";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * (0.06 + Math.random() * 0.1));
      g.addColorStop(0, `rgba(60, 20, 80, ${0.35 + Math.random() * 0.25})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    const core = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.35);
    core.addColorStop(0, "rgba(20, 8, 28, 0.9)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);
  }, 256);
}

/** Pale glass with fake caustic swirls. */
function glassMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "#d8eef8";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const cx = c + Math.cos(ang) * s * 0.15;
      const cy = c + Math.sin(ang * 1.3) * s * 0.12;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(0.4, "rgba(160,210,230,0.25)");
      g.addColorStop(1, "rgba(120,180,210,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(c, c, s * (0.2 + i * 0.05), s * (0.14 + i * 0.04), i * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, 512);
}

/** Soft night-sky drowsy shell. */
function drowsyMap(): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "#3a4258");
    g.addColorStop(0.5, "#2a3040");
    g.addColorStop(1, "#1c2030");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const blob = ctx.createRadialGradient(x, y, 0, x, y, s * 0.12);
      blob.addColorStop(0, "rgba(70, 80, 110, 0.35)");
      blob.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = blob;
      ctx.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(200, 210, 240, ${0.15 + Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2);
    }
  }, 512);
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

/** Soft teardrop onibi flame — white core → cyan → deep blue, fully transparent margins. */
function onibiFlameTexture(size = 256): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const cx = s * 0.5;
    // Draw bottom→top so tip is near the top of the canvas.
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      // Bulbous base, taper to a wispy tip (slight right lean like the reference).
      const y = s * (0.78 - t * 0.68);
      const lean = t * t * s * 0.07;
      const halfW = s * (0.28 * Math.pow(1 - t, 1.15) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15))));
      const rad = Math.max(s * 0.018, halfW);
      const g = ctx.createRadialGradient(cx + lean, y, 0, cx + lean, y, rad);
      if (t < 0.22) {
        g.addColorStop(0, `rgba(240,255,255,${0.95 - t * 0.2})`);
        g.addColorStop(0.35, `rgba(140,230,255,${0.75 - t * 0.15})`);
        g.addColorStop(0.7, `rgba(40,120,255,${0.35 - t * 0.1})`);
      } else if (t < 0.55) {
        g.addColorStop(0, `rgba(180,245,255,${0.85 - t * 0.35})`);
        g.addColorStop(0.4, `rgba(60,160,255,${0.55 - t * 0.25})`);
        g.addColorStop(0.75, `rgba(20,60,200,${0.28 - t * 0.15})`);
      } else {
        g.addColorStop(0, `rgba(100,200,255,${0.55 - t * 0.35})`);
        g.addColorStop(0.45, `rgba(30,90,220,${0.32 - t * 0.22})`);
        g.addColorStop(0.8, `rgba(10,30,120,${0.12 - t * 0.08})`);
      }
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + lean, y, rad, rad * (1.05 + t * 0.35), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hot core bloom near the bulb
    const core = ctx.createRadialGradient(cx, s * 0.62, 0, cx, s * 0.62, s * 0.18);
    core.addColorStop(0, "rgba(255,255,255,0.95)");
    core.addColorStop(0.25, "rgba(180,245,255,0.7)");
    core.addColorStop(0.55, "rgba(60,160,255,0.28)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, s * 0.62, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Soft outer haze
    const haze = ctx.createRadialGradient(cx, s * 0.55, s * 0.08, cx, s * 0.5, s * 0.48);
    haze.addColorStop(0, "rgba(40,100,255,0)");
    haze.addColorStop(0.45, "rgba(30,80,220,0.18)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, s, s);
  }, size);
}

function buildEmber(r: number): FantasyBuild {
  // The body IS the onibi — flame centered on the origin, no solid planet underneath.
  const flameTex = onibiFlameTexture(256);
  const softTex = softGlowTexture();
  // Invisible placeholder so BodyView still has a globe for scale / note-flash hooks.
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.35, 12, 8),
    solid({
      color: 0xa0e8ff,
      roughness: 1,
      metalness: 0,
      emissive: 0x80d8ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  globe.visible = false;

  const emberAura = new THREE.Group();
  emberAura.name = "emberAura";

  const makeFlame = (op: number, w: number, h: number, phase: number, speed: number) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flameTex,
        color: 0xffffff,
        transparent: true,
        opacity: op,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    // Anchor on the hot core in the texture so the flame body sits on the planet center.
    sprite.center.set(0.5, 0.38);
    sprite.scale.set(r * w, r * h, 1);
    sprite.position.set(0, 0, 0);
    sprite.userData.ember = {
      kind: "flame",
      phase,
      speed,
      baseOp: op,
      baseSx: r * w,
      baseSy: r * h,
      baseY: 0,
    };
    return sprite;
  };

  // Layered copies for volume; same silhouette so it still reads as one flame-body.
  emberAura.add(makeFlame(1.0, 2.6, 3.4, 0.0, 1.0));
  emberAura.add(makeFlame(0.6, 2.3, 3.1, 1.4, 1.15));
  emberAura.add(makeFlame(0.38, 1.95, 2.8, 2.6, 0.85));

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: softTex,
      color: 0x2860ff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.set(r * 2.8, r * 3.1, 1);
  halo.position.set(0, r * 0.15, 0);
  halo.userData.ember = { kind: "halo", phase: 0.3, baseOp: 0.4, baseSx: r * 2.8, baseSy: r * 3.1 };
  emberAura.add(halo);

  const sparkCount = 28;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkPhase = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    sparkPhase[i] = Math.random();
    sparkPos[i * 3] = 0;
    sparkPos[i * 3 + 1] = 0;
    sparkPos[i * 3 + 2] = 0;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      map: softTex,
      color: 0xb8e8ff,
      size: r * 0.085,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  sparks.userData.ember = { kind: "sparks", phases: sparkPhase, radius: r };
  emberAura.add(sparks);

  return { globe, emberAura };
}

/** Flicker the teardrop flame — scale / sway / opacity, not separate ellipsoid tongues. */
export function syncEmberAura(emberAura: THREE.Group, bodyId: number, nowSec: number): void {
  const flicker = 0.55 + 0.45 * Math.sin(nowSec * 8.4 + bodyId * 1.7);
  const flicker2 = 0.55 + 0.45 * Math.sin(nowSec * 13.7 + bodyId * 0.9);
  const sway = Math.sin(nowSec * 3.8 + bodyId) * 0.12 + Math.sin(nowSec * 6.2) * 0.06;

  for (const child of emberAura.children) {
    const u = child.userData.ember as
      | {
          kind: string;
          phase?: number;
          speed?: number;
          baseOp?: number;
          baseSx?: number;
          baseSy?: number;
          baseY?: number;
          phases?: Float32Array;
          radius?: number;
        }
      | undefined;
    if (!u) {
      continue;
    }

    if (u.kind === "sparks" && child instanceof THREE.Points) {
      const pos = child.geometry.getAttribute("position") as THREE.BufferAttribute;
      const phases = u.phases!;
      const radius = u.radius ?? 1;
      for (let i = 0; i < pos.count; i++) {
        const p = (phases[i]! + nowSec * (0.45 + (i % 5) * 0.07)) % 1;
        const spread = radius * (0.08 + p * 0.35);
        const ang = i * 2.1 + nowSec * 0.55 + sway;
        // Drift through the flame body (core at origin, tip upward).
        pos.setXYZ(
          i,
          Math.cos(ang) * spread * (1 - p * 0.45) + sway * radius * 0.12 * p,
          radius * (-0.35 + p * 2.2),
          Math.sin(ang) * spread * (1 - p * 0.45),
        );
      }
      pos.needsUpdate = true;
      const mat = child.material as THREE.PointsMaterial;
      mat.opacity = 0.3 + 0.35 * flicker;
      continue;
    }

    const speed = u.speed ?? 1;
    const phase = u.phase ?? 0;
    const wave = Math.sin(nowSec * (7.2 * speed) + phase);
    const wave2 = Math.sin(nowSec * (10.5 * speed) + phase * 1.4);

    if (child instanceof THREE.Sprite) {
      const mat = child.material as THREE.SpriteMaterial;
      if (typeof u.baseOp === "number") {
        mat.opacity = u.baseOp * (0.78 + 0.22 * flicker + 0.08 * wave);
      }
      if (u.kind === "flame") {
        const sx = (u.baseSx ?? 1) * (1 + 0.07 * wave + 0.05 * flicker2);
        const sy = (u.baseSy ?? 1) * (1 + 0.14 * wave2 + 0.1 * flicker);
        child.scale.set(sx, sy, 1);
        child.position.y = Math.abs(wave) * (u.baseSy ?? 1) * 0.012;
        child.material.rotation = sway * (0.55 + 0.25 * speed) + wave * 0.04;
      } else if (u.kind === "halo") {
        const sx = (u.baseSx ?? 1) * (1 + 0.08 * flicker);
        const sy = (u.baseSy ?? 1) * (1 + 0.06 * wave);
        child.scale.set(sx, sy, 1);
      }
    }
  }
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
  const discoballStudMats: THREE.MeshStandardMaterial[] = [];
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
      const studMat = solid({
        color: 0xffffff,
        roughness: 0.08,
        metalness: 1,
        envMapIntensity: 2,
        emissive: 0xd0d8e0,
        emissiveIntensity: 0.2,
      });
      discoballStudMats.push(studMat);
      const stud = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.1, r * 0.025), studMat);
      stud.position.copy(tmp).multiplyScalar(1.03);
      stud.lookAt(0, 0, 0);
      adornments.push(stud);
    }
  }

  // Ambient glow: a soft camera-facing halo so the ball reads as a light
  // source rather than a plain metal sphere.
  const glowTex = softGlowTexture();
  const discoballGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xdce8ff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  discoballGlow.scale.setScalar(r * 3.4);
  adornments.push(discoballGlow);

  // Flare glints: camera-facing star sprites scattered over the surface,
  // standing in for real specular highlights bouncing off many tiny mirrors.
  const flareTex = starFlareTexture();
  const flareHues = [0.86, 0.7, 0.58, 0.5, 0.92, 0.62, 0.78, 0.4, 0.02, 0.66];
  const discoballFlares: THREE.Sprite[] = [];
  const flareCount = 16;
  for (let i = 0; i < flareCount; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / flareCount));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dist = r * 1.02;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flareTex,
        color: new THREE.Color().setHSL(flareHues[i % flareHues.length]!, 0.55, 0.85),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.position.set(
      Math.sin(phi) * Math.cos(theta) * dist,
      Math.cos(phi) * dist,
      Math.sin(phi) * Math.sin(theta) * dist,
    );
    sprite.scale.setScalar(r * 0.85);
    discoballFlares.push(sprite);
    adornments.push(sprite);
  }

  const bokehCount = 28;
  const bokehPos = new Float32Array(bokehCount * 3);
  const bokehSizes = new Float32Array(bokehCount);
  for (let i = 0; i < bokehCount; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / bokehCount));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dist = r * (1.35 + (i % 5) * 0.12);
    bokehPos[i * 3] = Math.sin(phi) * Math.cos(theta) * dist;
    bokehPos[i * 3 + 1] = Math.cos(phi) * dist;
    bokehPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * dist;
    bokehSizes[i] = r * (0.18 + (i % 4) * 0.06);
  }
  const bokehGeo = new THREE.BufferGeometry();
  bokehGeo.setAttribute("position", new THREE.BufferAttribute(bokehPos, 3));
  bokehGeo.setAttribute("size", new THREE.BufferAttribute(bokehSizes, 1));
  const discoballBokeh = new THREE.Points(
    bokehGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      color: 0xffffff,
      size: r * 0.35,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  adornments.push(discoballBokeh);

  return { globe, adornments, discoballStudMats, discoballFlares, discoballGlow, discoballBokeh };
}

function ominousNebulaTexture(size = 512): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#04010a";
    ctx.fillRect(0, 0, s, s);
    const c = s / 2;

    // Soft indigo underglow
    const base = ctx.createRadialGradient(c, c, s * 0.05, c, c, s * 0.55);
    base.addColorStop(0, "rgba(90,20,120,0.55)");
    base.addColorStop(0.45, "rgba(40,10,90,0.35)");
    base.addColorStop(1, "rgba(8,2,20,0)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);

    // Spiral arms: magenta ↔ purple ↔ deep blue, broken by dark gaps
    for (let arm = 0; arm < 5; arm++) {
      const armPhase = (arm / 5) * Math.PI * 2;
      for (let i = 0; i < 70; i++) {
        const u = i / 70;
        const ang = armPhase + u * Math.PI * 3.2 + Math.sin(u * 9 + arm) * 0.35;
        const rad = s * (0.08 + u * 0.42);
        const x = c + Math.cos(ang) * rad;
        const y = c + Math.sin(ang) * rad * 0.92;
        const blob = ctx.createRadialGradient(x, y, 0, x, y, s * (0.04 + (1 - u) * 0.07));
        const tone = (arm + i) % 3;
        if (tone === 0) {
          blob.addColorStop(0, `rgba(255,90,200,${0.55 - u * 0.35})`);
          blob.addColorStop(0.45, `rgba(160,40,180,${0.28 - u * 0.15})`);
        } else if (tone === 1) {
          blob.addColorStop(0, `rgba(170,70,255,${0.5 - u * 0.3})`);
          blob.addColorStop(0.45, `rgba(70,20,140,${0.26 - u * 0.14})`);
        } else {
          blob.addColorStop(0, `rgba(90,110,255,${0.42 - u * 0.25})`);
          blob.addColorStop(0.45, `rgba(20,30,90,${0.22 - u * 0.12})`);
        }
        blob.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(x, y, s * (0.05 + (1 - u) * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dark voids for contrast (sinister depth)
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = s * (0.12 + Math.random() * 0.32);
      const x = c + Math.cos(ang) * rad;
      const y = c + Math.sin(ang) * rad;
      const voidGrad = ctx.createRadialGradient(x, y, 0, x, y, s * (0.04 + Math.random() * 0.06));
      voidGrad.addColorStop(0, "rgba(0,0,0,0.85)");
      voidGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = voidGrad;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hot magenta core flare
    const core = ctx.createRadialGradient(c, c, 0, c, c, s * 0.14);
    core.addColorStop(0, "rgba(255,210,255,0.95)");
    core.addColorStop(0.25, "rgba(255,80,190,0.7)");
    core.addColorStop(0.6, "rgba(120,20,160,0.25)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);

    // Sparkling dust
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const dx = x - c;
      const dy = y - c;
      if (dx * dx + dy * dy > (s * 0.48) * (s * 0.48)) {
        continue;
      }
      const bright = Math.random();
      const a = 0.25 + bright * 0.75;
      if (bright > 0.82) {
        ctx.fillStyle = `rgba(230,240,255,${a})`;
      } else if (bright > 0.55) {
        ctx.fillStyle = `rgba(255,160,230,${a * 0.85})`;
      } else {
        ctx.fillStyle = `rgba(160,140,255,${a * 0.7})`;
      }
      const sz = bright > 0.9 ? 1.6 : 0.7 + Math.random() * 1.1;
      ctx.fillRect(x, y, sz, sz);
    }
  }, size);
}

function nebulaShellMat(map: THREE.Texture, tint: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color: tint,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

function buildDestroyer(r: number): FantasyBuild {
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 36),
    solid({
      color: 0x0e0c12,
      roughness: 0.78,
      metalness: 0.22,
      emissive: 0x14061c,
      emissiveIntensity: 0.22,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const trench = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.92, r * 0.08, 8, 48),
    solid({ color: 0x221828, roughness: 0.55, metalness: 0.35, emissive: 0x1a0828, emissiveIntensity: 0.35 }),
  );
  trench.rotation.x = Math.PI / 2;
  adornments.push(trench);
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.35, r * 0.42, r * 0.12, 24),
    solid({ color: 0x2a2230, metalness: 0.4, roughness: 0.42, emissive: 0x1c0a2a, emissiveIntensity: 0.32 }),
  );
  dish.position.set(0, r * 0.55, 0);
  adornments.push(dish);

  const nebula = ominousNebulaTexture(512);
  nebula.colorSpace = THREE.SRGBColorSpace;
  nebula.wrapS = THREE.RepeatWrapping;
  nebula.wrapT = THREE.RepeatWrapping;
  const softTex = softGlowTexture();
  const destroyerAura = new THREE.Group();
  destroyerAura.name = "destroyerAura";

  const skin = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.06, 48, 32),
    nebulaShellMat(nebula, 0xffffff, 0.55),
  );
  skin.userData.spin = 0.18;
  destroyerAura.add(skin);

  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.2, 40, 28),
    nebulaShellMat(nebula, 0xc090ff, 0.32),
  );
  veil.rotation.y = 1.1;
  veil.rotation.z = 0.4;
  veil.userData.spin = -0.11;
  destroyerAura.add(veil);

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.38, 32, 24),
    nebulaShellMat(nebula, 0x6080ff, 0.18),
  );
  haze.rotation.y = 2.2;
  haze.userData.spin = 0.07;
  destroyerAura.add(haze);

  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.02, 36, 24),
    new THREE.MeshBasicMaterial({
      map: nebula,
      color: 0xff66cc,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    }),
  );
  rim.userData.spin = -0.22;
  destroyerAura.add(rim);

  // Multi-hue spark field wrapping the body + wake
  const sparkCount = 120;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkCol = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const wrap = i < 70;
    if (wrap) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = r * (1.02 + Math.random() * 0.28);
      sparkPos[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      sparkPos[i * 3 + 1] = rad * Math.cos(phi);
      sparkPos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    } else {
      const t = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const rad = r * (0.4 + Math.random() * 0.7);
      sparkPos[i * 3] = Math.cos(ang) * rad;
      sparkPos[i * 3 + 1] = Math.sin(ang) * rad * 0.7;
      sparkPos[i * 3 + 2] = -r * (0.3 + t * 2.8);
    }
    const tone = Math.random();
    if (tone > 0.7) {
      sparkCol[i * 3] = 1;
      sparkCol[i * 3 + 1] = 0.85;
      sparkCol[i * 3 + 2] = 1;
    } else if (tone > 0.35) {
      sparkCol[i * 3] = 1;
      sparkCol[i * 3 + 1] = 0.35;
      sparkCol[i * 3 + 2] = 0.75;
    } else {
      sparkCol[i * 3] = 0.45;
      sparkCol[i * 3 + 1] = 0.4;
      sparkCol[i * 3 + 2] = 1;
    }
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      map: softTex,
      vertexColors: true,
      size: r * 0.09,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  destroyerAura.add(sparks);

  return { globe, adornments, destroyerAura };
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

function buildGaming(r: number): FantasyBuild {
  const map = gamingMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    solid({
      map,
      color: 0xffffff,
      emissive: 0x39ff14,
      emissiveIntensity: 0.95,
      roughness: 0.35,
      metalness: 0.25,
    }),
  );
  return { globe };
}

function buildBubble(r: number): FantasyBuild {
  const map = bubbleMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    solid({
      map,
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.2,
    }),
  );
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.18, r * 1.52, 48),
    new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.28,
      metalness: 0.15,
    }),
  );
  rings.rotation.x = Math.PI * 0.42;
  return { globe, rings };
}

function buildThunder(r: number): FantasyBuild {
  const map = thunderAlbedoMap();
  const emissiveMap = thunderEmissiveMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    solid({
      map,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.35,
      emissive: 0xc8b0ff,
      emissiveMap,
      emissiveIntensity: 0.6,
    }),
  );
  return { globe };
}

function buildRelic(r: number): FantasyBuild {
  return {
    globe: new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 28),
      solid({ color: 0xf07828, roughness: 0.42, metalness: 0.04 }),
    ),
  };
}

function buildSparkle(r: number): FantasyBuild {
  const map = sparkleMap();
  const softTex = softGlowTexture();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    solid({
      map,
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0.95,
      emissive: 0xffe090,
      emissiveIntensity: 0.35,
      envMapIntensity: 1.6,
    }),
  );
  const count = 36;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / count));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dist = r * (1.02 + (i % 4) * 0.04);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * dist;
    pos[i * 3 + 1] = Math.cos(phi) * dist;
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * dist;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const glints = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: softTex,
      color: 0xfff4c8,
      size: r * 0.12,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  return { globe, adornments: [glints] };
}

function buildVoidseed(r: number): FantasyBuild {
  const map = voidseedMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    solid({
      map,
      color: 0xffffff,
      roughness: 1,
      metalness: 0.45,
      emissive: 0x2a0830,
      emissiveIntensity: 0.4,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.15, r * 0.045, 8, 48),
    solid({
      color: 0x6a3080,
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x4a1860,
      emissiveIntensity: 0.55,
    }),
  );
  ring.rotation.x = Math.PI / 2.4;
  adornments.push(ring);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.25, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0x3a1060,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  adornments.push(halo);
  return { globe, adornments };
}

function buildGlass(r: number): FantasyBuild {
  const map = glassMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    solid({
      map,
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0.55,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 1.6,
    }),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.42, 20, 14),
    solid({
      color: 0xa8d8ec,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
      emissive: 0x6088a0,
      emissiveIntensity: 0.12,
    }),
  );
  return { globe, adornments: [core] };
}

function buildDrowsy(r: number): FantasyBuild {
  const map = drowsyMap();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 22),
    solid({
      map,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      emissive: 0x101018,
      emissiveIntensity: 0.08,
    }),
  );
  const adornments: THREE.Object3D[] = [];
  const lidMat = solid({ color: 0x1a1e28, roughness: 0.9 });
  const makeLid = (x: number) => {
    const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 10, 8), lidMat);
    lid.scale.set(1.15, 0.28, 0.55);
    lid.position.set(x, r * 0.18, r * 0.82);
    return lid;
  };
  adornments.push(makeLid(-r * 0.28));
  adornments.push(makeLid(r * 0.28));
  // Soft cheek blush — tiny spheres, not sprites
  const blushMat = solid({
    color: 0x5a4060,
    roughness: 1,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  for (const x of [-r * 0.48, r * 0.48]) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 8, 6), blushMat);
    blush.scale.set(1, 0.7, 0.5);
    blush.position.set(x, -r * 0.05, r * 0.75);
    adornments.push(blush);
  }
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
  if (id === "destroyer") {
    return buildDestroyer(r);
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
    return buildRelic(r);
  }
  if (id === "gaming") {
    return buildGaming(r);
  }
  if (id === "glass") {
    return buildGlass(r);
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
    return buildBubble(r);
  }
  if (id === "voidseed") {
    return buildVoidseed(r);
  }
  if (id === "sparkle") {
    return buildSparkle(r);
  }
  if (id === "drowsy") {
    return buildDrowsy(r);
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
    return buildThunder(r);
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
