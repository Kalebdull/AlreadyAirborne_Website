// Synthetic vision: the 3D world drawn behind the PFD instruments, in the
// style of Garmin SVT. Loaded on demand (three.js is ~150 KB) after the page
// is already showing the 2D display.

import * as THREE from "three";
import type { FlightState } from "./flight-model";
import { LEVELS } from "./levels";
import { fbm, FIELD, PAPI, RUNWAY, terrainHeight, THRESHOLD_X } from "./world";

// Vertical field of view chosen so 1° of pitch on the camera matches 1° on
// the pitch ladder (2.6% of the display height per degree).
export const SVT_FOV = 2 * Math.atan((0.5 * Math.tan(Math.PI / 180)) / 0.026) * (180 / Math.PI);

const SKY_TOP = new THREE.Color("#0b3a86");
const SKY_HORIZON = new THREE.Color("#8fb8e8");
const MAGENTA = new THREE.Color("#f048c8");
const GREEN = new THREE.Color("#4ade80");
const AMBER = new THREE.Color("#fbbf24");

// Where the next ring's center lands on the display: x/y in normalized
// device coordinates (-1..1, +y up), and whether it's in front of the camera.
export type RingCue = { x: number; y: number; front: boolean } | null;

export type SvtScene = {
  update: (s: FlightState, view: { pitch: number; roll: number; camera: { x: number; y: number; z: number } }) => RingCue;
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
  // Touchdown zone (500, 1500, 2000 ft) and aiming point (1000 ft) markings,
  // at both ends. 4096 px across 5200 ft of runway.
  const pxPerFt = canvas.width / (RUNWAY.east - RUNWAY.west);
  const mid = canvas.height / 2;
  for (const flip of [false, true]) {
    const at = (ft: number, len: number) => (flip ? canvas.width - (ft + len) * pxPerFt : ft * pxPerFt);
    ctx.fillRect(at(1000, 150), mid - 44, 150 * pxPerFt, 18);
    ctx.fillRect(at(1000, 150), mid + 26, 150 * pxPerFt, 18);
    for (const [ft, bars] of [[500, 3], [1500, 2], [2000, 2]] as const) {
      for (let b = 0; b < bars; b++) {
        ctx.fillRect(at(ft, 75), mid - 50 + b * 9, 75 * pxPerFt, 5);
        ctx.fillRect(at(ft, 75), mid + 45 - b * 9, 75 * pxPerFt, 5);
      }
    }
  }
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

// Tileable ground detail: soft blotches and grain, multiplied over the
// terrain colors. This is what gives you a sense of speed down low.
function groundDetailTexture(maxAnisotropy: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(232,232,232)";
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 3 + rand() * 18;
    const g = 190 + Math.floor(rand() * 65);
    ctx.fillStyle = `rgba(${g},${g},${g},0.35)`;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * (0.4 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function softDiscTexture(stops: [number, string][]) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createScene(container: HTMLElement): SvtScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
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
  const detail = groundDetailTexture(renderer.capabilities.getMaxAnisotropy());
  detail.repeat.set(SIZE / 700, SIZE / 700);
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true, map: detail }));
  scene.add(terrain);

  // Clouds: soft billboards well above the pattern, for depth and parallax.
  const cloudTex = softDiscTexture([
    [0, "rgba(255,255,255,0.95)"],
    [0.45, "rgba(255,255,255,0.55)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85 });
  let cseed = 42;
  const crand = () => ((cseed = (cseed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const angle = crand() * Math.PI * 2;
    const dist = 6000 + crand() * 42000;
    const cx = Math.cos(angle) * dist - 1500;
    const cz = Math.sin(angle) * dist - 2400;
    const puffs = 3 + Math.floor(crand() * 4);
    for (let k = 0; k < puffs; k++) {
      const sprite = new THREE.Sprite(cloudMat);
      const w = 1800 + crand() * 3200;
      sprite.scale.set(w, w * (0.35 + crand() * 0.2), 1);
      sprite.position.set(cx + (crand() - 0.5) * 3000, FIELD + 3400 + crand() * 2200, cz + (crand() - 0.5) * 3000);
      scene.add(sprite);
    }
  }

  // PAPI lights: screen-sized glows so they read from miles out.
  const papiTex = softDiscTexture([
    [0, "rgba(255,255,255,1)"],
    [0.25, "rgba(255,255,255,0.9)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const papi = PAPI.angles.map((angle, i) => {
    const material = new THREE.SpriteMaterial({ map: papiTex, color: 0xffffff, sizeAttenuation: false, depthWrite: false, fog: false, toneMapped: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.024, 0.024, 1);
    sprite.position.set(PAPI.x, FIELD + 4, PAPI.z - (PAPI.angles.length - 1 - i) * PAPI.spacing);
    sprite.renderOrder = 3;
    scene.add(sprite);
    return { sprite, material, angle };
  });
  const papiWhite = new THREE.Color("#ffffff");
  const papiRed = new THREE.Color("#ff2a2a");

  // Runway, slightly above the ground to avoid z-fighting.
  const runwayTex = runwayTexture(renderer.capabilities.getMaxAnisotropy());
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.east - RUNWAY.west, RUNWAY.width),
    new THREE.MeshLambertMaterial({ map: runwayTex, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set((RUNWAY.east + RUNWAY.west) / 2, FIELD + 0.5, 0);
  scene.add(runway);

  // Rings: magenta hoops, rebuilt whenever the level changes.
  type RingMesh = { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; glowMaterial: THREE.MeshBasicMaterial };
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  let ringMeshes: RingMesh[] = [];
  let builtLevel = -1;
  function buildRings(levelIndex: number) {
    ringGroup.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    ringGroup.clear();
    ringMeshes = LEVELS[levelIndex].course.rings.map((r) => {
      const tube = Math.max(5, r.radius * 0.07);
      const material = new THREE.MeshBasicMaterial({ color: MAGENTA.clone(), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r.radius, tube, 12, 72), material);
      mesh.position.set(r.x, r.y, r.z);
      mesh.lookAt(r.x + r.tx, r.y, r.z + r.tz);
      mesh.renderOrder = 2;
      // A faint, fatter copy reads as a glow.
      const glowMaterial = new THREE.MeshBasicMaterial({ color: MAGENTA.clone(), transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false });
      mesh.add(new THREE.Mesh(new THREE.TorusGeometry(r.radius, tube * 2.6, 10, 72), glowMaterial));
      ringGroup.add(mesh);
      return { mesh, material, glowMaterial };
    });
    builtLevel = levelIndex;
  }

  // The "land by" line: a bright bar across the runway with posts at the edges.
  const lineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff3b6b"), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6 });
  const landBy = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, RUNWAY.width + 40), lineMaterial);
  bar.rotation.x = -Math.PI / 2;
  bar.position.y = 1;
  landBy.add(bar);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 12), lineMaterial);
    post.position.set(0, 13, side * (RUNWAY.width / 2 + 28));
    landBy.add(post);
  }
  scene.add(landBy);

  function update(s: FlightState, view: { pitch: number; roll: number; camera: { x: number; y: number; z: number } }) {
    const d = Math.PI / 180;
    camera.position.set(view.camera.x, view.camera.y, view.camera.z);
    camera.rotation.set(view.pitch * d, -s.hdg * d, -view.roll * d);
    sky.position.copy(camera.position);

    // PAPI: white above each light's angle, red below.
    const dx = PAPI.x - view.camera.x;
    papi.forEach(({ sprite, material, angle }) => {
      sprite.visible = dx > 200;
      const glide = (Math.atan2(view.camera.y - (FIELD + 4), Math.max(dx, 1)) * 180) / Math.PI;
      material.color.copy(glide > angle ? papiWhite : papiRed);
    });

    if (s.levelIndex !== builtLevel) buildRings(s.levelIndex);
    landBy.position.set(THRESHOLD_X + LEVELS[s.levelIndex].landBy, FIELD, 0);

    ringMeshes.forEach(({ mesh, material, glowMaterial }, i) => {
      const r = s.rings[i];
      if (!r) return;
      const age = s.time - r.at;
      if (r.status === "pending") {
        // Show the next few rings, the nearest brightest.
        const ahead = i - s.nextRing;
        mesh.visible = ahead >= 0 && ahead < 4;
        material.color.copy(MAGENTA);
        material.opacity = ahead === 0 ? 0.95 : 0.8 - ahead * 0.15;
        glowMaterial.color.copy(MAGENTA);
        glowMaterial.opacity = ahead === 0 ? 0.24 : 0.1;
        mesh.scale.setScalar(1);
      } else {
        // Passed rings flash green and expand away; a missed one turns amber.
        const t = Math.min(1, age / 0.7);
        mesh.visible = r.status === "missed" || t < 1;
        material.color.copy(r.status === "passed" ? GREEN : AMBER);
        material.opacity = r.status === "missed" ? 0.95 : 0.95 * (1 - t);
        glowMaterial.color.copy(material.color);
        glowMaterial.opacity = r.status === "missed" ? 0.3 : 0.4 * (1 - t);
        mesh.scale.setScalar(r.status === "passed" ? 1 + t * 0.4 : 1);
      }
    });

    renderer.render(scene, camera);

    const next = LEVELS[s.levelIndex].course.rings[s.nextRing];
    if (!next || s.rings[s.nextRing]?.status !== "pending") return null;
    cue.set(next.x, next.y, next.z);
    camera.getWorldDirection(forward);
    const front = cue.clone().sub(camera.position).dot(forward) > 0;
    cue.project(camera);
    return { x: cue.x, y: cue.y, front };
  }
  const cue = new THREE.Vector3();
  const forward = new THREE.Vector3();

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
    detail.dispose();
    cloudTex.dispose();
    papiTex.dispose();
    cloudMat.dispose();
    papi.forEach(({ material }) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { update, resize, dispose };
}
