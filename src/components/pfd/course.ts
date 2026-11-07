// A course: a smooth path through waypoints (Catmull-Rom), with rings
// placed along it. Plain math, shared by the flight model, the autopilot and
// the 3D scene. Units are feet; +x east, -z north.

export type PathPoint = { x: number; z: number; agl: number; speed: number; s: number };
export type Ring = { s: number; x: number; y: number; z: number; tx: number; tz: number; radius: number };
export type Course = { path: PathPoint[]; length: number; rings: Ring[]; thresholdS: number };

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// waypoints: [x, z, height above field]; the path's airspeed eases from
// `startSpeed` down to `finalSpeed` over the last 9,000 ft before `thresholdX`.
export function buildCourse(opts: {
  waypoints: [number, number, number][];
  field: number;
  thresholdX: number;
  startSpeed: number;
  finalSpeed: number;
  rings: number;
  ringRadius: number;
}): Course {
  const w = opts.waypoints;
  const path: PathPoint[] = [];
  const SUB = 40;
  for (let i = 0; i < w.length - 1; i++) {
    const p0 = w[Math.max(0, i - 1)];
    const p1 = w[i];
    const p2 = w[i + 1];
    const p3 = w[Math.min(w.length - 1, i + 2)];
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB;
      path.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        z: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        agl: Math.max(0, catmullRom(p0[2], p1[2], p2[2], p3[2], t)),
        speed: 0,
        s: 0,
      });
    }
  }
  const last = w[w.length - 1];
  path.push({ x: last[0], z: last[1], agl: last[2], speed: 0, s: 0 });
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    b.s = a.s + Math.hypot(b.x - a.x, b.z - a.z, b.agl - a.agl);
  }
  const length = path[path.length - 1].s;

  // Where the path crosses the threshold.
  let thresholdS = length;
  for (const p of path) {
    if (p.x >= opts.thresholdX && Math.abs(p.z) < 300) {
      thresholdS = p.s;
      break;
    }
  }
  for (const p of path) {
    const remaining = Math.max(0, thresholdS - p.s);
    p.speed = p.s > thresholdS ? 30 : opts.finalSpeed + Math.min(1, remaining / 9000) * (opts.startSpeed - opts.finalSpeed);
  }

  const course: Course = { path, length, rings: [], thresholdS };
  const first = 700;
  const lastRing = thresholdS - 350;
  for (let i = 0; i < opts.rings; i++) {
    const s = opts.rings === 1 ? lastRing : first + ((lastRing - first) * i) / (opts.rings - 1);
    const p = pathAt(course, s);
    const a = pathAt(course, s - 60);
    const b = pathAt(course, s + 60);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    course.rings.push({ s, x: p.x, y: opts.field + p.agl, z: p.z, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len, radius: opts.ringRadius });
  }
  return course;
}

export function pathAt(course: Course, s: number): PathPoint {
  const { path, length } = course;
  const clamped = Math.max(0, Math.min(length, s));
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].s <= clamped) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
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
// window ahead of where we were, so crossing legs never confuse it.
export function closestS(course: Course, x: number, z: number, hint?: number) {
  let best = 0;
  let bestD = Infinity;
  for (const p of course.path) {
    if (hint !== undefined && (p.s < hint - 600 || p.s > hint + 4000)) continue;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p.s;
    }
  }
  return { s: best, distance: Math.sqrt(bestD) };
}
