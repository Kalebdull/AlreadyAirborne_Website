// Recording and replaying a flight, so leaderboard scores can be verified
// on the server. The browser never sends a score it computed itself: it
// sends the pilot's inputs, frame by frame, and the server re-flies the run
// with the same flight model.
//
// Inputs are quantized *before* the browser uses them, so the browser and
// the server run exactly the same numbers.

import { createFlight, step, type Controls, type FlightState } from "./flight-model";

export type Frame = {
  dt: number; // seconds, a multiple of 1/10000
  stick: { x: number; y: number } | null; // multiples of 1/1000
  throttle: number; // -1 | 0 | 1
  flaps: number; // -1 | 0 | 1
};

const BYTES_PER_FRAME = 7;
const NO_STICK = -32768;
export const MAX_FRAMES = 60_000; // ~8 minutes at 120 fps

const q = (v: number, scale: number) => Math.round(v * scale) / scale;
const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function quantize(dt: number, c: Controls): Frame {
  return {
    dt: Math.min(0.05, Math.max(0.0001, q(dt, 10000))),
    stick: c.stick ? { x: q(Math.max(-1, Math.min(1, c.stick.x)), 1000), y: q(Math.max(-1, Math.min(1, c.stick.y)), 1000) } : null,
    throttle: sign(c.throttle),
    flaps: sign(c.flaps),
  };
}

export function toControls(f: Frame, extra: Partial<Controls> = {}): Controls {
  return { stick: f.stick, throttle: f.throttle, flaps: f.flaps, retry: false, ...extra };
}

export function encode(frames: Frame[]): string {
  const bytes = new Uint8Array(frames.length * BYTES_PER_FRAME);
  const view = new DataView(bytes.buffer);
  frames.forEach((f, i) => {
    const o = i * BYTES_PER_FRAME;
    view.setUint16(o, Math.round(f.dt * 10000));
    view.setInt16(o + 2, f.stick ? Math.round(f.stick.x * 1000) : NO_STICK);
    view.setInt16(o + 4, f.stick ? Math.round(f.stick.y * 1000) : NO_STICK);
    view.setUint8(o + 6, (f.throttle + 1) * 3 + (f.flaps + 1));
  });
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function decode(data: string): Frame[] {
  const binary = atob(data);
  if (binary.length % BYTES_PER_FRAME !== 0) throw new Error("Corrupt replay");
  const count = binary.length / BYTES_PER_FRAME;
  if (count > MAX_FRAMES) throw new Error("Replay too long");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const frames: Frame[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * BYTES_PER_FRAME;
    const dt = view.getUint16(o) / 10000;
    const sx = view.getInt16(o + 2);
    const sy = view.getInt16(o + 4);
    const ctl = view.getUint8(o + 6);
    if (dt <= 0 || dt > 0.05 || ctl > 8) throw new Error("Corrupt replay");
    frames.push({
      dt,
      stick: sx === NO_STICK ? null : { x: Math.max(-1, Math.min(1, sx / 1000)), y: Math.max(-1, Math.min(1, sy / 1000)) },
      throttle: Math.floor(ctl / 3) - 1,
      flaps: (ctl % 3) - 1,
    });
  }
  return frames;
}

// Re-fly a run from brake release until it lands or fails.
export function replay(frames: Frame[]): FlightState {
  const s = createFlight();
  for (const f of frames) {
    step(s, f.dt, toControls(f));
    if (s.phase === "rollout" || s.phase === "landed" || s.phase === "failed") break;
  }
  return s;
}
