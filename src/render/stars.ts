import * as THREE from "three";

export function addStarfield(scene: THREE.Scene, texture: THREE.Texture): THREE.Mesh {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(1800, 48, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sky";
  scene.add(mesh);
  return mesh;
}
