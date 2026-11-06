// A deliberately simple flight model: just enough physics that the
// instruments agree with each other the way they do in a real airplane.
// Pitch drives climb and airspeed, bank drives turn rate, and the
// autopilot flies to the cyan altitude and heading bugs.

export type Mode = "takeoff" | "ap" | "manual";

export type FlightState = {
  time: number;
  mode: Mode;
  pitch: number; // deg, nose up +
  roll: number; // deg, right wing down +
  ias: number; // kt
  alt: number; // ft MSL
  vs: number; // ft/min
  hdg: number; // deg
  altSel: number;
  hdgSel: number;
  speedTrend: number; // kt over the next 6 s
};

export type Controls = {
  t: number;
  stick: { x: number; y: number } | null; // -1..1, null = hands off
  scroll: number;
};

const FIELD = 820; // field elevation, ft
const ROTATE_KT = 55;
const CRUISE_PITCH = 2.5;
const deg = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const angleDiff = (to: number, from: number) => ((to - from + 540) % 360) - 180;

export function createFlight(reduced = false): FlightState {
  if (reduced) {
    return { time: 0, mode: "ap", pitch: CRUISE_PITCH, roll: 0, ias: 110, alt: 3000, vs: 0, hdg: 90, altSel: 3000, hdgSel: 90, speedTrend: 0 };
  }
  return { time: 0, mode: "takeoff", pitch: 0, roll: 0, ias: 0, alt: FIELD, vs: 0, hdg: 90, altSel: 3000, hdgSel: 90, speedTrend: 0 };
}

export function step(s: FlightState, dt: number, c: Controls) {
  s.time += dt;
  const airborne = s.alt > FIELD + 50;

  // --- Who's flying -------------------------------------------------------
  // You can take the controls once the wheels are off the ground.
  if (c.stick && (s.mode !== "takeoff" || airborne)) s.mode = "manual";
  else if (s.mode === "manual") s.mode = "ap";
  else if (s.mode === "takeoff" && s.alt > FIELD + 200) s.mode = "ap";

  let rollTarget = 0;
  let pitchTarget = CRUISE_PITCH;

  if (s.mode === "takeoff") {
    pitchTarget = s.ias > ROTATE_KT ? 8 : 0;
  } else if (s.mode === "manual" && c.stick) {
    rollTarget = c.stick.x * 35;
    pitchTarget = CRUISE_PITCH - c.stick.y * 12;
    // Close to the ground the airplane won't let you fly into it.
    if (s.alt - FIELD < 150) pitchTarget = Math.max(pitchTarget, CRUISE_PITCH + 4);
  } else {
    // Autopilot: scrolling down the page selects a higher altitude, and it
    // flies gentle S-turns between two headings.
    s.altSel = clamp(3000 + Math.floor(c.scroll / 600) * 500, 3000, 9500);
    s.hdgSel = s.time % 36 < 18 ? 60 : 120;
    rollTarget = clamp(angleDiff(s.hdgSel, s.hdg) * 1.5, -20, 20);
    pitchTarget = CRUISE_PITCH + clamp((s.altSel - s.alt) / 150, -4, 7);
  }

  const rollRate = s.mode === "manual" ? 3 : 1.4;
  const pitchRate = s.mode === "manual" ? 2.5 : 1.1;
  s.roll += (rollTarget - s.roll) * Math.min(1, rollRate * dt);
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, pitchRate * dt);

  // --- Physics ------------------------------------------------------------
  const prevIas = s.ias;
  const onRunway = s.mode === "takeoff" && !airborne && s.ias < ROTATE_KT + 8;
  if (onRunway) {
    s.ias = Math.min(s.ias + 11 * dt, ROTATE_KT + 8);
  } else {
    const iasTarget = clamp(108 - (s.pitch - CRUISE_PITCH) * 6, 55, 170);
    s.ias += (iasTarget - s.ias) * 0.35 * dt;
  }

  const fpa = onRunway && s.ias < ROTATE_KT ? 0 : (s.pitch - CRUISE_PITCH) * 0.95;
  s.vs = s.ias * 101.27 * Math.sin(fpa * deg);
  s.alt += (s.vs / 60) * dt;
  if (s.alt < FIELD) {
    s.alt = FIELD;
    s.vs = Math.max(0, s.vs);
  }

  // Standard rate-of-turn relationship: bank and speed set turn rate.
  s.hdg = (s.hdg + ((1091 * Math.tan(s.roll * deg)) / Math.max(s.ias, 50)) * dt + 360) % 360;

  const trend = dt > 0 ? ((s.ias - prevIas) / dt) * 6 : 0;
  s.speedTrend += (trend - s.speedTrend) * Math.min(1, 3 * dt);
}

export function readouts(s: FlightState) {
  // Light chop once airborne, so the display never looks frozen.
  const chop = s.alt > FIELD + 20 ? 1 : 0;
  const t = s.time;
  const pitch = s.pitch + chop * (0.3 * Math.sin(t * 1.7) + 0.12 * Math.sin(t * 4.3));
  const roll = s.roll + chop * (0.5 * Math.sin(t * 1.3 + 1) + 0.2 * Math.sin(t * 3.7));
  const fpa = Math.asin(clamp(s.vs / (Math.max(s.ias, 1) * 101.27), -1, 1)) / deg;
  const vsRounded = Math.round(s.vs / 50) * 50;
  const hdg = Math.round(s.hdg) % 360;

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
    warning: s.mode !== "takeoff" && s.vs < -800 && s.alt - FIELD < 1500,
  };
}
