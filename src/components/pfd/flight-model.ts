// The flight model behind the PFD game: a run of ten landings.
//
// - Energy: airspeed comes from power, drag and flight path. Pull the nose
//   up and you trade speed for altitude until the wing stalls.
// - Angle of attack: the wing stalls at a fixed angle, so stall speed drops
//   with flaps and rises with bank, like the real thing.
// - Every level ends in a landing. Miss a ring, cross the "land by" line,
//   or break a limit and the run is over: back to level 1.
//
// Physics runs in fixed 1/120 s substeps and everything (including wind)
// is a pure function of the inputs, so a recorded run replays exactly.

import { closestS, pathAt, type Course } from "./course";
import { LEVEL_COUNT, LEVELS, windAt, type Level } from "./levels";
import { onRunway, RUNWAY, terrainHeight, THRESHOLD_X } from "./world";

export type Phase = "intro" | "ap" | "manual" | "rollout" | "failed" | "complete";
export type Tone = "green" | "amber" | "red" | "cyan" | "magenta";
export type RingState = { status: "pending" | "passed" | "missed"; at: number };
export type Failure = { title: string; tip: string };
export type LevelScore = {
  level: number;
  points: number;
  clear: number;
  rings: number;
  landing: number;
  touchdown: number;
  centerline: number;
  penalties: number;
  multiplier: number;
  distance: number; // touchdown point past the threshold, ft
  sink: number; // ft/min
  speed: number; // kt
  offset: number; // ft from the centerline
};
export type RunResult = {
  score: number;
  levelReached: number; // the level you were flying when the run ended
  cleared: number; // levels landed successfully
  complete: boolean; // all ten
  ranked: boolean; // hand-flown, no autopilot at any point
  newBest: boolean;
  levels: LevelScore[];
};

export type FlightState = {
  time: number; // real seconds
  simTime: number; // visuals only
  runTime: number; // sim seconds in this level (drives the wind)
  phase: Phase;
  phaseTime: number; // real seconds in this phase
  levelIndex: number;
  airborne: boolean;
  x: number;
  z: number;
  alt: number; // ft MSL
  pitch: number; // deg, nose up +
  roll: number; // deg, right wing down +
  pitchRate: number;
  rollRate: number;
  ias: number; // kt
  vs: number; // ft/min
  hdg: number; // deg
  aoa: number; // deg
  throttle: number; // 0..1, actual
  throttleCmd: number;
  flaps: number; // deg, actual
  flapsCmd: number;
  trimPitch: number; // where a centered stick holds the nose
  simSpeed: number;
  pathS: number;
  rollTarget: number;
  altSel: number;
  hdgSel: number;
  speedTrend: number;
  vfeTimer: number;
  rings: RingState[];
  nextRing: number;
  ringPoints: number;
  warnTime: number; // seconds of stall or flap-speed warning this level
  apUsed: boolean; // the autopilot flew part of this run
  runScore: number;
  levelScores: LevelScore[];
  toast: { text: string; tone: Tone; at: number } | null;
  failure: Failure | null;
  result: RunResult | null;
  best: number | null; // best ranked run score
  fade: number;
  fadingIn: boolean;
  resets: number;
};

export type Controls = {
  stick: { x: number; y: number } | null; // -1..1, null = hands off
  throttle: number; // -1, 0 or 1
  flaps: number; // -1, 0 or 1 (edge-triggered)
  retry: boolean;
  hold?: boolean; // keep the run-over card up (e.g. while entering a score)
};

// --- Airplane numbers (Cessna 172-ish) ------------------------------------------
export const FLAP_SETTINGS = [0, 10, 20, 30];
const VS_BY_FLAPS = [48, 46, 43, 40];
export const VFE_BY_FLAPS = [Infinity, 110, 85, 85];
const FLAP_DRAG = [1, 1.15, 1.45, 1.9];
export const VNE = 163;
export const VNO = 129;
const AOA_CRIT = 16;
const AOA_WARN = 13;
const INCIDENCE = 3;
const G_K = 19.07; // gravity in kt/s
const CD0 = 1.73e-4;
const CI = 3702;

export const SIM_SPEED_AP = 3;
export const SIM_SPEED_MANUAL = 2.2;
export const EYE_HEIGHT = 8;
const INTRO_SECONDS = 1.7;
const STEP = 1 / 120;
const deg = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const angleDiff = (to: number, from: number) => ((to - from + 540) % 360) - 180;

// Stick response curve: gentle near center for fine corrections, full
// authority at the edges.
export const stickCurve = (v: number) => 0.35 * v + 0.65 * v * v * v;
export function inverseStickCurve(target: number) {
  let v = target;
  for (let i = 0; i < 6; i++) v -= (stickCurve(v) - target) / (0.35 + 1.95 * v * v);
  return clamp(v, -1, 1);
}

function byFlaps(table: number[], flaps: number) {
  const i = clamp(flaps / 10, 0, 3);
  const lo = Math.floor(i);
  const hi = Math.min(3, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (i - lo);
}
const thrustMax = (v: number) => 4.6 - 0.018 * v;
const drag = (v: number, flaps: number) => CD0 * byFlaps(FLAP_DRAG, flaps) * v * v + CI / Math.max(v * v, 900);
export function stallSpeed(flaps: number, roll: number) {
  return byFlaps(VS_BY_FLAPS, flaps) / Math.sqrt(Math.max(Math.cos(roll * deg), 0.25));
}
const aoaFor = (v: number, flaps: number, roll: number) => AOA_CRIT * (stallSpeed(flaps, roll) / Math.max(v, 1)) ** 2;
export function vfeFor(flaps: number) {
  return flaps < 2 ? Infinity : VFE_BY_FLAPS[Math.min(3, Math.ceil(flaps / 10 - 0.05))];
}

export const levelOf = (s: FlightState): Level => LEVELS[s.levelIndex];
const courseOf = (s: FlightState): Course => LEVELS[s.levelIndex].course;

// --- Lifecycle -------------------------------------------------------------------
function blankState(): FlightState {
  return {
    time: 0, simTime: 0, runTime: 0, phase: "intro", phaseTime: 0, levelIndex: 0, airborne: true,
    x: 0, z: 0, alt: 0, pitch: 0, roll: 0, pitchRate: 0, rollRate: 0, ias: 0, vs: 0, hdg: 90, aoa: 0,
    throttle: 0, throttleCmd: 0, flaps: 0, flapsCmd: 0, trimPitch: 0, simSpeed: SIM_SPEED_AP,
    pathS: 0, rollTarget: 0, altSel: 0, hdgSel: 90, speedTrend: 0, vfeTimer: 0,
    rings: [], nextRing: 0, ringPoints: 0, warnTime: 0, apUsed: false, runScore: 0, levelScores: [],
    toast: null, failure: null, result: null, best: null, fade: 0, fadingIn: false, resets: 0,
  };
}

// Put the airplane at the start of a level: on the course, trimmed, at the
// level's approach speed and flap setting, so hands-off it holds the path.
function loadLevel(s: FlightState, index: number) {
  const level = LEVELS[index];
  const course = level.course;
  const a = course.path[0];
  const b = pathAt(course, 300);
  const track = ((Math.atan2(b.x - a.x, -(b.z - a.z)) / deg) % 360 + 360) % 360;
  const fpa = Math.atan2(b.agl - a.agl, Math.hypot(b.x - a.x, b.z - a.z)) / deg;
  const ias = level.startSpeed;
  const flaps = level.startFlaps;
  const aoa = aoaFor(ias, flaps, 0);
  const pitch = fpa + aoa - INCIDENCE;
  const throttle = clamp((drag(ias, flaps) + G_K * Math.sin(fpa * deg)) / thrustMax(ias), 0, 1);
  const alt = terrainHeight(a.x, a.z) + a.agl;
  // Start already crabbed into the wind, so the first seconds track the path
  // instead of drifting off it before you've had a chance to correct.
  const wind = windAt(level, 0);
  const cross = wind.vx * Math.cos(track * deg) + wind.vz * Math.sin(track * deg);
  const hdg = (((track + Math.asin(clamp(-cross / (ias * 1.68781), -0.5, 0.5)) / deg) % 360) + 360) % 360;
  Object.assign(s, {
    levelIndex: index, phase: "intro", phaseTime: 0, runTime: 0, airborne: true,
    x: a.x, z: a.z, alt, pitch, roll: 0, pitchRate: 0, rollRate: 0,
    ias, vs: ias * 101.27 * Math.sin(fpa * deg), hdg, aoa, throttle, throttleCmd: throttle,
    flaps, flapsCmd: flaps, trimPitch: pitch, pathS: 0, rollTarget: 0, altSel: Math.round(alt / 100) * 100,
    hdgSel: hdg, speedTrend: 0, vfeTimer: 0,
    rings: course.rings.map(() => ({ status: "pending" as const, at: 0 })), nextRing: 0, ringPoints: 0, warnTime: 0,
    failure: null,
  });
}

export function createRun(reduced = false): FlightState {
  const s = blankState();
  if (reduced) {
    // A still frame partway down a mid-level final.
    loadLevel(s, 3);
    const course = courseOf(s);
    const p = pathAt(course, course.thresholdS - 4000);
    Object.assign(s, { phase: "ap", x: p.x, z: p.z, alt: terrainHeight(p.x, p.z) + p.agl, hdg: 90, pathS: p.s, nextRing: 2 });
    return s;
  }
  loadLevel(s, 0);
  return s;
}

// Start partway into the game (practice and testing). These runs never
// count: the leaderboard replays every run from level 1.
export function createRunAt(levelIndex: number): FlightState {
  const s = blankState();
  loadLevel(s, clamp(levelIndex, 0, LEVEL_COUNT - 1));
  s.apUsed = levelIndex > 0;
  return s;
}

function setPhase(s: FlightState, phase: Phase) {
  if (s.phase !== phase) {
    s.phase = phase;
    s.phaseTime = 0;
  }
}

function toast(s: FlightState, text: string, tone: Tone) {
  s.toast = { text, tone, at: s.time };
}

function finishRun(s: FlightState, complete: boolean) {
  const ranked = !s.apUsed;
  const newBest = ranked && s.runScore > 0 && (s.best === null || s.runScore > s.best);
  if (newBest) s.best = s.runScore;
  s.result = {
    score: s.runScore,
    levelReached: s.levelIndex + 1,
    cleared: s.levelScores.length,
    complete,
    ranked,
    newBest,
    levels: s.levelScores,
  };
}

function fail(s: FlightState, title: string, tip: string) {
  s.failure = { title, tip };
  setPhase(s, "failed");
  finishRun(s, false);
}

// Back to level 1, right now.
export function restart(s: FlightState) {
  const keep = { time: s.time, simTime: s.simTime, resets: s.resets + 1, best: s.best };
  Object.assign(s, createRun(), keep, { fade: 1, fadingIn: true });
}

export function step(s: FlightState, dtReal: number, c: Controls) {
  s.time += dtReal;
  s.phaseTime += dtReal;

  if (c.flaps && s.phase === "manual") {
    s.flapsCmd = FLAP_SETTINGS[clamp(FLAP_SETTINGS.indexOf(s.flapsCmd) + c.flaps, 0, 3)];
  }

  if (s.phase === "intro") {
    // The level card is up; the airplane waits, trimmed, until it's gone.
    if (s.phaseTime >= INTRO_SECONDS) setPhase(s, c.stick ? "manual" : "ap");
  } else if (s.phase === "ap" || s.phase === "manual" || s.phase === "rollout") {
    const target = s.phase === "manual" ? SIM_SPEED_MANUAL : SIM_SPEED_AP;
    s.simSpeed += (target - s.simSpeed) * Math.min(1, 2 * dtReal);
    const dtSim = dtReal * s.simSpeed;
    const n = Math.min(60, Math.max(1, Math.ceil(dtSim / STEP)));
    for (let i = 0; i < n && (s.phase === "ap" || s.phase === "manual" || s.phase === "rollout"); i++) {
      physics(s, dtSim / n, dtReal / n, c);
    }
  }

  // Next level after a short rollout, with a quick dip to black.
  if (s.phase === "rollout") {
    s.fade = clamp((s.phaseTime - 1.3) / 0.3, 0, 1);
    if (s.phaseTime >= 1.6) {
      if (s.levelIndex + 1 >= LEVEL_COUNT) {
        setPhase(s, "complete");
        finishRun(s, true);
        s.fade = 0;
      } else {
        loadLevel(s, s.levelIndex + 1);
        s.fade = 1;
        s.fadingIn = true;
      }
    }
    return;
  }

  if (s.phase === "failed" || s.phase === "complete") {
    if (c.retry && s.phaseTime > 0.3) {
      restart(s);
    } else if (c.hold) {
      s.phaseTime = Math.min(s.phaseTime, 0.5);
      s.fade = 0;
    } else {
      const hold = s.phase === "complete" ? 6 : 3.4;
      s.fade = clamp((s.phaseTime - hold) / 0.35, 0, 1);
      if (s.fade >= 1) restart(s);
    }
    return;
  }

  if (s.fadingIn) {
    s.fade = Math.max(0, s.fade - dtReal / 0.4);
    if (s.fade === 0) s.fadingIn = false;
  }
}

function physics(s: FlightState, h: number, hReal: number, c: Controls) {
  const level = levelOf(s);
  const course = level.course;
  s.simTime += h;
  s.runTime += h;
  const agl = s.alt - terrainHeight(s.x, s.z);

  // --- Who's flying -------------------------------------------------------------
  if (c.stick && s.phase === "ap") setPhase(s, "manual");
  else if (!c.stick && s.phase === "manual") {
    setPhase(s, "ap");
    s.pathS = closestS(course, s.x, s.z).s;
  }
  if (s.phase === "ap") s.apUsed = true;

  let rollTarget = 0;
  let pitchTarget = s.pitch;
  if (s.phase === "rollout") {
    s.throttleCmd = 0;
    pitchTarget = 0;
  } else if (s.phase === "manual" && c.stick) {
    s.throttleCmd = clamp(s.throttleCmd + c.throttle * 0.7 * hReal, 0, 1);
    pitchTarget = s.trimPitch - stickCurve(c.stick.y) * 16;
    rollTarget = stickCurve(c.stick.x) * 40;
  } else if (s.phase === "ap") {
    pitchTarget = autopilot(s, agl);
    rollTarget = s.rollTarget;
  }

  // --- Attitude: a critically damped spring, so it eases in and out ------------
  const manual = s.phase === "manual";
  const wRoll = manual || agl < 60 ? 3.0 : 1.9;
  const wPitch = manual ? 2.6 : 1.7;
  s.rollRate += (wRoll * wRoll * (rollTarget - s.roll) - 2 * wRoll * s.rollRate) * h;
  s.pitchRate += (wPitch * wPitch * (pitchTarget - s.pitch) - 2 * wPitch * s.pitchRate) * h;
  s.throttle += clamp(s.throttleCmd - s.throttle, -1.5 * h, 1.5 * h);
  s.flaps += clamp(s.flapsCmd - s.flaps, -3.5 * h, 3.5 * h);

  // Gusts push on the airplane's rotation; you have to keep correcting.
  const wind = windAt(level, s.runTime);
  if (s.airborne) {
    const t = s.runTime;
    // Bumps build over the first few seconds instead of hitting at load-in.
    const gust = (wind.speed / 14) * Math.min(1, t / 6);
    s.rollRate += gust * (9 * Math.sin(t * 1.31) + 6 * Math.sin(t * 2.37 + 2.1)) * h;
    s.pitchRate += gust * (2.6 * Math.sin(t * 1.07 + 1.1) + 1.6 * Math.sin(t * 2.11)) * h;
  }
  s.roll += s.rollRate * h;
  s.pitch += s.pitchRate * h;
  s.aoa = aoaFor(s.ias, s.flaps, s.airborne ? s.roll : 0);

  // --- Energy -------------------------------------------------------------------
  const prevIas = s.ias;
  let fpa = 0;
  if (s.airborne) {
    fpa = clamp(s.pitch - (s.aoa - INCIDENCE), -25, 25);
    s.ias = Math.max(0, s.ias + (s.throttle * thrustMax(s.ias) - drag(s.ias, s.flaps) - G_K * Math.sin(fpa * deg)) * h);
  } else {
    s.ias = Math.max(0, s.ias + (s.throttle * thrustMax(s.ias) - CD0 * s.ias * s.ias - 0.35 - 5) * h);
  }
  s.vs = s.ias * 101.27 * Math.sin(fpa * deg);
  s.alt += (s.vs / 60) * h;

  if (s.airborne) {
    s.hdg += ((1091 * Math.tan(s.roll * deg)) / Math.max(s.ias, 40)) * h;
  } else {
    s.roll += -s.roll * Math.min(1, 3 * h);
    s.rollRate = 0;
    s.hdg += angleDiff(RUNWAY.heading, s.hdg) * Math.min(1, 0.8 * h);
  }
  s.hdg = ((s.hdg % 360) + 360) % 360;

  const ring = course.rings[s.nextRing];
  const alongBefore = ring ? (s.x - ring.x) * ring.tx + (s.z - ring.z) * ring.tz : 0;
  const tas = s.ias * 1.68781 * Math.cos(fpa * deg);
  const drift = s.airborne ? 1 : 0; // wheels on the ground don't drift
  s.x += (Math.sin(s.hdg * deg) * tas + wind.vx * drift) * h;
  s.z += (-Math.cos(s.hdg * deg) * tas + wind.vz * drift) * h;
  const trend = h > 0 ? ((s.ias - prevIas) / h) * 6 : 0;
  s.speedTrend += (trend - s.speedTrend) * Math.min(1, 3 * h);

  if (!s.airborne) {
    s.alt = terrainHeight(s.x, s.z);
    return;
  }

  // --- Limits -----------------------------------------------------------------
  if (s.aoa >= AOA_WARN || s.ias > vfeFor(s.flaps)) s.warnTime += hReal;
  if (s.aoa >= AOA_CRIT) {
    return fail(s, "STALL", "Too slow for the wing to fly. Lower the nose and add power the moment the STALL warning shows.");
  }
  if (s.ias > VNE) {
    return fail(s, "OVERSPEED", "Past the red line (163 kt). Ease the nose up and pull the power back in a dive.");
  }
  if (s.ias > vfeFor(s.flaps)) {
    s.vfeTimer += hReal;
    if (s.vfeTimer > 1.5) {
      return fail(s, "FLAP OVERSPEED", `Flaps ${Math.round(s.flapsCmd)} max is ${vfeFor(s.flaps)} kt. Slow down before you put them out.`);
    }
  } else {
    s.vfeTimer = Math.max(0, s.vfeTimer - hReal);
  }

  // --- Rings --------------------------------------------------------------------
  s.pathS = closestS(course, s.x, s.z, s.pathS).s;
  if (ring) {
    const rx = s.x - ring.x;
    const rz = s.z - ring.z;
    const along = rx * ring.tx + rz * ring.tz;
    const crossed = along >= 0 && alongBefore < 0 && Math.hypot(rx, rz) < 1500;
    if (crossed) {
      const lateral = -rx * ring.tz + rz * ring.tx;
      const miss = Math.hypot(lateral, s.alt - ring.y);
      if (miss > ring.radius) {
        s.rings[s.nextRing] = { status: "missed", at: s.time };
        return fail(s, "MISSED THE RING", "Fly through every ring. Small corrections early beat big ones late, and crab into the wind.");
      }
      const points = 50 + Math.round(50 * (1 - miss / ring.radius));
      s.ringPoints += points;
      s.rings[s.nextRing] = { status: "passed", at: s.time };
      s.nextRing++;
      toast(s, `RING ${s.nextRing}/${course.rings.length}  +${points}`, "green");
    } else if (s.pathS > ring.s + 900) {
      s.rings[s.nextRing] = { status: "missed", at: s.time };
      return fail(s, "MISSED THE RING", "Fly through every ring. Small corrections early beat big ones late, and crab into the wind.");
    }
  }

  // --- Touchdown ------------------------------------------------------------------
  const ground = terrainHeight(s.x, s.z);
  if (s.alt > ground) return;
  s.alt = ground;
  if (s.vs >= 0) return;

  if (!onRunway(s.x, s.z)) {
    if (s.x < RUNWAY.west && s.x > RUNWAY.west - 8000 && Math.abs(s.z) < 700) {
      return fail(s, "LANDED SHORT", "The runway starts at the piano keys. Aim just past them, never before.");
    }
    if (s.x >= RUNWAY.west && s.x <= RUNWAY.east && Math.abs(s.z) < 600) {
      return fail(s, "OFF THE RUNWAY", "Line up with the centerline early on final and crab to stay on it.");
    }
    return fail(s, "TERRAIN", "Watch your altitude. When PULL UP shows, add full power and climb now.");
  }
  const distance = Math.max(0, Math.round(s.x - THRESHOLD_X));
  if (s.nextRing < course.rings.length) {
    return fail(s, "MISSED THE RING", "Every ring counts, including the last one on short final.");
  }
  if (distance > level.landBy) {
    return fail(s, "LONG LANDING", `You touched down ${distance.toLocaleString()} ft in; the line was at ${level.landBy.toLocaleString()}. Slow down on final and don't float.`);
  }
  if (s.ias > level.maxSpeed) {
    return fail(s, "TOO FAST", `${Math.round(s.ias)} kt at touchdown; this level allows ${level.maxSpeed}. Use full flaps and let it slow in the flare.`);
  }
  if (s.vs < level.maxSink) {
    return fail(s, "HARD LANDING", `${Math.round(s.vs)} ft/min. Ease the nose up just above the runway to soften it.`);
  }
  if (Math.abs(s.roll) > level.maxBank) {
    return fail(s, "WINGTIP STRIKE", "Level the wings before touchdown. In a crosswind, keep the upwind wing just slightly low.");
  }
  if (s.pitch < -0.5) {
    return fail(s, "NOSEWHEEL FIRST", "Hold the nose up in the flare so the main wheels touch first.");
  }

  // Landed it.
  const sink = Math.round(s.vs);
  const offset = Math.round(Math.abs(s.z));
  const n = level.number;
  const multiplier = 1 + 0.2 * (n - 1);
  const parts = {
    clear: 100 * n,
    rings: s.ringPoints,
    landing: Math.round(Math.max(0, 1 - distance / level.landBy) * 400),
    touchdown: Math.round(Math.max(0, 1 - sink / level.maxSink) * 200),
    centerline: Math.round(Math.max(0, 200 - offset * 4)),
    penalties: -Math.round(s.warnTime * 100),
  };
  const points = Math.max(0, Math.round(Object.values(parts).reduce((a, b) => a + b, 0) * multiplier));
  s.levelScores = [...s.levelScores, { level: n, points, ...parts, multiplier, distance, sink, speed: Math.round(s.ias), offset }];
  s.runScore += points;
  toast(s, `LEVEL ${n} CLEAR  +${points.toLocaleString()}`, "green");
  s.airborne = false;
  s.vs = 0;
  setPhase(s, "rollout");
}

// Autopilot: pure-pursuit lateral guidance that crabs into the wind, a
// flight-path command it can actually fly, an autothrottle, and flaps on
// schedule. It flies the demo; using it means the run isn't ranked.
function autopilot(s: FlightState, agl: number) {
  const level = levelOf(s);
  const course = level.course;
  const here = pathAt(course, s.pathS);
  const look = pathAt(course, s.pathS + clamp(s.ias * 1.688 * 3, 600, 1500));
  const dx = look.x - s.x;
  const dz = look.z - s.z;
  const track = Math.atan2(dx, -dz) / deg;
  const wind = windAt(level, s.runTime);
  const tas = Math.max(s.ias * 1.68781, 1);
  const cross = wind.vx * Math.cos(track * deg) + wind.vz * Math.sin(track * deg);
  const wca = Math.asin(clamp(-cross / tas, -0.5, 0.5)) / deg;
  const desiredHdg = (((track + wca) % 360) + 360) % 360;
  // Close to the ground: wings nearly level, only small corrections.
  const bankLimit = agl < 60 ? 4 : 30;
  s.rollTarget = clamp(angleDiff(desiredHdg, s.hdg) * 1.6, -bankLimit, bankLimit);
  s.hdgSel = desiredHdg;

  const targetAlt = terrainHeight(look.x, look.z) + look.agl;
  s.altSel = Math.round(targetAlt / 100) * 100;
  let speed = here.speed;
  let fpa = clamp(Math.atan2(targetAlt - s.alt, Math.hypot(dx, dz)) / deg, -6, 6);
  const available = Math.asin(clamp((thrustMax(s.ias) - drag(s.ias, s.flaps)) / G_K, -1, 1)) / deg - 0.7;
  fpa = Math.min(fpa, available);
  if (s.ias < speed - 4 && fpa > 0) fpa = Math.max(0, fpa - (speed - 4 - s.ias) * 0.25);

  // Flare over the runway: power to idle, shallow the descent, settle on.
  const short = s.nextRing >= course.rings.length;
  const flare = short && agl < 8 && Math.abs(s.z) < 200 && s.x > RUNWAY.west - 1000;
  if (flare) {
    fpa = s.aoa > 11 ? -2.6 : -1.8;
    speed = 0;
  }
  const thrustNeeded = drag(s.ias, s.flaps) + G_K * Math.sin(fpa * deg) + 0.8 * (speed - s.ias);
  s.throttleCmd = flare ? 0 : clamp(thrustNeeded / thrustMax(s.ias), 0, 1);

  // Flaps: 10 on downwind, 20 on base, 30 within about a mile and a half.
  const toGo = course.thresholdS - s.pathS;
  const want = toGo < 7000 ? 30 : toGo < 11000 ? 20 : 10;
  if (want > s.flapsCmd && s.ias < VFE_BY_FLAPS[FLAP_SETTINGS.indexOf(want)] - 5) s.flapsCmd = want;

  return clamp(fpa + s.aoa - INCIDENCE, -10, 15);
}

export function readouts(s: FlightState) {
  const level = levelOf(s);
  const flying = s.airborne && (s.phase === "ap" || s.phase === "manual");
  const chop = flying ? 1 : 0;
  const t = s.simTime;
  const pitch = s.pitch + chop * (0.12 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 2.3));
  const roll = s.roll + chop * (0.2 * Math.sin(t * 0.7 + 1) + 0.08 * Math.sin(t * 1.9));
  const fpa = Math.asin(clamp(s.vs / (Math.max(s.ias, 1) * 101.27), -1, 1)) / deg;
  const vsRounded = Math.round(s.vs / 50) * 50;
  const hdg = Math.round(s.hdg) % 360;
  const agl = s.alt - terrainHeight(s.x, s.z);
  const aligned = Math.abs(s.z) < 700 && s.x < RUNWAY.east && Math.abs(angleDiff(s.hdg, RUNWAY.heading)) < 35;
  const wind = windAt(level, s.runTime);

  return {
    pitch,
    roll,
    fpa: s.ias < 20 ? 0 : fpa,
    drift: clamp(s.roll * 0.4, -12, 12),
    speedTrend: clamp(s.speedTrend, -30, 30),
    altTrend: (s.vs / 60) * 6,
    iasText: s.ias < 20 ? "---" : String(Math.round(s.ias)),
    altText: String(Math.round(s.alt / 10) * 10),
    hdgText: String(hdg === 0 ? 360 : hdg).padStart(3, "0"),
    vsText: Math.abs(vsRounded) >= 100 ? `${vsRounded > 0 ? "+" : ""}${vsRounded}` : "",
    ringsText: `${s.nextRing}/${level.course.rings.length}`,
    windSpeed: Math.round(wind.speed),
    windFrom: Math.round(wind.from),
    // Arrow direction on screen: where the wind is blowing, relative to the nose.
    windArrow: angleDiff(wind.from + 180, s.hdg),
    stallSpeed: stallSpeed(s.flaps, s.airborne ? s.roll : 0),
    stallWarning: flying && s.aoa >= AOA_WARN,
    vfeWarning: flying && s.ias > vfeFor(s.flaps) - 3 && s.flaps > 2,
    overspeedWarning: flying && s.ias > VNO + 20,
    terrainWarning: flying && ((s.vs < -1200 && agl < 1500) || (agl < 300 && s.vs < -500 && !aligned)),
    camera: { x: s.x, y: s.alt + EYE_HEIGHT, z: s.z },
  };
}

export function modeLabel(s: FlightState) {
  if (s.phase === "intro") return `LEVEL ${s.levelIndex + 1}`;
  if (s.phase === "ap") return "AP · PATH";
  if (s.phase === "manual") return "YOUR AIRPLANE";
  if (s.phase === "rollout") return "ROLLOUT";
  if (s.phase === "complete") return "RUN COMPLETE";
  return s.failure?.title ?? "RUN OVER";
}
