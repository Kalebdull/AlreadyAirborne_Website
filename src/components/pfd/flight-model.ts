// A deliberately simple flight model: just enough physics that the
// instruments and the synthetic-vision view agree with each other the way
// they do in a real airplane. Pitch drives climb, bank drives turn rate,
// and the autopilot flies the magenta pathway around the traffic pattern
// to a landing. Hover the display to take the controls.
//
// Physics runs in fixed 1/120 s substeps so it behaves identically at 30,
// 60 or 120 fps, and never jumps after a slow frame.

import { closestS, FIELD, GATE_H, GATE_W, GATES, onRunway, pathAt, RUNWAY, terrainHeight } from "./world";

export type Phase = "takeoff" | "ap" | "manual" | "rollout" | "landed" | "crashed";
export type Tone = "green" | "amber" | "red" | "cyan";
export type GateState = { status: "pending" | "passed" | "missed"; at: number };

export type FlightState = {
  time: number; // real seconds
  simTime: number;
  phase: Phase;
  phaseTime: number; // real seconds in this phase
  x: number;
  z: number;
  alt: number; // ft MSL
  pitch: number; // deg, nose up +
  roll: number; // deg, right wing down +
  ias: number; // kt
  vs: number; // ft/min
  hdg: number; // deg
  pathS: number; // progress along the pattern, ft
  altSel: number;
  hdgSel: number;
  speedTrend: number;
  gates: GateState[];
  nextGate: number;
  passed: number;
  toast: { text: string; tone: Tone; at: number } | null;
  fade: number; // 0..1 black overlay for resets
  fadingIn: boolean;
  resets: number;
};

export type Controls = { stick: { x: number; y: number } | null };

// The sim runs faster than real time so a visitor sees a whole pattern in
// about a minute rather than five.
export const SIM_SPEED = 3.5;
export const EYE_HEIGHT = 8;

const ROTATE_KT = 55;
const CRUISE_PITCH = 2.5;
const STEP = 1 / 120;
const deg = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const angleDiff = (to: number, from: number) => ((to - from + 540) % 360) - 180;

export function createFlight(reduced = false): FlightState {
  const base: FlightState = {
    time: 0,
    simTime: 0,
    phase: "takeoff",
    phaseTime: 0,
    x: RUNWAY.west + 300,
    z: 0,
    alt: FIELD,
    pitch: 0,
    roll: 0,
    ias: 0,
    vs: 0,
    hdg: 90,
    pathS: 0,
    altSel: FIELD + 800,
    hdgSel: 90,
    speedTrend: 0,
    gates: GATES.map(() => ({ status: "pending" as const, at: 0 })),
    nextGate: 0,
    passed: 0,
    toast: null,
    fade: 0,
    fadingIn: false,
    resets: 0,
  };
  if (reduced) {
    // A still frame on downwind, with the pathway visible ahead.
    const p = pathAt(closestS(-1000, -4600).s);
    Object.assign(base, { phase: "ap", x: p.x, z: p.z, alt: FIELD + p.agl, hdg: 270, ias: 90, pitch: CRUISE_PITCH, pathS: p.s, nextGate: 5 });
  }
  return base;
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

function reset(s: FlightState) {
  const keep = { time: s.time, simTime: s.simTime, resets: s.resets + 1 };
  Object.assign(s, createFlight(), keep, { fade: 1, fadingIn: true });
}

function landingGrade(vs: number) {
  if (vs > -250) return "BUTTER.";
  if (vs > -600) return "NICE LANDING.";
  return "FIRM. WE'LL WORK ON IT.";
}

export function step(s: FlightState, dtReal: number, c: Controls) {
  s.time += dtReal;
  s.phaseTime += dtReal;

  const dtSim = dtReal * SIM_SPEED;
  const n = Math.min(60, Math.max(1, Math.ceil(dtSim / STEP)));
  for (let i = 0; i < n; i++) physics(s, dtSim / n, c);

  // Fades and resets run on real time so they feel the same at any sim speed.
  if (s.fadingIn) {
    s.fade = Math.max(0, 1 - s.phaseTime / 0.5);
    if (s.fade === 0) s.fadingIn = false;
  } else if (s.phase === "landed" || s.phase === "crashed") {
    const hold = s.phase === "landed" ? 3.4 : 2.4;
    s.fade = clamp((s.phaseTime - hold) / 0.45, 0, 1);
    if (s.fade >= 1) reset(s);
  } else {
    s.fade = 0;
  }
}

function physics(s: FlightState, h: number, c: Controls) {
  s.simTime += h;
  const ground = terrainHeight(s.x, s.z);
  const agl = s.alt - ground;

  // --- Who's flying -------------------------------------------------------
  if (c.stick && (s.phase === "ap" || (s.phase === "takeoff" && agl > 30))) {
    setPhase(s, "manual");
  } else if (!c.stick && s.phase === "manual") {
    setPhase(s, "ap");
    s.pathS = closestS(s.x, s.z).s; // rejoin the pattern from wherever you are
  } else if (s.phase === "takeoff" && agl > 50) {
    setPhase(s, "ap");
    s.pathS = closestS(s.x, s.z, 0).s;
    toast(s, "AUTOPILOT · FOLLOWING THE PATHWAY", "cyan");
  }

  let rollTarget = 0;
  let pitchTarget = CRUISE_PITCH;
  let speedTarget = s.ias;

  if (s.phase === "takeoff") {
    pitchTarget = s.ias > ROTATE_KT ? 8 : 0;
  } else if (s.phase === "manual" && c.stick) {
    rollTarget = c.stick.x * 35;
    pitchTarget = CRUISE_PITCH - c.stick.y * 12;
  } else if (s.phase === "ap") {
    // Pure-pursuit guidance: aim at a point ~4 seconds ahead on the path.
    s.pathS = closestS(s.x, s.z, s.pathS).s;
    const here = pathAt(s.pathS);
    const look = pathAt(s.pathS + clamp(s.ias * 1.688 * 4, 900, 2200));
    const dx = look.x - s.x;
    const dz = look.z - s.z;
    const desiredHdg = ((Math.atan2(dx, -dz) / deg) % 360 + 360) % 360;
    rollTarget = clamp(angleDiff(desiredHdg, s.hdg) * 1.3, -25, 25);
    const targetAlt = FIELD + look.agl;
    const fpa = clamp(Math.atan2(targetAlt - s.alt, Math.hypot(dx, dz)) / deg, -6, 8);
    pitchTarget = CRUISE_PITCH + fpa / 0.95;
    speedTarget = here.speed;
    s.altSel = Math.round(targetAlt / 100) * 100;
    s.hdgSel = desiredHdg;

    // Flare over the runway: ease the nose up and bleed off speed.
    if (agl < 25 && Math.abs(s.z) < 200 && s.x > RUNWAY.west - 1500) {
      pitchTarget = 1.4;
      speedTarget = 58;
    }
  } else if (s.phase === "rollout" || s.phase === "landed" || s.phase === "crashed") {
    pitchTarget = 0;
  }

  const manual = s.phase === "manual";
  s.roll += (rollTarget - s.roll) * Math.min(1, (manual ? 3 : 1.6) * h);
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, (manual ? 2.5 : 1.4) * h);

  // --- Speed ----------------------------------------------------------------
  const prevIas = s.ias;
  const onGround = agl <= 0.5;
  if (s.phase === "takeoff" && onGround) {
    s.ias = Math.min(s.ias + 12 * h, ROTATE_KT + 10);
  } else if (s.phase === "ap") {
    s.ias += (speedTarget - s.ias) * 0.6 * h;
  } else if (manual) {
    s.ias += (clamp(95 - (s.pitch - CRUISE_PITCH) * 6, 55, 150) - s.ias) * 0.35 * h;
  } else if (s.phase === "rollout") {
    s.ias = Math.max(0, s.ias - 7 * h);
    if (s.ias < 3) {
      setPhase(s, "landed");
    }
  } else if (s.phase === "landed" || s.phase === "crashed") {
    s.ias = Math.max(0, s.ias - 20 * h);
  }

  // --- Flight path ----------------------------------------------------------
  const grounded = (s.phase === "takeoff" && s.ias < ROTATE_KT) || s.phase === "rollout" || s.phase === "landed" || s.phase === "crashed";
  const fpa = grounded ? 0 : (s.pitch - CRUISE_PITCH) * 0.95;
  s.vs = s.ias * 101.27 * Math.sin(fpa * deg);
  s.alt += (s.vs / 60) * h;

  if (grounded) {
    s.hdg += angleDiff(RUNWAY.heading, s.hdg) * Math.min(1, 0.8 * h);
    s.roll += -s.roll * Math.min(1, 3 * h);
  } else {
    s.hdg += ((1091 * Math.tan(s.roll * deg)) / Math.max(s.ias, 50)) * h;
  }
  s.hdg = ((s.hdg % 360) + 360) % 360;

  const gate = GATES[s.nextGate];
  const alongBefore = gate ? (s.x - gate.x) * gate.tx + (s.z - gate.z) * gate.tz : 0;

  const gs = s.ias * 1.68781 * Math.cos(fpa * deg);
  s.x += Math.sin(s.hdg * deg) * gs * h;
  s.z += -Math.cos(s.hdg * deg) * gs * h;

  // --- Gates ----------------------------------------------------------------
  if (gate && (s.phase === "ap" || s.phase === "manual" || s.phase === "takeoff")) {
    const rx = s.x - gate.x;
    const rz = s.z - gate.z;
    const along = rx * gate.tx + rz * gate.tz;
    if (along >= 0 && alongBefore < 0 && Math.hypot(rx, rz) < 1500) {
      const lateral = Math.abs(-rx * gate.tz + rz * gate.tx);
      const vertical = Math.abs(s.alt - gate.y);
      const hit = lateral < GATE_W / 2 + 30 && vertical < GATE_H / 2 + 30;
      s.gates[s.nextGate] = { status: hit ? "passed" : "missed", at: s.time };
      if (hit) {
        s.passed++;
        toast(s, `GATE ${s.nextGate + 1}/${GATES.length}`, "green");
      } else {
        toast(s, "GATE MISSED", "amber");
      }
      s.nextGate++;
    } else if (s.phase === "ap" && s.pathS > gate.s + 1500) {
      // Flew past it some other way (e.g. after hand-flying elsewhere).
      s.gates[s.nextGate] = { status: "missed", at: s.time };
      s.nextGate++;
    }
  }

  // --- Ground contact -------------------------------------------------------
  const groundHere = terrainHeight(s.x, s.z);
  if (s.alt <= groundHere) {
    if (s.phase === "ap" || s.phase === "manual") {
      if (onRunway(s.x, s.z) && s.vs > -1100 && Math.abs(s.roll) < 20) {
        toast(s, `${landingGrade(s.vs)}  ${Math.round(s.vs)} FPM · ${s.passed}/${GATES.length} GATES`, s.vs > -600 ? "green" : "amber");
        setPhase(s, "rollout");
        // Missed whatever gates are left.
        while (s.nextGate < GATES.length) s.gates[s.nextGate++] = { status: "missed", at: s.time };
      } else {
        toast(s, "TERRAIN. LET'S TRY THAT AGAIN.", "red");
        setPhase(s, "crashed");
      }
    }
    s.alt = groundHere;
    if (s.vs < 0) s.vs = 0;
  }

  const trend = h > 0 ? ((s.ias - prevIas) / h) * 6 : 0;
  s.speedTrend += (trend - s.speedTrend) * Math.min(1, 3 * h);
}

export function readouts(s: FlightState) {
  const airborne = s.phase === "ap" || s.phase === "manual" || (s.phase === "takeoff" && s.alt > FIELD + 5);
  const chop = airborne ? 1 : 0;
  const t = s.simTime;
  const pitch = s.pitch + chop * (0.25 * Math.sin(t * 0.9) + 0.1 * Math.sin(t * 2.3));
  const roll = s.roll + chop * (0.4 * Math.sin(t * 0.7 + 1) + 0.15 * Math.sin(t * 1.9));
  const fpa = Math.asin(clamp(s.vs / (Math.max(s.ias, 1) * 101.27), -1, 1)) / deg;
  const vsRounded = Math.round(s.vs / 50) * 50;
  const hdg = Math.round(s.hdg) % 360;
  const agl = s.alt - terrainHeight(s.x, s.z);
  const aligned = Math.abs(s.z) < 700 && s.x < RUNWAY.east && Math.abs(angleDiff(s.hdg, RUNWAY.heading)) < 35;

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
    warning: (s.phase === "ap" || s.phase === "manual") && ((s.vs < -1200 && agl < 1500) || (agl < 400 && s.vs < -500 && !aligned)),
    camera: { x: s.x, y: s.alt + EYE_HEIGHT, z: s.z },
  };
}

export function modeLabel(phase: Phase) {
  return {
    takeoff: "TO/GA",
    ap: "AP · PATH",
    manual: "YOUR AIRPLANE",
    rollout: "ROLLOUT",
    landed: "LANDED",
    crashed: "TERRAIN",
  }[phase];
}
