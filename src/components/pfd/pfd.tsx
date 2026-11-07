"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/logo";
import { createRun, inverseStickCurve, modeLabel, readouts, restart, step, type Controls, type FlightState, type RunResult } from "./flight-model";
import { decode, encode, quantize, toControls, type Frame } from "./replay";
import type { SvtScene } from "./scene";
import { ScoreSubmit, type SubmitApi } from "./score-submit";
import { LEVEL_COUNT, LEVELS } from "./levels";

// A working Garmin-style primary flight display with synthetic vision, and
// a game: fly the magenta pathway around the traffic pattern and land as
// close to the runway threshold as you can without landing short.
//
// The autopilot flies a demo lap until you hover the display (or tap FLY
// on a phone). One requestAnimationFrame loop drives the flight model, the
// 3D scene (loaded on demand) and the 2D instruments, which are written as
// transforms straight to the DOM so React never re-renders mid-flight.

const PPK = 4; // speed tape: px per knot
const PPF = 0.4; // altitude tape: px per foot
const PPH = 6; // heading tape: px per degree

const SPEEDS = Array.from({ length: 23 }, (_, i) => i * 10); // 0–220 kt
const ALTS = Array.from({ length: 121 }, (_, i) => i * 100); // 0–12,000 ft
const HEADINGS = Array.from({ length: 73 }, (_, i) => i * 10 - 180); // -180–540°
const INITIAL = createRun(); // first frame, rendered on the server
const PITCH_LINES = Array.from({ length: 25 }, (_, i) => (i - 12) * 2.5).filter((d) => d !== 0);
const ROLL_TICKS = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];

const ENGAGE_DELAY = 250; // ms hovering before you take the controls
const IDLE_RELEASE = 9000; // ms with no input at all before the autopilot takes back over
const BEST_KEY = "aa-pfd-best-run-score-v4";
const BEST_RUN_KEY = "aa-pfd-best-run-v4"; // the record run's recording, to submit later

function headingLabel(deg: number) {
  const h = ((deg % 360) + 360) % 360;
  return ({ 0: "N", 90: "E", 180: "S", 270: "W" } as Record<number, string>)[h] ?? (h % 30 === 0 ? String(h / 10) : "");
}

export function Pfd() {
  const root = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false); // true while the leaderboard panel is open
  const submitRef = useRef<SubmitApi | null>(null);
  const actionsRef = useRef<{ flyAgain: () => void } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends HTMLElement | SVGElement>(name: string) => el.querySelector<T>(`[data-pfd="${name}"]`)!;
    const parts = {
      svt: q<HTMLDivElement>("svt"),
      attitude: q<HTMLDivElement>("attitude"),
      rollPointer: q<HTMLDivElement>("roll-pointer"),
      fpm: q<HTMLDivElement>("fpm"),
      speedStrip: q<HTMLDivElement>("speed-strip"),
      speedText: q<HTMLSpanElement>("speed-text"),
      speedTrend: q<HTMLDivElement>("speed-trend"),
      lowSpeed: q<HTMLDivElement>("low-speed"),
      altStrip: q<HTMLDivElement>("alt-strip"),
      altText: q<HTMLSpanElement>("alt-text"),
      altTrend: q<HTMLDivElement>("alt-trend"),
      altBug: q<HTMLDivElement>("alt-bug"),
      altSel: q<HTMLSpanElement>("alt-sel"),
      vsiMarker: q<HTMLDivElement>("vsi-marker"),
      vsiText: q<HTMLSpanElement>("vsi-text"),
      hdgStrip: q<HTMLDivElement>("hdg-strip"),
      hdgText: q<HTMLSpanElement>("hdg-text"),
      hdgBug: q<HTMLDivElement>("hdg-bug"),
      mode: q<HTMLSpanElement>("mode"),
      gs: q<HTMLSpanElement>("gs"),
      gates: q<HTMLSpanElement>("gates"),
      wind: q<HTMLSpanElement>("wind"),
      utc: q<HTMLSpanElement>("utc"),
      annStall: q<HTMLDivElement>("ann-stall"),
      annVfe: q<HTMLDivElement>("ann-vfe"),
      annOverspeed: q<HTMLDivElement>("ann-overspeed"),
      annTerrain: q<HTMLDivElement>("ann-terrain"),
      toast: q<HTMLDivElement>("toast"),
      fade: q<HTMLDivElement>("fade"),
      pwrFill: q<HTMLDivElement>("pwr-fill"),
      pwrText: q<HTMLSpanElement>("pwr-text"),
      flapPointer: q<HTMLDivElement>("flap-pointer"),
      flapText: q<HTMLSpanElement>("flap-text"),
      best: q<HTMLSpanElement>("best"),
      bestPanel: q<HTMLButtonElement>("best-panel"),
      runType: q<HTMLSpanElement>("run-type"),
      bestRank: q<HTMLSpanElement>("best-rank"),
      level: q<HTMLSpanElement>("level"),
      runScore: q<HTMLSpanElement>("run-score"),
      windArrow: q<HTMLDivElement>("wind-arrow"),
      windSpeed: q<HTMLSpanElement>("wind-speed"),
      windFrom: q<HTMLSpanElement>("wind-from"),
      landBy: q<HTMLSpanElement>("land-by"),
      intro: q<HTMLDivElement>("intro"),
      introLevel: q<HTMLSpanElement>("intro-level"),
      introName: q<HTMLSpanElement>("intro-name"),
      introChips: q<HTMLDivElement>("intro-chips"),
      card: q<HTMLButtonElement>("card"),
      cardEyebrow: q<HTMLSpanElement>("card-eyebrow"),
      cardTitle: q<HTMLSpanElement>("card-title"),
      cardSub: q<HTMLSpanElement>("card-sub"),
      cardStats: q<HTMLDivElement>("card-stats"),
      cardSubmit: q<HTMLButtonElement>("card-submit"),
      cardHint: q<HTMLSpanElement>("card-hint"),
      touchToggle: q<HTMLButtonElement>("touch-toggle"),
    };
    const fallback = el.querySelectorAll<HTMLElement>('[data-pfd="fallback"]');

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flight: FlightState = createRun(reduced);
    let bestRun: { result: RunResult; replay: string } | null = null;
    try {
      const saved = localStorage.getItem(BEST_KEY);
      if (saved !== null && Number.isFinite(Number(saved))) flight.best = Number(saved);
      const run = localStorage.getItem(BEST_RUN_KEY);
      if (run) bestRun = JSON.parse(run);
    } catch {}

    // --- Input ---------------------------------------------------------------------
    const input = {
      pointerX: 0,
      pointerY: 0,
      hoverSince: -1, // when the mouse entered the display (-1: not over it)
      engaged: false, // you have the controls (until you press A or go idle)
      lastInput: -Infinity,
      touchFlying: false,
      touching: false,
      stickX: 0, // filtered
      stickY: 0,
      throttleHeld: 0, // from on-screen buttons
      flaps: 0,
      retry: false,
    };
    const keys = new Set<string>();

    function engage(now: number) {
      input.lastInput = now;
      if (input.engaged) return;
      input.engaged = true;
      // Bumpless handoff: start the stick where the airplane already is.
      input.stickX = inverseStickCurve(Math.max(-1, Math.min(1, flight.roll / 40)));
      input.stickY = inverseStickCurve(Math.max(-1, Math.min(1, (flight.trimPitch - flight.pitch) / 16)));
      if (flight.apUsed && (flight.phase === "ap" || flight.phase === "manual")) {
        flight.toast = { text: "PRACTICE · PRESS R TO START A SCORED RUN", tone: "cyan", at: flight.time };
      }
    }

    function release(message?: string) {
      if (!input.engaged) return;
      input.engaged = false;
      input.touchFlying = false;
      parts.svt.style.touchAction = "";
      if (message) flight.toast = { text: message, tone: "cyan", at: flight.time };
    }

    function controls(now: number, dt: number): Controls {
      if (input.hoverSince >= 0 && now - input.hoverSince > ENGAGE_DELAY) engage(now);
      // Walk away for a while and the autopilot takes back over.
      if (input.engaged && input.hoverSince < 0 && !input.touching && now - input.lastInput > IDLE_RELEASE) {
        release("AUTOPILOT ENGAGED · YOU LET GO");
      }

      // Over the display (or touching it) the stick follows you; off it, the
      // stick eases back to neutral: wings level, nose on the horizon.
      let target = { x: 0, y: 0 };
      if (input.engaged && (input.hoverSince >= 0 || input.touching)) {
        const rect = parts.svt.getBoundingClientRect();
        target = {
          x: Math.max(-1, Math.min(1, (input.pointerX - (rect.left + rect.width / 2)) / (rect.width / 2))),
          y: Math.max(-1, Math.min(1, (input.pointerY - (rect.top + rect.height / 2)) / (rect.height / 2))),
        };
      }
      // Smooth the stick so a twitchy mouse still flies like silk.
      const k = 1 - Math.exp(-dt / 0.07);
      input.stickX += (target.x - input.stickX) * k;
      input.stickY += (target.y - input.stickY) * k;

      const up = keys.has("w") || keys.has("arrowup") ? 1 : 0;
      const down = keys.has("s") || keys.has("arrowdown") ? 1 : 0;
      const c: Controls = {
        stick: input.engaged ? { x: input.stickX, y: input.stickY } : null,
        throttle: Math.max(-1, Math.min(1, up - down + input.throttleHeld)),
        flaps: input.flaps,
        retry: input.retry,
      };
      input.flaps = 0;
      input.retry = false;
      return c;
    }

    // --- Rendering --------------------------------------------------------------------
    let svt: SvtScene | null = null;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let lastText = "";
    let lastCard = "";
    let lastIntro = "";
    let lastSecond = -1;
    let savedBest = flight.best;
    let resizeObserver: ResizeObserver | null = null;

    // Every run is recorded from brake release so a hand-flown landing can
    // be verified by the server (see replay.ts).
    let frames: Frame[] = [];
    let recording = true;
    let recordedRun = flight.resets;
    let pending: { replay: string } | null = null;
    function startRecording() {
      frames = [];
      recording = true;
      recordedRun = flight.resets;
      pending = null;
    }
    actionsRef.current = {
      flyAgain: () => {
        input.retry = true;
      },
    };

    // Development only: play a recorded run through the real loop, for testing.
    let scripted: Frame[] | null = null;
    let scriptedAt = 0;
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __pfd?: unknown }).__pfd = {
        play(data: string) {
          scripted = decode(data);
          scriptedAt = 0;
          Object.assign(flight, createRun(), { best: flight.best, resets: flight.resets + 1, time: flight.time });
          startRecording();
        },
      };
    }

    function renderCard(s: FlightState) {
      const over = (s.phase === "failed" || s.phase === "complete") && s.result !== null;
      const show = !holdRef.current && over;
      const key = show ? `${s.phase}|${s.resets}` : "hidden";
      if (key === lastCard) return;
      lastCard = key;
      parts.card.dataset.on = show ? "true" : "false";
      if (!show) return;
      const r = s.result!;
      const cells = (stats: [string, string][]) =>
        stats.map(([label, value]) => {
          const cell = document.createElement("div");
          cell.className = "flex flex-col gap-0.5";
          const l = document.createElement("span");
          l.className = "text-[9px] tracking-[.12em] text-dim md:text-[10px]";
          l.textContent = label;
          const v = document.createElement("span");
          v.className = "text-[13px] tabular-nums text-ink md:text-[14px]";
          v.textContent = value;
          cell.append(l, v);
          return cell;
        });
      if (s.phase === "failed" && s.failure) {
        parts.card.dataset.tone = "red";
        parts.cardEyebrow.textContent = `RUN OVER · LEVEL ${r.levelReached}`;
        parts.cardTitle.textContent = s.failure.title;
        parts.cardSub.textContent = s.failure.tip;
      } else {
        parts.card.dataset.tone = r.newBest ? "magenta" : "green";
        parts.cardEyebrow.textContent = "ALL TEN LANDED";
        parts.cardTitle.textContent = "RUN COMPLETE";
        parts.cardSub.textContent = "Checkride passed. That's the whole game.";
      }
      parts.cardStats.replaceChildren(
        ...cells([
          ["RUN SCORE", r.score.toLocaleString()],
          ["LEVELS", `${r.cleared}/${LEVEL_COUNT}`],
          ["BEST", s.best === null ? "—" : s.best.toLocaleString()],
        ]),
      );
      const canSubmit = r.ranked && r.score > 0;
      parts.cardSubmit.hidden = !canSubmit;
      parts.cardHint.textContent = r.newBest
        ? "NEW PERSONAL BEST"
        : !r.ranked && r.score > 0
          ? "AUTOPILOT FLEW PART OF THIS RUN · PRESS R FOR A RANKED ONE"
          : "";
      parts.cardHint.dataset.tone = r.newBest ? "magenta" : "amber";
    }

    function renderIntro(s: FlightState) {
      const key = s.phase === "intro" ? `${s.levelIndex}|${s.resets}` : "";
      if (key === lastIntro) return;
      lastIntro = key;
      parts.intro.dataset.on = key ? "true" : "false";
      if (!key) return;
      const level = LEVELS[s.levelIndex];
      parts.introLevel.textContent = `LEVEL ${level.number} / ${LEVEL_COUNT}`;
      parts.introName.textContent = level.name;
      const chips = [
        `${level.course.rings.length} RINGS · ${Math.round(level.ringRadius * 2)} FT`,
        level.wind ? `WIND ${String(level.windFrom).padStart(3, "0")}° ${level.wind}${level.gust ? `G${level.wind + level.gust}` : ""} KT` : "WIND CALM",
        `LAND BY ${level.landBy.toLocaleString()} FT`,
      ];
      parts.introChips.replaceChildren(
        ...chips.map((text) => {
          const chip = document.createElement("span");
          chip.className = "rounded-full bg-black/65 px-3 py-1 ring-1 ring-white/15";
          chip.textContent = text;
          return chip;
        }),
      );
    }

    function render(s: FlightState) {
      const r = readouts(s);
      parts.attitude.style.transform = `rotate(${-r.roll}deg) translateY(calc(var(--ppd) * ${r.pitch}))`;
      parts.rollPointer.style.transform = `rotate(${-r.roll}deg)`;
      parts.fpm.style.transform = `translate(-50%, -50%) translate(${r.drift * 3}px, calc(var(--ppd) * ${r.pitch - r.fpa}))`;
      parts.speedStrip.style.transform = `translateY(${s.ias * PPK}px)`;
      parts.lowSpeed.style.top = `${-r.stallSpeed * PPK}px`;
      parts.lowSpeed.style.height = `${r.stallSpeed * PPK}px`;
      parts.altStrip.style.transform = `translateY(${s.alt * PPF}px)`;
      parts.hdgStrip.style.transform = `translateX(${-(s.hdg + 180) * PPH}px)`;
      parts.speedTrend.style.height = `${Math.abs(r.speedTrend) * PPK}px`;
      parts.speedTrend.style.transform = r.speedTrend < 0 ? "scaleY(-1)" : "";
      parts.altTrend.style.height = `${Math.min(Math.abs(r.altTrend) * PPF, 140)}px`;
      parts.altTrend.style.transform = r.altTrend < 0 ? "scaleY(-1)" : "";
      parts.altBug.style.transform = `translateY(${Math.max(-400, Math.min(400, (s.alt - s.altSel) * PPF))}px)`;
      parts.vsiMarker.style.transform = `translateY(${Math.max(-1, Math.min(1, -s.vs / 2000)) * 46}%)`;
      const hdgDiff = ((s.hdgSel - s.hdg + 540) % 360) - 180;
      parts.hdgBug.style.transform = `translateX(${hdgDiff * PPH}px)`;
      parts.fade.style.opacity = String(s.fade);
      parts.pwrFill.style.transform = `scaleY(${s.throttle})`;
      parts.flapPointer.style.transform = `translateY(${(s.flaps / 30) * 100}%)`;

      svt?.update(s, r);
      renderCard(s);
      renderIntro(s);
      parts.windArrow.style.transform = `rotate(${r.windArrow}deg)`;

      // Text only changes a few times a second; skip DOM writes when equal.
      const showToast = s.phase !== "intro" && s.toast && s.time - s.toast.at < (s.toast.text.startsWith("RING") ? 1.4 : 2.6);
      const text = [
        r.iasText, r.altText, r.hdgText, r.vsText, modeLabel(s), s.phase, s.altSel, r.ringsText, s.levelIndex, s.runScore, r.windSpeed, r.windFrom,
        r.stallWarning, r.vfeWarning, r.overspeedWarning, r.terrainWarning,
        Math.round(s.throttle * 100), s.flapsCmd, s.best, input.touchFlying, showToast ? s.toast!.at : "", s.apUsed, s.airborne, Boolean(bestRun),
      ].join("|");
      if (text !== lastText) {
        lastText = text;
        parts.speedText.textContent = r.iasText;
        parts.gs.textContent = r.iasText;
        parts.altText.textContent = r.altText;
        parts.hdgText.textContent = `${r.hdgText}°`;
        parts.vsiText.textContent = r.vsText;
        parts.altSel.textContent = String(s.altSel);
        parts.gates.textContent = r.ringsText;
        parts.level.textContent = `${s.levelIndex + 1}/${LEVEL_COUNT}`;
        parts.runScore.textContent = s.runScore.toLocaleString();
        parts.windSpeed.textContent = r.windSpeed ? `${r.windSpeed}` : "CALM";
        parts.windFrom.textContent = r.windSpeed ? `${String(r.windFrom).padStart(3, "0")}°` : "";
        parts.windArrow.hidden = !r.windSpeed;
        parts.landBy.textContent = LEVELS[s.levelIndex].landBy.toLocaleString();
        parts.mode.textContent = modeLabel(s);
        parts.mode.dataset.mode = s.phase;
        parts.annStall.dataset.on = String(r.stallWarning);
        parts.annVfe.dataset.on = String(r.vfeWarning);
        parts.annOverspeed.dataset.on = String(r.overspeedWarning);
        parts.annTerrain.dataset.on = String(r.terrainWarning);
        parts.pwrText.textContent = `${Math.round(s.throttle * 100)}%`;
        parts.flapText.textContent = `${s.flapsCmd}°`;
        parts.best.textContent = s.best === null ? "—" : s.best.toLocaleString();
        parts.bestRank.textContent = s.best === null ? "PRESS R TO START A RUN" : bestRun ? "SUBMIT RECORD ›" : "BEST RUN";
        parts.bestPanel.disabled = !bestRun;
        const flying = s.phase === "manual" || (s.phase === "ap" && s.airborne);
        parts.runType.textContent = s.phase === "manual" ? (s.apUsed ? "PRACTICE" : "RANKED RUN") : "";
        parts.runType.dataset.kind = s.phase === "manual" && !s.apUsed ? "scored" : "practice";
        parts.runType.hidden = !flying || s.phase !== "manual";
        parts.touchToggle.textContent = input.touchFlying ? "AP" : "FLY";
        parts.touchToggle.dataset.on = String(input.touchFlying);
        if (showToast) {
          parts.toast.textContent = s.toast!.text;
          parts.toast.dataset.tone = s.toast!.tone;
        }
        parts.toast.dataset.on = showToast ? "true" : "false";
      }
      const now = new Date();
      if (now.getUTCSeconds() !== lastSecond) {
        lastSecond = now.getUTCSeconds();
        parts.utc.textContent = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(lastSecond).padStart(2, "0")}Z`;
      }

      if (s.best !== savedBest) {
        savedBest = s.best;
        try {
          if (s.best !== null) localStorage.setItem(BEST_KEY, String(s.best));
        } catch {}
      }
    }

    function frame(t: number) {
      // Clamp long gaps (tab switches, slow frames) so nothing ever jumps.
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      const c = controls(t, dt);
      // Test playback runs several recorded frames per screen frame; the
      // leaderboard panel pauses the sim entirely.
      const reps = holdRef.current ? 0 : scripted && scriptedAt < scripted.length ? 4 : 1;
      for (let i = 0; i < reps; i++) {
        const f = scripted && scriptedAt < scripted.length ? scripted[scriptedAt++] : quantize(dt, c);
        // Keep a ranked result on screen until you choose to submit or fly again.
        const resultUp = flight.result !== null && flight.result.ranked && flight.result.score > 0 && (flight.phase === "failed" || flight.phase === "complete");
        step(flight, f.dt, toControls(f, { retry: c.retry && !holdRef.current, hold: holdRef.current || resultUp }));
        if (flight.resets !== recordedRun) {
          // The run ended and reset during this step; record from the next one.
          startRecording();
        } else if (recording) {
          frames.push(f);
          if (flight.phase === "failed" || flight.phase === "complete" || frames.length > 150000) {
            recording = false;
            if (flight.result?.ranked && flight.result.score > 0) {
              pending = { replay: encode(frames) };
              // Keep your record run so you can submit it any time later.
              if (flight.result.newBest) {
                bestRun = { result: flight.result, replay: pending.replay };
                try {
                  localStorage.setItem(BEST_RUN_KEY, JSON.stringify(bestRun));
                } catch {}
              }
            }
          }
        }
      }
      render(flight);
      if (visible && !disposed) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (reduced || disposed) return;
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // Synthetic vision loads after the page is showing; until then (or if
    // WebGL isn't available) the classic blue-over-brown display is shown.
    import("./scene")
      .then(({ createScene }) => {
        if (disposed) return;
        try {
          svt = createScene(parts.svt);
        } catch {
          return;
        }
        const canvas = parts.svt.querySelector("canvas");
        canvas?.addEventListener("webglcontextlost", () => {
          parts.svt.dataset.ready = "false";
          fallback.forEach((f) => (f.style.opacity = "1"));
        });
        resizeObserver = new ResizeObserver(() => svt?.resize(parts.svt.clientWidth, parts.svt.clientHeight));
        resizeObserver.observe(parts.svt);
        svt.resize(parts.svt.clientWidth, parts.svt.clientHeight);
        render(flight);
        requestAnimationFrame(() => {
          parts.svt.dataset.ready = "true";
          fallback.forEach((f) => (f.style.opacity = "0"));
        });
      })
      .catch(() => {});

    render(flight);

    // --- Events --------------------------------------------------------------------------
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = parts.svt.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      input.pointerX = e.clientX;
      input.pointerY = e.clientY;
      if (inside) {
        if (input.hoverSince < 0) input.hoverSince = performance.now();
        if (input.engaged) input.lastInput = performance.now();
      } else {
        input.hoverSince = -1;
      }
    };
    const onLeaveWindow = () => {
      input.hoverSince = -1;
    };
    // Touch: once FLY is on, drag on the display to steer.
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !input.touchFlying) return;
      if ((e.target as HTMLElement).closest("button")) return;
      input.touching = e.type !== "pointerup" && e.type !== "pointercancel";
      input.pointerX = e.clientX;
      input.pointerY = e.clientY;
      input.lastInput = performance.now();
    };
    const armed = () => input.engaged || input.hoverSince >= 0 || visible;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = e.key.toLowerCase();
      if (!armed() || holdRef.current) return;
      const flightKeys = ["w", "s", "arrowup", "arrowdown", "f", "v", "r", "a", " "];
      if (!flightKeys.includes(key)) return;
      // Arrow keys and space only belong to the game while you're flying.
      if (["arrowup", "arrowdown", " "].includes(key)) {
        if (!input.engaged) return;
        e.preventDefault();
      }
      if (e.repeat) return;
      const now = performance.now();
      if (key === "a") {
        release("AUTOPILOT ENGAGED");
        return;
      }
      engage(now);
      keys.add(key);
      if (key === "f") input.flaps = 1;
      if (key === "v") input.flaps = -1;
      if (key === "r" || key === " ") {
        input.retry = true;
        // Mid-flight, R starts a fresh scored run from the runway.
        if (flight.phase === "manual" || flight.phase === "ap") {
          restart(flight);
          startRecording();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();

    // On-screen buttons (also how you fly on a phone).
    const holdHandlers: [HTMLElement, string, EventListener][] = [];
    el.querySelectorAll<HTMLButtonElement>("[data-hold]").forEach((b) => {
      const dir = Number(b.dataset.hold);
      const down = (e: Event) => {
        e.preventDefault();
        engage(performance.now());
        input.throttleHeld = dir;
        if ("pointerId" in e) b.setPointerCapture((e as PointerEvent).pointerId);
      };
      const up = () => {
        input.throttleHeld = 0;
      };
      for (const [type, fn] of [["pointerdown", down], ["pointerup", up], ["pointercancel", up], ["lostpointercapture", up]] as const) {
        b.addEventListener(type, fn);
        holdHandlers.push([b, type, fn]);
      }
    });
    const onClick = (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!button || !el.contains(button)) return;
      const action = button.dataset.action;
      if (action === "flaps-down" || action === "flaps-up") engage(performance.now());
      if (action === "flaps-down") input.flaps = 1;
      if (action === "flaps-up") input.flaps = -1;
      if (action === "retry") {
        engage(performance.now());
        input.retry = true;
      }
      if (action === "submit-best" && bestRun) {
        submitRef.current?.open(bestRun);
        lastCard = "";
      }
      if (action === "submit" && pending && flight.result) {
        submitRef.current?.open({ result: flight.result, replay: pending.replay });
        lastCard = "";
      }
      if (action === "touch-toggle") {
        if (input.touchFlying) {
          release("AUTOPILOT ENGAGED");
        } else {
          input.touchFlying = true;
          input.touching = false;
          parts.svt.style.touchAction = "none";
          engage(performance.now());
        }
      }
    };

    const touchTypes = ["pointerdown", "pointermove", "pointerup", "pointercancel"];
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    touchTypes.forEach((type) => parts.svt.parentElement!.addEventListener(type, onTouch as EventListener, { passive: true }));
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    el.addEventListener("click", onClick);

    // Pause when scrolled away or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible && !was) start();
    });
    io.observe(el);
    const onVisibility = () => {
      const was = visible;
      const rect = el.getBoundingClientRect();
      visible = document.visibilityState === "visible" && rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible && !was) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
      touchTypes.forEach((type) => parts.svt.parentElement?.removeEventListener(type, onTouch as EventListener));
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      el.removeEventListener("click", onClick);
      holdHandlers.forEach(([b, type, fn]) => b.removeEventListener(type, fn));
      document.removeEventListener("visibilitychange", onVisibility);
      svt?.dispose();
    };
  }, []);

  return (
    <div className="w-full max-w-[1100px]">
      <div
        ref={root}
        className="relative select-none overflow-hidden rounded-[30px] bg-[#1d1d1f] p-2 shadow-[0_0_0_1px_#3a3a3c,0_50px_140px_rgba(0,0,0,.85)] md:rounded-[36px] md:p-2.5"
        role="application"
        aria-label="Flight game on a working primary flight display. Hover over it to fly: the mouse is the yoke, W and S set power, F and V move the flaps, R retries."
      >
        <div className="flex flex-col overflow-hidden rounded-[22px] bg-black md:rounded-[27px]">
          {/* Top strip */}
          <div className="flex h-9 items-center gap-3 whitespace-nowrap border-b border-white/10 bg-[#0b0b0c] px-3 font-mono text-[10px] tracking-[.06em] text-dim sm:gap-4 sm:px-4 sm:text-[11px] md:h-10 md:gap-6 md:px-5 md:text-[12px]">
            <span className="flex items-center gap-2 text-ink">
              <LogoMark size={20} />
              <span className="hidden sm:inline">AA-PFD</span>
            </span>
            <span className="hidden md:inline">
              GS <span data-pfd="gs" className="text-ink">---</span>KT
            </span>
            <span>
              LVL <span data-pfd="level" className="text-cyan">1/{LEVEL_COUNT}</span>
            </span>
            <span className="hidden sm:inline">
              RINGS <span data-pfd="gates" className="text-magenta">0/{LEVELS[0].course.rings.length}</span>
            </span>
            <span className="hidden lg:inline">
              RUN <span data-pfd="run-score" className="text-ink">0</span>
            </span>
            <span
              data-pfd="run-type"
              data-kind="practice"
              hidden
              className="rounded-md px-2 py-0.5 font-bold data-[kind=practice]:bg-white/10 data-[kind=practice]:text-soft data-[kind=scored]:bg-magenta/15 data-[kind=scored]:text-magenta"
            />
            <span
              data-pfd="mode"
              data-mode="ap"
              className="mx-auto rounded-md px-2 py-0.5 font-bold text-green transition-colors data-[mode=failed]:bg-red/15 data-[mode=failed]:text-red data-[mode=manual]:bg-cyan/15 data-[mode=manual]:text-cyan"
            >
              TO/GA
            </span>
            <span className="whitespace-nowrap">
              LAND BY <span data-pfd="land-by" className="font-bold text-[#ff3b6b]">3,000</span>
              <span className="hidden sm:inline"> FT</span>
            </span>
            <span data-pfd="utc" className="hidden tabular-nums text-ink xl:inline">
              00:00:00Z
            </span>
          </div>

          {/* Attitude + tapes */}
          <div className="relative aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9]">
            <div className="absolute inset-0 overflow-hidden bg-[#3d86e6] [container-type:size]" style={{ ["--ppd" as string]: "2.6cqh" }}>
              {/* Synthetic vision (3D), fades in once loaded */}
              <div data-pfd="svt" data-ready="false" className="absolute inset-0 opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100" />

              {/* Sky / ground fallback + pitch ladder: rotates with roll, slides with pitch */}
              <div data-pfd="attitude" className="pointer-events-none absolute inset-0 will-change-transform">
                <div data-pfd="fallback" className="absolute -inset-x-[150%] -top-[150%] bottom-1/2 bg-[linear-gradient(to_bottom,#0b3a86_0%,#1f63c4_70%,#3d86e6_100%)] transition-opacity duration-700" />
                <div data-pfd="fallback" className="absolute -inset-x-[150%] -bottom-[150%] top-1/2 bg-[linear-gradient(to_bottom,#7a4a22_0%,#5b3518_30%,#3b220f_100%)] transition-opacity duration-700" />
                <div className="absolute -inset-x-[150%] top-1/2 h-[2px] -translate-y-1/2 bg-white/90" />
                {PITCH_LINES.map((deg) => {
                  const major = deg % 10 === 0;
                  const mid = !major && deg % 5 === 0;
                  return (
                    <div
                      key={deg}
                      className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 font-mono text-[11px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]"
                      style={{ top: `calc(50% - var(--ppd) * ${deg})` }}
                    >
                      {major && <span className="w-5 text-right">{Math.abs(deg)}</span>}
                      <span className={`block h-[2px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.5)] ${major ? "w-28 md:w-36" : mid ? "w-14 md:w-16" : "w-7"}`} />
                      {major && <span className="w-5">{Math.abs(deg)}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Roll scale (fixed) + pointer (rotates with bank) */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                {ROLL_TICKS.map((deg) => (
                  <div key={deg} className="absolute left-0 top-0 origin-top" style={{ transform: `rotate(${deg}deg) translateY(calc(var(--ppd) * -15))` }}>
                    {deg === 0 ? (
                      <div className="-ml-[7px] -mt-3 h-0 w-0 border-x-[7px] border-t-[11px] border-x-transparent border-t-white" />
                    ) : (
                      <div className={`-ml-px w-[2px] bg-white ${Math.abs(deg) % 30 === 0 ? "-mt-4 h-4" : "-mt-2.5 h-2.5"}`} />
                    )}
                  </div>
                ))}
                <div data-pfd="roll-pointer" className="absolute left-0 top-0">
                  <div className="-ml-[7px] h-0 w-0 border-x-[7px] border-b-[11px] border-x-transparent border-b-white" style={{ transform: "translateY(calc(var(--ppd) * -15 + 3px))" }} />
                </div>
              </div>

              {/* Aircraft reference symbol */}
              <svg
                aria-hidden
                viewBox="0 0 240 40"
                className="pointer-events-none absolute left-1/2 top-1/2 w-[46%] max-w-[300px] -translate-x-1/2 -translate-y-[30%] drop-shadow-[0_2px_2px_rgba(0,0,0,.6)]"
              >
                <path d="M0 10 H78 L120 32 L162 10 H240" fill="none" stroke="#000" strokeWidth="9" strokeLinejoin="round" />
                <path d="M0 10 H78 L120 32 L162 10 H240" fill="none" stroke="#facc15" strokeWidth="5" strokeLinejoin="round" />
              </svg>

              {/* Flight path marker: the logo, showing where you're actually going */}
              <div data-pfd="fpm" className="pointer-events-none absolute left-1/2 top-1/2 will-change-transform" style={{ transform: "translate(-50%, -50%)" }}>
                <LogoMark size={44} className="text-green drop-shadow-[0_0_6px_rgba(0,0,0,.8)]" />
              </div>

              {/* Speed tape */}
              <div className="pointer-events-none absolute left-3 top-[40%] h-[48%] w-[58px] -translate-y-1/2 md:left-6 md:top-[43%] md:h-[56%] md:w-[84px]">
                <div className="absolute inset-0 overflow-hidden rounded-lg bg-black/45 ring-1 ring-white/15 backdrop-blur-[2px]">
                  <div data-pfd="speed-strip" className="absolute inset-x-0 top-1/2 h-0 will-change-transform" style={{ transform: `translateY(${INITIAL.ias * PPK}px)` }}>
                    {SPEEDS.map((v) => (
                      <div key={v} className="absolute right-0 flex -translate-y-1/2 items-center gap-1.5 font-mono text-[13px] text-white md:text-[15px]" style={{ top: -v * PPK }}>
                        {v >= 20 && v % 20 === 0 ? <span>{v}</span> : null}
                        <span className={`block h-[2px] bg-white ${v % 20 === 0 ? "w-3" : "w-2"}`} />
                      </div>
                    ))}
                    {/* Airspeed color bands (Cessna 172-style) */}
                    <div className="absolute right-0 w-1 bg-white" style={{ top: -85 * PPK, height: 45 * PPK }} />
                    <div className="absolute right-1 w-1 bg-green" style={{ top: -129 * PPK, height: 81 * PPK }} />
                    <div className="absolute right-1 w-1 bg-amber" style={{ top: -163 * PPK, height: 34 * PPK }} />
                    <div className="absolute right-0 w-2 bg-red" style={{ top: -220 * PPK, height: 57 * PPK }} />
                    {/* Low-speed awareness: red below the current stall speed */}
                    <div data-pfd="low-speed" className="absolute right-0 w-2 bg-[repeating-linear-gradient(to_bottom,#f87171_0_6px,#7f1d1d_6px_12px)]" style={{ top: -48 * PPK, height: 48 * PPK }} />
                  </div>
                  <div data-pfd="speed-trend" className="absolute bottom-1/2 right-2.5 w-[3px] origin-bottom bg-magenta" />
                </div>
                <div className="absolute left-0 right-3 top-1/2 flex h-10 -translate-y-1/2 items-center justify-end rounded-md border-2 border-white bg-black pr-2 font-mono text-[19px] font-bold tabular-nums text-white md:text-[24px]">
                  <span data-pfd="speed-text">---</span>
                </div>
                <span className="absolute -bottom-6 left-0 font-mono text-[11px] text-dim">KT</span>
              </div>

              {/* Altitude tape + VSI */}
              <div className="pointer-events-none absolute right-3 top-[40%] flex h-[48%] -translate-y-1/2 gap-1 md:right-6 md:top-[43%] md:h-[56%]">
                <div className="relative w-[66px] md:w-[96px]">
                  <div className="absolute -top-8 left-0 right-0 rounded-md bg-black/60 px-2 py-1 text-center font-mono text-[12px] text-cyan ring-1 ring-cyan/40 md:text-[13px]">
                    <span data-pfd="alt-sel">{INITIAL.altSel}</span>
                  </div>
                  <div className="absolute inset-0 overflow-hidden rounded-lg bg-black/45 ring-1 ring-white/15 backdrop-blur-[2px]">
                    <div data-pfd="alt-strip" className="absolute inset-x-0 top-1/2 h-0 will-change-transform" style={{ transform: `translateY(${INITIAL.alt * PPF}px)` }}>
                      {ALTS.map((v) => (
                        <div key={v} className="absolute left-0 flex -translate-y-1/2 items-center gap-1.5 font-mono text-[13px] text-white md:text-[15px]" style={{ top: -v * PPF }}>
                          <span className={`block h-[2px] bg-white ${v % 500 === 0 ? "w-3" : "w-2"}`} />
                          {v % 200 === 0 ? <span>{v}</span> : null}
                        </div>
                      ))}
                    </div>
                    <div data-pfd="alt-bug" className="absolute left-0 top-1/2 h-0 will-change-transform" style={{ transform: `translateY(${(INITIAL.alt - INITIAL.altSel) * PPF}px)` }}>
                      <div className="-mt-2.5 h-5 w-2 rounded-r-sm bg-cyan" />
                    </div>
                    <div data-pfd="alt-trend" className="absolute bottom-1/2 left-2.5 w-[3px] origin-bottom bg-magenta" />
                  </div>
                  <div className="absolute left-3 right-0 top-1/2 flex h-10 -translate-y-1/2 items-center rounded-md border-2 border-white bg-black pl-2 font-mono text-[17px] font-bold tabular-nums text-white md:text-[22px]">
                    <span data-pfd="alt-text">{INITIAL.alt}</span>
                  </div>
                  <span className="absolute -bottom-6 right-0 font-mono text-[11px] text-dim">FT</span>
                </div>
                <div className="relative hidden w-7 overflow-hidden rounded-lg bg-black/45 ring-1 ring-white/15 sm:block">
                  {[-2, -1, 0, 1, 2].map((k) => (
                    <div key={k} className="absolute left-1 h-[2px] w-2 bg-white" style={{ top: `${50 + k * 23}%` }} />
                  ))}
                  <div data-pfd="vsi-marker" className="absolute inset-x-0 top-1/2 h-0">
                    <div className="-mt-[5px] ml-auto h-0 w-0 border-y-[5px] border-r-[9px] border-y-transparent border-r-white" />
                  </div>
                </div>
                <span data-pfd="vsi-text" className="absolute -bottom-6 right-0 hidden font-mono text-[11px] text-ink sm:block" />
              </div>

              {/* Heading tape */}
              <div className="pointer-events-none absolute bottom-3 left-1/2 hidden h-11 w-[34%] -translate-x-1/2 overflow-hidden rounded-lg bg-black/55 ring-1 ring-white/15 sm:block md:bottom-6">
                <div data-pfd="hdg-strip" className="absolute left-1/2 top-0 h-full w-0 will-change-transform" style={{ transform: `translateX(${-(INITIAL.hdg + 180) * PPH}px)` }}>
                  {HEADINGS.map((d) => (
                    <div key={d} className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ left: (d + 180) * PPH }}>
                      <span className={`block w-[2px] bg-white ${d % 30 === 0 ? "h-3" : "h-2"}`} />
                      <span className="font-mono text-[12px] font-bold text-white">{headingLabel(d)}</span>
                    </div>
                  ))}
                </div>
                <div data-pfd="hdg-bug" className="absolute left-1/2 top-0 will-change-transform">
                  <div className="-ml-2 h-2 w-4 rounded-b-sm bg-cyan" />
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-[56px] left-1/2 hidden -translate-x-1/2 rounded-md border-2 border-white bg-black px-2 py-0.5 font-mono text-[15px] font-bold tabular-nums text-white sm:block md:bottom-[72px] md:text-[17px]">
                <span data-pfd="hdg-text">090°</span>
              </div>

              {/* Power + flaps: the airplane's real controls */}
              <div className="absolute bottom-3 left-3 flex items-stretch gap-1.5 rounded-xl bg-black/60 p-1.5 font-mono ring-1 ring-white/15 backdrop-blur md:bottom-6 md:left-6 md:gap-2 md:p-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] tracking-[.12em] text-dim md:text-[10px]">PWR</span>
                  <div className="relative h-12 w-2.5 overflow-hidden rounded-full bg-white/10 md:h-16">
                    <div data-pfd="pwr-fill" className="absolute inset-0 origin-bottom bg-green" style={{ transform: `scaleY(${INITIAL.throttle})` }} />
                  </div>
                  <span data-pfd="pwr-text" className="text-[10px] tabular-nums text-ink md:text-[11px]">
                    100%
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" data-hold="1" aria-label="More power (W)" className="pfd-key">
                    +
                  </button>
                  <button type="button" data-hold="-1" aria-label="Less power (S)" className="pfd-key">
                    −
                  </button>
                </div>
                <div className="mx-0.5 w-px bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] tracking-[.12em] text-dim md:text-[10px]">FLAPS</span>
                  <div className="relative h-12 w-7 md:h-16">
                    {[0, 10, 20, 30].map((f) => (
                      <span key={f} className="absolute left-0 -translate-y-1/2 text-[8px] text-dim md:text-[9px]" style={{ top: `${(f / 30) * 100}%` }}>
                        {f}
                      </span>
                    ))}
                    <div className="absolute inset-y-0 right-0 w-0">
                      <div data-pfd="flap-pointer" className="absolute inset-x-0 top-0 h-full will-change-transform">
                        <div className="-ml-2 -mt-[5px] h-0 w-0 border-y-[5px] border-r-[8px] border-y-transparent border-r-cyan" />
                      </div>
                    </div>
                  </div>
                  <span data-pfd="flap-text" className="text-[10px] tabular-nums text-ink md:text-[11px]">
                    0°
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" data-action="flaps-up" aria-label="Flaps up (V)" className="pfd-key">
                    ▲
                  </button>
                  <button type="button" data-action="flaps-down" aria-label="Flaps down (F)" className="pfd-key">
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  data-pfd="touch-toggle"
                  data-action="touch-toggle"
                  data-on="false"
                  className="pfd-key hidden !h-auto !w-12 self-stretch text-[11px] tracking-[.08em] data-[on=true]:!bg-cyan data-[on=true]:!text-black [@media(pointer:coarse)]:flex"
                >
                  FLY
                </button>
              </div>

              {/* Personal best */}
              <button
                type="button"
                data-pfd="best-panel"
                data-action="submit-best"
                disabled
                className="absolute bottom-3 right-3 hidden flex-col items-end rounded-xl bg-black/60 px-3 py-2 text-right font-mono ring-1 ring-white/15 backdrop-blur transition enabled:cursor-pointer enabled:hover:ring-magenta sm:flex md:bottom-6 md:right-6"
              >
                <span className="text-[9px] tracking-[.12em] text-dim md:text-[10px]">PERSONAL BEST</span>
                <span data-pfd="best" className="font-display text-xl font-semibold tabular-nums md:text-2xl">
                  —
                </span>
                <span data-pfd="best-rank" className="text-[9px] tracking-[.1em] text-magenta md:text-[10px]">
                  PRESS R FOR A SCORED RUN
                </span>
              </button>

              {/* Wind: an arrow showing where it's blowing, relative to your nose */}
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-black/60 px-2.5 py-2 font-mono ring-1 ring-white/15 backdrop-blur md:left-6 md:top-4 md:gap-3 md:px-3">
                <div className="relative h-9 w-9 rounded-full ring-1 ring-white/20 md:h-11 md:w-11">
                  <div data-pfd="wind-arrow" className="absolute inset-0 flex items-center justify-center will-change-transform">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 md:h-8 md:w-8" aria-hidden>
                      <path d="M12 3 L17 10 H13.5 V21 H10.5 V10 H7 Z" fill="#22d3ee" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[9px] tracking-[.12em] text-dim md:text-[10px]">WIND</span>
                  <span className="text-[15px] font-bold tabular-nums text-ink md:text-[17px]">
                    <span data-pfd="wind-speed">CALM</span>
                    <span className="ml-1 text-[10px] text-dim">KT</span>
                  </span>
                  <span data-pfd="wind-from" className="text-[10px] tabular-nums text-dim" />
                </div>
              </div>

              {/* Level intro */}
              <div
                data-pfd="intro"
                data-on="false"
                className="pointer-events-none absolute inset-x-0 top-[22%] z-10 flex flex-col items-center gap-2 px-4 text-center opacity-0 transition-[opacity,transform] duration-300 data-[on=false]:-translate-y-2 data-[on=true]:opacity-100"
              >
                <span data-pfd="intro-level" className="font-mono text-[12px] font-bold tracking-[.2em] text-cyan [text-shadow:0_1px_8px_rgba(0,0,0,.8)] md:text-sm" />
                <span data-pfd="intro-name" className="font-display text-[34px] font-bold leading-none tracking-[-.03em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,.7)] md:text-[56px]" />
                <div data-pfd="intro-chips" className="mt-1 flex flex-wrap justify-center gap-1.5 font-mono text-[10px] tracking-[.08em] text-white backdrop-blur-sm md:text-[12px]" />
              </div>

              {/* Annunciations: amber is caution, red is warning */}
              <div className="pointer-events-none absolute left-1/2 top-[29%] flex -translate-x-1/2 flex-col items-center gap-1.5 font-mono text-[13px] font-bold tracking-[.14em] md:text-base">
                <div data-pfd="ann-terrain" data-on="false" className="pfd-ann bg-red text-black">
                  PULL UP
                </div>
                <div data-pfd="ann-stall" data-on="false" className="pfd-ann bg-red text-black">
                  STALL
                </div>
                <div data-pfd="ann-overspeed" data-on="false" className="pfd-ann bg-amber text-black">
                  OVERSPEED
                </div>
                <div data-pfd="ann-vfe" data-on="false" className="pfd-ann bg-amber text-black">
                  FLAP SPEED
                </div>
              </div>

              {/* Messages: gates, autopilot */}
              <div
                data-pfd="toast"
                data-on="false"
                aria-live="polite"
                className="pointer-events-none absolute left-1/2 top-[19%] -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-black/65 px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-[.1em] opacity-0 backdrop-blur transition-[opacity,transform] duration-300 data-[on=true]:translate-y-0 data-[on=true]:opacity-100 data-[tone=amber]:text-amber data-[tone=cyan]:text-cyan data-[tone=green]:text-green data-[tone=red]:text-red md:text-[14px]"
              />

              {/* Result / failure card */}
              <div
                data-pfd="card"
                data-on="false"
                data-tone="green"
                aria-live="assertive"
                className="group pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[90%] max-w-[440px] -translate-x-1/2 -translate-y-[46%] scale-95 flex-col items-center gap-2 rounded-2xl bg-black/80 px-5 py-4 text-center opacity-0 shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-[opacity,transform] duration-300 data-[on=true]:pointer-events-auto data-[on=true]:-translate-y-1/2 data-[on=true]:scale-100 data-[on=true]:opacity-100 md:gap-2.5 md:px-7 md:py-6"
              >
                <span data-pfd="card-eyebrow" className="font-mono text-[10px] tracking-[.16em] text-dim md:text-[11px]" />
                <span
                  data-pfd="card-title"
                  className="font-display text-[34px] font-bold leading-none tracking-[-.03em] tabular-nums group-data-[tone=green]:text-green group-data-[tone=magenta]:text-magenta group-data-[tone=red]:text-red md:text-[46px]"
                />
                <span data-pfd="card-sub" className="max-w-[360px] text-[13px] leading-snug text-soft md:text-[15px]" />
                <div data-pfd="card-stats" className="grid w-full grid-cols-3 gap-x-2 gap-y-2.5 border-t border-white/10 pt-3 font-mono empty:hidden" />
                <span data-pfd="card-hint" data-tone="amber" className="font-mono text-[10px] tracking-[.1em] text-amber empty:hidden data-[tone=magenta]:text-magenta" />
                <div className="mt-1 flex w-full gap-2">
                  <button type="button" data-pfd="card-submit" data-action="submit" hidden className="btn btn-primary btn-sm flex-1 !text-[13px]">
                    Enter leaderboard
                  </button>
                  <button type="button" data-action="retry" className="btn btn-ghost btn-sm flex-1 !text-[13px]">
                    Fly again <span className="ml-1 font-mono text-[11px] text-dim">R</span>
                  </button>
                </div>
              </div>

              <ScoreSubmit
                apiRef={submitRef}
                holdRef={holdRef}
                onClose={(flyAgain) => {
                  if (flyAgain) actionsRef.current?.flyAgain();
                }}
              />

              {/* Reset fade */}
              <div data-pfd="fade" className="pointer-events-none absolute inset-0 bg-black opacity-0" />
            </div>
          </div>

          {/* Softkeys: these actually navigate */}
          <nav aria-label="Flight display" className="grid grid-cols-3 gap-1.5 border-t border-white/10 bg-[#0b0b0c] p-2 sm:grid-cols-6">
            {[
              { href: "/#sessions", label: "SESSIONS", className: "" },
              { href: "/#oral", label: "MOCK ORAL", className: "hidden sm:flex" },
              { href: "/library", label: "LIBRARY", className: "" },
              { href: "/#about", label: "ABOUT", className: "hidden sm:flex" },
              { href: "/login", label: "PREFLIGHT", className: "hidden sm:flex" },
              { href: "/book", label: "BOOK", className: "!border-t-cyan text-cyan" },
            ].map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className={`flex items-center justify-center rounded-lg border border-white/10 border-t-[3px] border-t-white/25 bg-[#161618] py-2.5 font-mono text-[11px] tracking-[.08em] text-soft transition hover:border-t-cyan hover:bg-[#1d1d1f] hover:text-ink active:scale-[.97] md:text-[12px] ${k.className}`}
              >
                {k.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2 text-center font-mono text-[11px] tracking-[.1em] text-dim md:text-[12px]">
        <p className="hidden md:block">
          <span className="text-ink">R</span> NEW RUN · <span className="text-ink">MOUSE</span> YOKE · <span className="text-ink">W/S</span> POWER ·{" "}
          <span className="text-ink">F/V</span> FLAPS · <span className="text-ink">A</span> AUTOPILOT
        </p>
        <p className="md:hidden">TAP FLY · DRAG TO STEER · BUTTONS FOR POWER &amp; FLAPS</p>
        <p className="max-w-[640px] text-[10px] leading-relaxed md:text-[11px]">
          TEN LANDINGS IN A ROW. THE RINGS SHRINK, THE WIND BUILDS AND THE LAND-BY LINE CREEPS TOWARD YOU. MISS A RING, LAND PAST THE LINE OR BREAK A LIMIT AND IT&apos;S BACK TO LEVEL 1.
        </p>
      </div>
    </div>
  );
}
