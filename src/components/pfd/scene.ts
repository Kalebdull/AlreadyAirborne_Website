// Synthetic vision: the 3D world drawn behind the PFD instruments, in the
// style of Garmin SVT. Loaded on demand (three.js is ~150 KB) after the page
// is already showing the 2D display.

import * as THREE from "three";
import type { FlightState } from "./flight-model";
import { fbm, FIELD, GATE_H, GATE_W, GATES, RUNWAY, terrainHeight } from "./world";

// Vertical field of view chosen so 1° of pitch on the camera matches 1° on
// the pitch ladder (2.6% of the display height per degree).
export const SVT_FOV = 2 * Math.atan((0.5 * Math.tan(Math.PI / 180)) / 0.026) * (180 / Math.PI);

const SKY_TOP = new THREE.Color("#0b3a86");
const SKY_HORIZON = new THREE.Color("#8fb8e8");
const MAGENTA = new THREE.Color("#f048c8");
const GREEN = new THREE.Color("#4ade80");
const AMBER = new THREE.Color("#fbbf24");

export type SvtScene = {
  update: (s: FlightState, view: { pitch: number; roll: number; camera: { x: number; y: number; z: number } }) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

function terrainColor(height: number, x: number, z: number, out: THREE.Color) {
  const h = height - FIELD;
  const patch = fbm(x / 1800 + 7.3, z / 1800 - 2.1, 3);
  if (h < 400) {
    // Farmland: a patchwork of greens and wheat.
    out.setRGB(0.22 + patch * 0.18, 0.36 + patch * 0.16, 0.16 + patch * 0.06);
  } else if (h < 1800) {
    out.setRGB(0.36, 0.38, 0.2).lerp(new THREE.Color(0.48, 0.4, 0.26), (h - 400) / 1400);
  } else if (h < 4200) {
    out.setRGB(0.48, 0.4, 0.26).lerp(new THREE.Color(0.42, 0.34, 0.27), (h - 1800) / 2400);
  } else {
    out.setRGB(0.42, 0.34, 0.27).lerp(new THREE.Color(0.93, 0.95, 0.97), Math.min(1, (h - 4200) / 900));
  }
  return out;
}

function runwayTexture(maxAnisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2a2b2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e9ecef";
  // Edge lines
  ctx.fillRect(0, 4, canvas.width, 4);
  ctx.fillRect(0, canvas.height - 8, canvas.width, 4);
  // Threshold piano keys at both ends
  for (const x0 of [24, canvas.width - 24 - 90]) {
    for (let k = 0; k < 8; k++) ctx.fillRect(x0, 14 + k * 13.5, 90, 8);
  }
  // Centerline dashes
  for (let x = 380; x < canvas.width - 380; x += 120) ctx.fillRect(x, canvas.height / 2 - 2, 70, 4);
  // Runway numbers, oriented for the airplane landing toward them
  ctx.font = "bold 76px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(200, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("9", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(canvas.width - 210, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("27", 0, 0);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function gateGeometry() {
  const t = 16;
  const shape = new THREE.Shape();
  shape.moveTo(-GATE_W / 2, -GATE_H / 2);
  shape.lineTo(GATE_W / 2, -GATE_H / 2);
  shape.lineTo(GATE_W / 2, GATE_H / 2);
  shape.lineTo(-GATE_W / 2, GATE_H / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-GATE_W / 2 + t, -GATE_H / 2 + t);
  hole.lineTo(-GATE_W / 2 + t, GATE_H / 2 - t);
  hole.lineTo(GATE_W / 2 - t, GATE_H / 2 - t);
  hole.lineTo(GATE_W / 2 - t, -GATE_H / 2 + t);
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

export function createScene(container: HTMLElement): SvtScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(SKY_HORIZON);
  const canvas = renderer.domElement;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, 14000, 72000);

  const camera = new THREE.PerspectiveCamera(SVT_FOV, 1, 3, 150000);
  camera.rotation.order = "YXZ";

  // Sky dome: deep blue overhead fading to a hazy horizon.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: SKY_TOP }, horizon: { value: SKY_HORIZON } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main(){ float h = clamp(vDir.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.7)), 1.0); }",
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // Light: low sun from the southwest, plus soft sky fill.
  scene.add(new THREE.HemisphereLight("#cfe3ff", "#3b3020", 1.4));
  const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
  sun.position.set(-0.6, 0.55, 0.45);
  scene.add(sun);

  // Terrain
  const SIZE = 130000;
  const SEG = 320;
  const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - 1500;
    const z = pos.getZ(i) - 2400;
    const y = terrainHeight(x, z);
    pos.setXYZ(i, x, y, z);
    terrainColor(y, x, z, c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);

  // Runway, slightly above the ground to avoid z-fighting.
  const runwayTex = runwayTexture(renderer.capabilities.getMaxAnisotropy());
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.east - RUNWAY.west, RUNWAY.width),
    new THREE.MeshLambertMaterial({ map: runwayTex, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set((RUNWAY.east + RUNWAY.west) / 2, FIELD + 0.5, 0);
  scene.add(runway);

  // Gates: magenta pathway boxes, like Garmin's SVT pathways.
  const gateGeo = gateGeometry();
  const gates = GATES.map((g) => {
    const material = new THREE.MeshBasicMaterial({ color: MAGENTA.clone(), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(gateGeo, material);
    mesh.position.set(g.x, g.y, g.z);
    mesh.lookAt(g.x + g.tx, g.y, g.z + g.tz);
    mesh.renderOrder = 2;
    scene.add(mesh);
    return { mesh, material };
  });

  function update(s: FlightState, view: { pitch: number; roll: number; camera: { x: number; y: number; z: number } }) {
    const d = Math.PI / 180;
    camera.position.set(view.camera.x, view.camera.y, view.camera.z);
    camera.rotation.set(view.pitch * d, -s.hdg * d, -view.roll * d);
    sky.position.copy(camera.position);

    gates.forEach(({ mesh, material }, i) => {
      const g = s.gates[i];
      const age = s.time - g.at;
      if (g.status === "pending") {
        // Only show the pathway a few gates ahead, fading in with distance.
        const ahead = i - s.nextGate;
        mesh.visible = ahead >= 0 && ahead < 5;
        material.color.copy(MAGENTA);
        material.opacity = ahead === 0 ? 0.95 : 0.95 - ahead * 0.14;
        mesh.scale.setScalar(1);
      } else {
        // Passed gates flash green and expand away; missed ones blink amber.
        const t = Math.min(1, age / 0.7);
        mesh.visible = t < 1;
        material.color.copy(g.status === "passed" ? GREEN : AMBER);
        material.opacity = 0.95 * (1 - t);
        mesh.scale.setScalar(1 + t * 0.5);
      }
    });

    renderer.render(scene, camera);
  }

  function resize(w: number, h: number) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    runwayTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { update, resize, dispose };
}
