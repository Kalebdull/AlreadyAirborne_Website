// The flight model behind the PFD game. Simple, but honest where it
// matters for learning to fly:
//
// - Energy: airspeed comes from power, drag and climb angle. Pull the nose
//   up and you trade speed for altitude until the wing stalls.
// - Angle of attack: the wing stalls at a fixed angle, so stall speed goes
//   down with flaps and up with bank (load factor), like the real thing.
// - Limits: stall, Vne, flap speeds and touchdown limits all end the run,
//   each with a CFI tip.
//
// Physics runs in fixed 1/120 s substeps so it behaves identically at any
// frame rate and never jumps after a slow frame.

import { closestS, FIELD, GATE_H, GATE_W, GATES, onRunway, pathAt, RUNWAY, terrainHeight, THRESHOLD_X, windAt } from "./world";

export type Phase = "ap" | "manual" | "rollout" | "landed" | "failed";
export type Tone = "green" | "amber" | "red" | "cyan" | "magenta";
export type GateState = { status: "pending" | "passed" | "missed"; at: number };
export type Failure = { title: string; tip: string };
export type Breakdown = {
  gates: number;
  landing: number;
  touchdown: number;
  centerline: number;
  time: number;
  penalties: number;
};
export type Result = {
  score: number;
  breakdown: Breakdown;
  distance: number; // touchdown point past the threshold, ft
  sink: number; // ft/min at touchdown
  speed: number; // kt at touchdown
  offset: number; // ft from the centerline at touchdown
  gates: number;
  runTime: number; // sim seconds from brake release to touchdown
  rank: string;
  ranked: boolean; // hand-flown the whole way, from the takeoff roll
  newBest: boolean;
};

export type FlightState = {
  time: number; // real seconds
  simTime: number; // for visuals only; carries across runs
  runTime: number; // sim seconds since this run started (drives wind)
  phase: Phase;
  phaseTime: number; // real seconds in this phase
  airborne: boolean;
  x: number;
  z: number;
  alt: number; // ft MSL
  pitch: number; // deg, nose up +
  roll: number; // deg, right wing down +
  ias: number; // kt
  vs: number; // ft/min
  hdg: number; // deg
  aoa: number; // deg
  throttle: number; // 0..1, actual
  throttleCmd: number;
  flaps: number; // deg, actual
  flapsCmd: number; // 0 | 10 | 20 | 30
  simSpeed: number;
  pathS: number;
  rollTarget: number;
  altSel: number;
  hdgSel: number;
  speedTrend: number;
  vfeTimer: number;
  gates: GateState[];
  nextGate: number;
  passed: number;
  apUsed: boolean; // the autopilot flew part of this run
  gatePoints: number;
  stallWarnTime: number;
  flapWarnTime: number;
  toast: { text: string; tone: Tone; at: number } | null;
  failure: Failure | null;
  result: Result | null;
  best: number | null; // best ranked score
  fade: number;
  fadingIn: boolean;
  resets: number;
};

export type Controls = {
  stick: { x: number; y: number } | null; // -1..1, null = hands off
  throttle: number; // -1, 0 or 1: power down / hold / up
  flaps: number; // -1, 0 or 1: one notch up / down (edge-triggered)
  retry: boolean;
  hold?: boolean; // keep the result up (e.g. while entering a leaderboard score)
};

// --- Airplane numbers (Cessna 172-ish) ------------------------------------------
export const FLAP_SETTINGS = [0, 10, 20, 30];
const VS_BY_FLAPS = [48, 46, 43, 40]; // stall speed, wings level
export const VFE_BY_FLAPS = [Infinity, 110, 85, 85]; // max flap extended speed
const FLAP_DRAG = [1, 1.15, 1.45, 1.9];
export const VNE = 163;
export const VNO = 129;
export const MAX_TOUCHDOWN_KT = 65;
export const MAX_TOUCHDOWN_SINK = -500;
export const MAX_TOUCHDOWN_BANK = 6;
const AOA_CRIT = 16; // wing stalls here
const AOA_WARN = 13; // stall horn
const INCIDENCE = 3; // wing incidence: body pitch = flight path + AoA - 3°
const G_K = 19.07; // gravity in kt/s
const CD0 = 1.73e-4;
const CI = 3702;

export const SIM_SPEED_AP = 3.5; // demo: a whole pattern in about a minute
export const SIM_SPEED_MANUAL = 2.2; // hand-flying: more time to react
export const EYE_HEIGHT = 8;

const STEP = 1 / 120;
const deg = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const angleDiff = (to: number, from: number) => ((to - from + 540) % 360) - 180;

function byFlaps(table: number[], flaps: number) {
  const i = clamp(flaps / 10, 0, 3);
  const lo = Math.floor(i);
  const hi = Math.min(3, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (i - lo);
}

const thrustMax = (v: number) => 4.6 - 0.018 * v; // kt/s at full power
const drag = (v: number, flaps: number) => CD0 * byFlaps(FLAP_DRAG, flaps) * v * v + CI / Math.max(v * v, 900);

export function stallSpeed(flaps: number, roll: number) {
  return byFlaps(VS_BY_FLAPS, flaps) / Math.sqrt(Math.max(Math.cos(roll * deg), 0.25));
}

function aoaFor(v: number, flaps: number, roll: number) {
  return AOA_CRIT * (stallSpeed(flaps, roll) / Math.max(v, 1)) ** 2;
}

export function vfeFor(flaps: number) {
  return flaps < 2 ? Infinity : VFE_BY_FLAPS[Math.min(3, Math.ceil(flaps / 10 - 0.05))];
}

// --- Ranking ---------------------------------------------------------------------
export const RANKS: [number, string][] = [
  [150, "ON THE NUMBERS"],
  [400, "ACE"],
  [800, "CHECKRIDE READY"],
  [1500, "SOLID"],
  [2500, "STUDENT PILOT"],
  [Infinity, "FLOATED IT"],
];
const rankFor = (distance: number) => RANKS.find(([max]) => distance <= max)![1];

// --- Lifecycle -------------------------------------------------------------------
export function createFlight(reduced = false): FlightState {
  const s: FlightState = {
    time: 0,
    simTime: 0,
    runTime: 0,
    phase: "ap",
    phaseTime: 0,
    airborne: false,
    x: RUNWAY.west + 300,
    z: 0,
    alt: FIELD,
    pitch: 0,
    roll: 0,
    ias: 0,
    vs: 0,
    hdg: 90,
    aoa: 0,
    throttle: 1,
    throttleCmd: 1,
    flaps: 0,
    flapsCmd: 0,
    simSpeed: SIM_SPEED_AP,
    pathS: 0,
    rollTarget: 0,
    altSel: FIELD + 800,
    hdgSel: 90,
    speedTrend: 0,
    vfeTimer: 0,
    gates: GATES.map(() => ({ status: "pending" as const, at: 0 })),
    nextGate: 0,
    passed: 0,
    apUsed: false,
    gatePoints: 0,
    stallWarnTime: 0,
    flapWarnTime: 0,
    toast: null,
    failure: null,
    result: null,
    best: null,
    fade: 0,
    fadingIn: false,
    resets: 0,
  };
  if (reduced) {
    // A still frame on downwind, with the pathway visible ahead.
    const p = pathAt(closestS(-1000, -4600).s);
    Object.assign(s, { airborne: true, x: p.x, z: p.z, alt: FIELD + p.agl, hdg: 270, ias: 85, pitch: 2, throttle: 0.6, pathS: p.s, nextGate: 5 });
  }
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

function fail(s: FlightState, title: string, tip: string) {
  s.failure = { title, tip };
  setPhase(s, "failed");
}

function reset(s: FlightState) {
  const keep = { time: s.time, simTime: s.simTime, resets: s.resets + 1, best: s.best };
  Object.assign(s, createFlight(), keep, { fade: 1, fadingIn: true });
}

export function step(s: FlightState, dtReal: number, c: Controls) {
  s.time += dtReal;
  s.phaseTime += dtReal;

  // Flaps move one notch per press, only when you're flying.
  if (c.flaps && s.phase === "manual") {
    const i = clamp(FLAP_SETTINGS.indexOf(s.flapsCmd) + c.flaps, 0, 3);
    s.flapsCmd = FLAP_SETTINGS[i];
  }

  // Ease the sim speed between demo pace and hand-flying pace.
  const targetSpeed = s.phase === "manual" ? SIM_SPEED_MANUAL : SIM_SPEED_AP;
  s.simSpeed += (targetSpeed - s.simSpeed) * Math.min(1, 2 * dtReal);

  const dtSim = dtReal * s.simSpeed;
  const n = Math.min(60, Math.max(1, Math.ceil(dtSim / STEP)));
  for (let i = 0; i < n && s.phase !== "failed" && s.phase !== "landed"; i++) physics(s, dtSim / n, dtReal / n, c);

  // Outcomes and resets run on real time.
  if (s.fadingIn) {
    s.fade = Math.max(0, 1 - s.phaseTime / 0.45);
    if (s.fade === 0) s.fadingIn = false;
  } else if (c.retry && s.phaseTime > 0.3 && (s.phase === "failed" || s.phase === "landed" || s.phase === "rollout")) {
    // Fly again: straight back to the runway.
    reset(s);
  } else if (c.hold && (s.phase === "failed" || s.phase === "landed" || s.phase === "rollout")) {
    s.phaseTime = Math.min(s.phaseTime, 0.5);
    s.fade = 0;
  } else if (s.phase === "failed" || s.phase === "landed") {
    const hold = s.phase === "landed" ? 4.5 : 3.2;
    s.fade = clamp((s.phaseTime - hold) / 0.35, 0, 1);
    if (s.fade >= 1) reset(s);
  } else {
    s.fade = 0;
  }
}

function physics(s: FlightState, h: number, hReal: number, c: Controls) {
  s.simTime += h;
  s.runTime += h;
  const ground = terrainHeight(s.x, s.z);
  const agl = s.alt - ground;

  // --- Who's flying -------------------------------------------------------------
  if (c.stick && s.phase === "ap") {
    setPhase(s, "manual");
  } else if (!c.stick && s.phase === "manual") {
    setPhase(s, "ap");
    s.pathS = s.airborne ? closestS(s.x, s.z).s : 0; // rejoin the pattern
  }

  let rollTarget = 0;
  let pitchTarget = s.pitch;

  if (s.phase === "rollout") {
    s.throttleCmd = 0;
    pitchTarget = 0;
  } else if (s.phase === "manual" && c.stick) {
    s.throttleCmd = clamp(s.throttleCmd + c.throttle * 0.7 * hReal, 0, 1);
    pitchTarget = 4 - c.stick.y * 16;
    if (s.airborne) {
      rollTarget = c.stick.x * 40;
    } else {
      // On the runway the nose only comes up once there's enough speed.
      pitchTarget = s.ias < 45 ? 0 : clamp(pitchTarget, 0, 12);
    }
  } else if (s.phase === "ap" && !s.airborne) {
    // Takeoff: full power, rotate at 52 kt.
    s.throttleCmd = 1;
    s.flapsCmd = 0;
    pitchTarget = s.ias > 52 ? 10 : 0;
  } else if (s.phase === "ap") {
    pitchTarget = autopilot(s, agl);
    rollTarget = s.rollTarget;
  }

  // Any autopilot flying (beyond the first moment of the takeoff roll)
  // disqualifies the run from the leaderboard.
  if (s.phase === "ap" && (s.airborne || s.ias > 15)) s.apUsed = true;

  // --- Controls and configuration ------------------------------------------------
  const manual = s.phase === "manual";
  s.roll += (rollTarget - s.roll) * Math.min(1, (manual ? 2.6 : 1.5) * h);
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, (manual ? 2.2 : 1.4) * h);
  s.throttle += clamp(s.throttleCmd - s.throttle, -1.5 * h, 1.5 * h);
  s.flaps += clamp(s.flapsCmd - s.flaps, -3.5 * h, 3.5 * h);

  // Turbulence: gusts that nudge the airplane off attitude. You (or the
  // autopilot) have to keep correcting. Deterministic in run time.
  const wind = windAt(s.runTime);
  if (s.airborne) {
    const t = s.runTime;
    const gust = (wind.speed - 8) / 6;
    s.roll += gust * (3.2 * Math.sin(t * 1.31) + 2.1 * Math.sin(t * 2.87 + 2.1) + 1.2 * Math.sin(t * 5.3 + 0.7)) * h;
    s.pitch += gust * (0.9 * Math.sin(t * 1.07 + 1.1) + 0.6 * Math.sin(t * 3.41)) * h;
  }
  s.aoa = aoaFor(s.ias, s.flaps, s.airborne ? s.roll : 0);

  // --- Energy -------------------------------------------------------------------
  const prevIas = s.ias;
  let fpa = 0;
  if (s.airborne) {
    fpa = clamp(s.pitch - (s.aoa - INCIDENCE), -25, 25);
    const accel = s.throttle * thrustMax(s.ias) - drag(s.ias, s.flaps) - G_K * Math.sin(fpa * deg);
    s.ias = Math.max(0, s.ias + accel * h);
  } else {
    const brakes = s.phase === "rollout" ? 4 : 0;
    const accel = s.throttle * thrustMax(s.ias) - CD0 * s.ias * s.ias - 0.35 - brakes;
    s.ias = Math.max(0, s.ias + accel * h);
    // Lift-off when the wing is flying and the nose is up.
    if ((s.phase === "ap" || s.phase === "manual") && s.pitch - (s.aoa - INCIDENCE) > 0.3 && s.ias > stallSpeed(s.flaps, 0) * 1.05) {
      s.airborne = true;
    }
  }

  s.vs = s.ias * 101.27 * Math.sin(fpa * deg);
  s.alt += (s.vs / 60) * h;

  if (s.airborne) {
    s.hdg += ((1091 * Math.tan(s.roll * deg)) / Math.max(s.ias, 40)) * h;
  } else {
    s.roll += -s.roll * Math.min(1, 3 * h);
    s.hdg += angleDiff(RUNWAY.heading, s.hdg) * Math.min(1, 0.8 * h);
    s.z += -s.z * Math.min(1, 0.3 * h); // stay on the centerline
  }
  s.hdg = ((s.hdg % 360) + 360) % 360;

  const gate = GATES[s.nextGate];
  const alongBefore = gate ? (s.x - gate.x) * gate.tx + (s.z - gate.z) * gate.tz : 0;
  const tas = s.ias * 1.68781 * Math.cos(fpa * deg);
  // In the air the wind carries you; on the ground the wheels don't drift.
  const drift = s.airborne ? 1 : 0;
  s.x += (Math.sin(s.hdg * deg) * tas + wind.vx * drift) * h;
  s.z += (-Math.cos(s.hdg * deg) * tas + wind.vz * drift) * h;

  const trend = h > 0 ? ((s.ias - prevIas) / h) * 6 : 0;
  s.speedTrend += (trend - s.speedTrend) * Math.min(1, 3 * h);

  if (!s.airborne) {
    s.alt = terrainHeight(s.x, s.z);
    if (s.phase === "rollout" && s.ias < 3) landed(s);
    return;
  }

  // --- Limits -----------------------------------------------------------------
  if (s.aoa >= AOA_CRIT) {
    return fail(s, "STALL", "Too slow for the wing to fly. Lower the nose and add power the moment the STALL warning shows.");
  }
  if (s.ias > VNE) {
    return fail(s, "OVERSPEED", "Past the red line (163 kt). Ease the nose up and pull the power back in a dive.");
  }
  if (s.aoa >= AOA_WARN) s.stallWarnTime += hReal;
  if (s.ias > vfeFor(s.flaps)) {
    s.flapWarnTime += hReal;
    s.vfeTimer += hReal;
    if (s.vfeTimer > 1.5) {
      return fail(s, "FLAP OVERSPEED", `Flaps ${Math.round(s.flapsCmd)} max is ${vfeFor(s.flaps)} kt. Slow down before you put them out.`);
    }
  } else {
    s.vfeTimer = Math.max(0, s.vfeTimer - hReal);
  }

  // --- Gates --------------------------------------------------------------------
  if (gate) {
    const rx = s.x - gate.x;
    const rz = s.z - gate.z;
    const along = rx * gate.tx + rz * gate.tz;
    if (along >= 0 && alongBefore < 0 && Math.hypot(rx, rz) < 1500) {
      const lateral = Math.abs(-rx * gate.tz + rz * gate.tx);
      const vertical = Math.abs(s.alt - gate.y);
      const hit = lateral < GATE_W / 2 && vertical < GATE_H / 2;
      s.gates[s.nextGate] = { status: hit ? "passed" : "missed", at: s.time };
      if (hit) {
        s.passed++;
        // 100 for threading it, up to 50 more for dead center.
        const error = Math.max(lateral / (GATE_W / 2), vertical / (GATE_H / 2));
        const points = 100 + Math.round(50 * (1 - error));
        s.gatePoints += points;
        toast(s, `GATE ${s.nextGate + 1}/${GATES.length}  +${points}`, "green");
      } else {
        toast(s, "GATE MISSED", "amber");
      }
      s.nextGate++;
    } else if (s.phase === "ap" && s.pathS > gate.s + 1500) {
      s.gates[s.nextGate] = { status: "missed", at: s.time };
      s.nextGate++;
    }
  }

  // --- Ground contact -------------------------------------------------------------
  const groundHere = terrainHeight(s.x, s.z);
  if (s.alt > groundHere) return;
  s.alt = groundHere;
  if (s.vs >= 0) return; // just lifted off, not touching down

  if (!onRunway(s.x, s.z)) {
    if (s.x < RUNWAY.west && s.x > RUNWAY.west - 8000 && Math.abs(s.z) < 700) {
      return fail(s, "LANDED SHORT", "So close. The runway starts at the piano keys. Aim just past them, never before.");
    }
    if (s.x >= RUNWAY.west && s.x <= RUNWAY.east && Math.abs(s.z) < 600) {
      return fail(s, "OFF THE RUNWAY", "Line up with the centerline early on final, and keep your heading lined up all the way down.");
    }
    return fail(s, "TERRAIN", "Watch your altitude. When PULL UP shows, add full power and climb now.");
  }
  if (s.ias > MAX_TOUCHDOWN_KT) {
    return fail(s, "TOO FAST", `Touched down at ${Math.round(s.ias)} kt. Use flaps 30, fly about 60 kt on final and let it slow in the flare.`);
  }
  if (s.vs < MAX_TOUCHDOWN_SINK) {
    return fail(s, "HARD LANDING", `${Math.round(s.vs)} ft/min. Flare: ease the nose up just above the runway to soften the arrival.`);
  }
  if (Math.abs(s.roll) > MAX_TOUCHDOWN_BANK) {
    return fail(s, "WINGTIP STRIKE", "Level the wings before you touch down.");
  }
  if (s.pitch < -0.5) {
    return fail(s, "NOSEWHEEL FIRST", "Hold the nose up in the flare so the main wheels touch first.");
  }

  // A good landing: score it.
  const distance = Math.max(0, Math.round(s.x - THRESHOLD_X));
  const sink = Math.round(s.vs);
  const offset = Math.round(Math.abs(s.z));
  const missed = s.nextGate - s.passed + (GATES.length - s.nextGate);
  const breakdown: Breakdown = {
    gates: s.gatePoints,
    landing: Math.round(Math.max(0, 2000 - distance) * 0.75),
    touchdown: Math.round(Math.max(0, 500 + sink) * 0.8),
    centerline: Math.round(Math.max(0, 300 - offset * 4)),
    time: Math.round(Math.max(0, (330 - s.runTime) * 4)),
    penalties: -Math.round((s.stallWarnTime + s.flapWarnTime) * 100 + missed * 75),
  };
  const score = Math.max(0, Object.values(breakdown).reduce((a, b) => a + b, 0));
  const ranked = s.phase === "manual" && !s.apUsed;
  const newBest = ranked && (s.best === null || score > s.best);
  if (newBest) s.best = score;
  s.result = {
    score,
    breakdown,
    distance,
    sink,
    speed: Math.round(s.ias),
    offset,
    gates: s.passed,
    runTime: Math.round(s.runTime),
    rank: rankFor(distance),
    ranked,
    newBest,
  };
  while (s.nextGate < GATES.length) s.gates[s.nextGate++] = { status: "missed", at: s.time };
  s.airborne = false;
  s.vs = 0;
  setPhase(s, "rollout");
}

function landed(s: FlightState) {
  setPhase(s, "landed");
}

// Autopilot: pure-pursuit lateral guidance, a flight-path command that
// never asks for more climb than the engine can give, an autothrottle with
// feed-forward, and a flap schedule that respects flap speeds.
function autopilot(s: FlightState, agl: number) {
  s.pathS = closestS(s.x, s.z, s.pathS).s;
  const here = pathAt(s.pathS);
  const look = pathAt(s.pathS + clamp(s.ias * 1.688 * 3, 700, 1600));
  const dx = look.x - s.x;
  const dz = look.z - s.z;
  // Steer the ground track, not the nose: crab into the wind by the wind
  // correction angle, like a pilot does in a crosswind.
  const track = Math.atan2(dx, -dz) / deg;
  const wind = windAt(s.runTime);
  const tas = Math.max(s.ias * 1.68781, 1);
  const cross = wind.vx * Math.cos(track * deg) + wind.vz * Math.sin(track * deg);
  const wca = Math.asin(clamp(-cross / tas, -0.5, 0.5)) / deg;
  const desiredHdg = (((track + wca) % 360) + 360) % 360;
  s.rollTarget = clamp(angleDiff(desiredHdg, s.hdg) * 1.5, -25, 25);
  s.hdgSel = desiredHdg;

  const targetAlt = FIELD + look.agl;
  s.altSel = Math.round(targetAlt / 100) * 100;
  let speed = here.speed;
  let fpa = clamp(Math.atan2(targetAlt - s.alt, Math.hypot(dx, dz)) / deg, -6, 8);
  const available = Math.asin(clamp((thrustMax(s.ias) - drag(s.ias, s.flaps)) / G_K, -1, 1)) / deg - 0.7;
  fpa = Math.min(fpa, available);
  // Slow? Trade climb for speed, but never push over toward the ground.
  if (s.ias < speed - 4 && fpa > 0) fpa = Math.max(0, fpa - (speed - 4 - s.ias) * 0.25);

  // Flare over the runway: power to idle, shallow the descent.
  const onFinal = s.nextGate >= GATES.length - 1;
  const flare = onFinal && agl < 14 && Math.abs(s.z) < 200 && s.x > RUNWAY.west - 1500;
  if (flare) {
    // Hold it off, then let it settle onto the mains as the wing gets slow.
    fpa = s.aoa > 11 ? -2.5 : -1.1;
    speed = 0;
  }

  const thrustNeeded = drag(s.ias, s.flaps) + G_K * Math.sin(fpa * deg) + 0.8 * (speed - s.ias);
  s.throttleCmd = flare ? 0 : clamp(thrustNeeded / thrustMax(s.ias), 0, 1);

  // Flaps: 10 abeam the numbers, 20 on base, 30 on final, never above Vfe.
  const want = s.nextGate >= 10 ? 30 : s.nextGate >= 9 ? 20 : s.nextGate >= 6 ? 10 : 0;
  if (want > s.flapsCmd && s.ias < VFE_BY_FLAPS[FLAP_SETTINGS.indexOf(want)] - 5) s.flapsCmd = want;
  if (want < s.flapsCmd) s.flapsCmd = want;

  return clamp(fpa + s.aoa - INCIDENCE, -10, 15);
}

export function readouts(s: FlightState) {
  const chop = s.airborne ? 1 : 0;
  const t = s.simTime;
  const pitch = s.pitch + chop * (0.18 * Math.sin(t * 0.9) + 0.07 * Math.sin(t * 2.3));
  const roll = s.roll + chop * (0.3 * Math.sin(t * 0.7 + 1) + 0.1 * Math.sin(t * 1.9));
  const fpa = Math.asin(clamp(s.vs / (Math.max(s.ias, 1) * 101.27), -1, 1)) / deg;
  const vsRounded = Math.round(s.vs / 50) * 50;
  const hdg = Math.round(s.hdg) % 360;
  const agl = s.alt - terrainHeight(s.x, s.z);
  const aligned = Math.abs(s.z) < 700 && s.x < RUNWAY.east && Math.abs(angleDiff(s.hdg, RUNWAY.heading)) < 35;
  const flying = s.airborne && (s.phase === "ap" || s.phase === "manual");

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
    gatesText: `${s.passed}/${GATES.length}`,
    windText: (() => {
      const w = windAt(s.runTime);
      return `${String(Math.round(w.from / 10) * 10).padStart(3, "0")}°/${Math.round(w.speed)}`;
    })(),
    stallSpeed: stallSpeed(s.flaps, s.airborne ? s.roll : 0),
    stallWarning: flying && s.aoa >= AOA_WARN,
    vfeWarning: flying && s.ias > vfeFor(s.flaps) - 3 && s.flaps > 2,
    overspeedWarning: flying && s.ias > VNO + 20,
    terrainWarning: flying && ((s.vs < -1200 && agl < 1500) || (agl < 400 && s.vs < -500 && !aligned)),
    camera: { x: s.x, y: s.alt + EYE_HEIGHT, z: s.z },
  };
}

export function modeLabel(s: FlightState) {
  if (s.phase === "ap") return s.airborne ? "AP · PATH" : "TO/GA";
  if (s.phase === "manual") return "YOUR AIRPLANE";
  if (s.phase === "rollout") return "ROLLOUT";
  if (s.phase === "landed") return "LANDED";
  return s.failure?.title ?? "FAILED";
}
