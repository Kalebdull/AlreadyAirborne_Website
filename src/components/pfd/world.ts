// The world the PFD flies through: terrain, runway, and a left-hand traffic
// pattern for runway 09 drawn as a pathway of gates. Plain math, no
// rendering, so the flight model and the 3D scene share one source of truth.
//
// Units are feet. +x is east, -z is north (Three.js camera convention), and
// heading is degrees clockwise from north.

export const FIELD = 820; // field elevation, ft MSL

export const RUNWAY = {
  west: -2600,
  east: 2600,
  width: 150,
  heading: 90,
};

// --- Terrain ----------------------------------------------------------------

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Distance from a point to the runway rectangle (0 on the runway).
function runwayDistance(x: number, z: number) {
  const dx = Math.max(RUNWAY.west - x, 0, x - RUNWAY.east);
  const dz = Math.max(Math.abs(z) - RUNWAY.width / 2, 0);
  return Math.hypot(dx, dz);
}

// A flat valley around the airport, gentle farmland, and a ring of
// mountains well outside the pattern.
export function terrainHeight(x: number, z: number) {
  const cx = x + 1500;
  const cz = z + 2400;
  const d = Math.hypot(cx, cz);
  const mountainMask = smoothstep(15000, 42000, d);
  const ridge = 1 - Math.abs(fbm(x / 14000 + 3.1, z / 14000 - 1.7, 5) * 2 - 1);
  const mountains = mountainMask * ridge * ridge * 6200;
  // Exactly field elevation near the runway and along the extended
  // centerline (the approach and departure corridors), rolling farther out.
  const corridor = x > -10000 && x < 8000 ? Math.abs(z) : Infinity;
  const nearAirport = Math.min(smoothstep(1200, 4000, runwayDistance(x, z)), smoothstep(700, 2600, corridor));
  const rolling = Math.max(0, (fbm(x / 5200, z / 5200, 4) - 0.5) * 180 + 40) * nearAirport;
  return FIELD + rolling * (1 - mountainMask * 0.5) + mountains;
}

// --- Traffic pattern path -----------------------------------------------------

// [x, z, height above field, target airspeed]
const WAYPOINTS: [number, number, number, number][] = [
  [-1500, 0, 0, 60],
  [0, 0, 100, 68],
  [3000, 0, 340, 72], // upwind: a 172 climbs at about 4–5°
  [5200, -1800, 580, 78], // crosswind
  [3500, -4300, 800, 90], // turning downwind
  [-1000, -4600, 800, 85], // downwind, abeam the numbers
  [-6000, -4300, 750, 78],
  [-8200, -2200, 560, 72], // base
  [-6600, -150, 290, 66], // turning final, on a ~3° glidepath to the PAPI
  [-2500, 0, 45, 62], // over the threshold
  [-1200, 0, 0, 55], // touchdown zone
  [2200, 0, 0, 30], // rollout
]

export type PathPoint = { x: number; z: number; agl: number; speed: number; s: number };

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function buildPath(): PathPoint[] {
  const pts: PathPoint[] = [];
  const n = WAYPOINTS.length;
  const SUB = 40;
  for (let i = 0; i < n - 1; i++) {
    const p0 = WAYPOINTS[Math.max(0, i - 1)];
    const p1 = WAYPOINTS[i];
    const p2 = WAYPOINTS[i + 1];
    const p3 = WAYPOINTS[Math.min(n - 1, i + 2)];
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB;
      pts.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        z: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        agl: Math.max(0, catmullRom(p0[2], p1[2], p2[2], p3[2], t)),
        speed: p1[3] + (p2[3] - p1[3]) * t,
        s: 0,
      });
    }
  }
  const last = WAYPOINTS[n - 1];
  pts.push({ x: last[0], z: last[1], agl: last[2], speed: last[3], s: 0 });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    b.s = a.s + Math.hypot(b.x - a.x, b.z - a.z, b.agl - a.agl);
  }
  return pts;
}

export const PATH = buildPath();
export const PATH_LENGTH = PATH[PATH.length - 1].s;

export function pathAt(s: number): PathPoint {
  const clamped = Math.max(0, Math.min(PATH_LENGTH, s));
  let lo = 0;
  let hi = PATH.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (PATH[mid].s <= clamped) lo = mid;
    else hi = mid;
  }
  const a = PATH[lo];
  const b = PATH[hi];
  const t = b.s === a.s ? 0 : (clamped - a.s) / (b.s - a.s);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    agl: a.agl + (b.agl - a.agl) * t,
    speed: a.speed + (b.speed - a.speed) * t,
    s: clamped,
  };
}

// Closest point on the path (horizontally). With a hint, only searches a
// window ahead of where we were, so the pattern's crossing legs never
// confuse it; without one it searches everything.
export function closestS(x: number, z: number, hint?: number) {
  let best = 0;
  let bestD = Infinity;
  for (const p of PATH) {
    if (hint !== undefined && (p.s < hint - 600 || p.s > hint + 4000)) continue;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p.s;
    }
  }
  return { s: best, distance: Math.sqrt(bestD) };
}

// --- Gates --------------------------------------------------------------------

export const GATE_W = 380;
export const GATE_H = 260;

export type Gate = { s: number; x: number; y: number; z: number; tx: number; tz: number };

function buildGates(): Gate[] {
  const gates: Gate[] = [];
  const start = 1900; // first gate once safely airborne
  const end = closestS(-2700, 0).s; // last gate just before the threshold
  const count = 12;
  for (let i = 0; i < count; i++) {
    const s = start + ((end - start) * i) / (count - 1);
    const p = pathAt(s);
    const a = pathAt(s - 60);
    const b = pathAt(s + 60);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    gates.push({ s, x: p.x, y: FIELD + p.agl, z: p.z, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len });
  }
  return gates;
}

export const GATES = buildGates();

// The landing threshold for runway 9 (the piano keys at the west end).
export const THRESHOLD_X = RUNWAY.west;

// PAPI: four lights left of the runway at the aiming point. Each shows
// white above its angle and red below; two white and two red is on glidepath.
export const PAPI = { x: THRESHOLD_X + 1100, z: -(RUNWAY.width / 2 + 60), spacing: 30, angles: [2.5, 2.83, 3.17, 3.5] };

export function onRunway(x: number, z: number) {
  return x > RUNWAY.west && x < RUNWAY.east && Math.abs(z) < RUNWAY.width / 2 + 25;
}
