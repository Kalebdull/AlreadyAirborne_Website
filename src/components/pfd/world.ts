// The world the PFD flies through: terrain, the runway and its PAPI. Plain
// math, no rendering, so the flight model and the 3D scene share one source
// of truth. The course you fly (rings, wind) is per level: see levels.ts.
//
// Units are feet. +x is east, -z is north (Three.js camera convention), and
// heading is degrees clockwise from north.

export const FIELD = 0; // field elevation, ft MSL (sea level, so the altimeter reads height above the runway)

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

// The landing threshold for runway 9 (the piano keys at the west end).
export const THRESHOLD_X = RUNWAY.west;

// PAPI: four lights left of the runway at the aim point (500 ft in). Each shows
// white above its angle and red below; two white and two red is on glidepath.
export const PAPI = { x: THRESHOLD_X + 500, z: -(RUNWAY.width / 2 + 60), spacing: 30, angles: [2.5, 2.83, 3.17, 3.5] };

export function onRunway(x: number, z: number) {
  return x > RUNWAY.west && x < RUNWAY.east && Math.abs(z) < RUNWAY.width / 2 + 25;
}
