import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Vec3 } from "../physics/vec3";

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1018);
  scene.fog = new THREE.FogExp2(0x0c1018, 0.00045);
  return scene;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.5,
    4000,
  );
  camera.position.set(72, 88, 168);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 40;
  controls.maxDistance = 720;
  controls.maxPolarAngle = Math.PI - 0.08;
  controls.minPolarAngle = 0.06;
  controls.target.set(0, 0, 0);
  return controls;
}

export function physicsToWorld(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function worldToPhysics(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function intersectHorizontal(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  ndc: THREE.Vector2,
  y = 0,
): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(plane, hit);
  return ok ? hit : null;
}
