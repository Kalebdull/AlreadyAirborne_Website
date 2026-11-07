// The ten levels. Every one ends in a landing; each gets harder in four
// ways at once: smaller rings, more wind, a "land by" line closer to the
// threshold, and tighter touchdown limits. Fail anything and the run goes
// back to level 1, so level 1 is short and nearly impossible to fail.

import { buildCourse, type Course } from "./course";
import { FIELD, THRESHOLD_X } from "./world";

export type Level = {
  number: number;
  name: string;
  windFrom: number; // degrees the wind blows from
  wind: number; // kt
  gust: number; // kt on top of the wind
  ringRadius: number; // ft
  landBy: number; // ft past the threshold you must touch down before
  maxSink: number; // ft/min (negative)
  maxSpeed: number; // kt at touchdown
  maxBank: number; // deg at touchdown
  startSpeed: number;
  startFlaps: number;
  course: Course;
};

const T = THRESHOLD_X;
// A 3° glidepath to an aim point 500 ft past the threshold (where the PAPI is).
const glide = (distToAim: number) => Math.round(distToAim * Math.tan((3 * Math.PI) / 180));
const AIM = 500;
const finish: [number, number, number][] = [
  [T, 0, glide(AIM)],
  [T + AIM, 0, 0],
  [T + AIM + 3500, 0, 0],
];

type Spec = Omit<Level, "number" | "course"> & { route: [number, number, number][]; rings: number };

const SPECS: Spec[] = [
  {
    name: "Short Final",
    windFrom: 90, wind: 0, gust: 0, ringRadius: 260, landBy: 3000, maxSink: -900, maxSpeed: 78, maxBank: 12,
    startSpeed: 65, startFlaps: 30, rings: 2,
    route: [[T - 4200, 0, glide(4200 + AIM)], [T - 2000, 0, glide(2000 + AIM)]],
  },
  {
    name: "Straight In",
    windFrom: 90, wind: 4, gust: 0, ringRadius: 220, landBy: 2600, maxSink: -850, maxSpeed: 76, maxBank: 11,
    startSpeed: 66, startFlaps: 30, rings: 3,
    route: [[T - 5400, 0, glide(5400 + AIM)], [T - 2600, 0, glide(2600 + AIM)]],
  },
  {
    name: "Offset Final",
    windFrom: 120, wind: 6, gust: 2, ringRadius: 190, landBy: 2300, maxSink: -800, maxSpeed: 74, maxBank: 10,
    startSpeed: 68, startFlaps: 30, rings: 3,
    route: [[T - 5800, -1500, 350], [T - 3600, -250, glide(3600 + AIM)]],
  },
  {
    name: "Base to Final",
    windFrom: 160, wind: 8, gust: 3, ringRadius: 165, landBy: 2000, maxSink: -750, maxSpeed: 72, maxBank: 9,
    startSpeed: 75, startFlaps: 20, rings: 4,
    route: [[T - 6400, -3400, 520], [T - 6900, -1100, 400], [T - 4400, 0, glide(4400 + AIM)]],
  },
  {
    name: "Left Crosswind",
    windFrom: 30, wind: 9, gust: 4, ringRadius: 145, landBy: 1700, maxSink: -700, maxSpeed: 70, maxBank: 8,
    startSpeed: 70, startFlaps: 30, rings: 4,
    route: [[T - 7000, 700, 420], [T - 4800, 260, glide(4800 + AIM)], [T - 2400, -60, glide(2400 + AIM)]],
  },
  {
    name: "Right Base",
    windFrom: 200, wind: 10, gust: 5, ringRadius: 125, landBy: 1450, maxSink: -650, maxSpeed: 69, maxBank: 8,
    startSpeed: 76, startFlaps: 20, rings: 5,
    route: [[T - 6400, 3900, 560], [T - 7700, 1500, 430], [T - 5000, 0, glide(5000 + AIM)]],
  },
  {
    name: "S-Turns",
    windFrom: 150, wind: 12, gust: 6, ringRadius: 110, landBy: 1250, maxSink: -600, maxSpeed: 68, maxBank: 7,
    startSpeed: 72, startFlaps: 30, rings: 5,
    route: [[T - 8200, -900, 470], [T - 6200, 500, 360], [T - 4200, -300, 250], [T - 2200, 80, glide(2200 + AIM)]],
  },
  {
    name: "Downwind Entry",
    windFrom: 130, wind: 13, gust: 7, ringRadius: 98, landBy: 1050, maxSink: -550, maxSpeed: 66, maxBank: 6,
    startSpeed: 85, startFlaps: 10, rings: 6,
    route: [[T + 1600, -4300, 800], [T - 2400, -4400, 780], [T - 5700, -3800, 650], [T - 7300, -1800, 470], [T - 5600, -150, 300], [T - 2200, 0, glide(2200 + AIM)]],
  },
  {
    name: "Right Traffic",
    windFrom: 210, wind: 15, gust: 8, ringRadius: 88, landBy: 880, maxSink: -500, maxSpeed: 65, maxBank: 6,
    startSpeed: 85, startFlaps: 10, rings: 7,
    route: [[T + 1600, 4300, 800], [T - 2400, 4400, 780], [T - 6400, 4000, 650], [T - 8700, 2300, 480], [T - 7600, 500, 360], [T - 4600, 0, glide(4600 + AIM)]],
  },
  {
    name: "Checkride",
    windFrom: 170, wind: 17, gust: 10, ringRadius: 78, landBy: 720, maxSink: -450, maxSpeed: 64, maxBank: 5,
    startSpeed: 85, startFlaps: 10, rings: 8,
    route: [[T + 1600, -4300, 800], [T - 2400, -4450, 780], [T - 5900, -3700, 640], [T - 7400, -1700, 460], [T - 5900, 250, 320], [T - 3900, -200, glide(3900 + AIM)], [T - 1900, 60, glide(1900 + AIM)]],
  },
];

export const LEVELS: Level[] = SPECS.map(({ route, rings, ...spec }, i) => ({
  ...spec,
  number: i + 1,
  course: buildCourse({
    waypoints: [...route, ...finish],
    field: FIELD,
    thresholdX: T,
    startSpeed: spec.startSpeed,
    finalSpeed: 62,
    rings,
    ringRadius: spec.ringRadius,
  }),
}));

export const LEVEL_COUNT = LEVELS.length;

// The level's gusty wind, a pure function of time so replays match.
export function windAt(level: Level, t: number) {
  const gustiness = 0.5 + 0.5 * Math.sin(t * 0.37 + level.number) * Math.sin(t * 0.11 + 0.7);
  const speed = Math.max(0, level.wind * (1 + 0.15 * Math.sin(t * 0.21)) + level.gust * gustiness);
  const from = level.windFrom + (level.wind > 0 ? 8 * Math.sin(t * 0.13 + 0.4) : 0);
  const toward = ((from + 180) * Math.PI) / 180;
  // Velocity in ft/s: +x east, -z north.
  return { speed, from, vx: Math.sin(toward) * speed * 1.68781, vz: -Math.cos(toward) * speed * 1.68781 };
}
