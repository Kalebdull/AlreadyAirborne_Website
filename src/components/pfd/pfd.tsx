"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/logo";
import { createFlight, MAX_TOUCHDOWN_KT, modeLabel, RANKS, readouts, step, type Controls, type FlightState } from "./flight-model";
import type { SvtScene } from "./scene";
import { GATES } from "./world";

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
const INITIAL = createFlight(); // first frame, rendered on the server
const PITCH_LINES = Array.from({ length: 25 }, (_, i) => (i - 12) * 2.5).filter((d) => d !== 0);
const ROLL_TICKS = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];

const ENGAGE_DELAY = 250; // ms hovering before you take the controls
const RELEASE_DELAY = 700; // ms after leaving before the autopilot takes back over
const BEST_KEY = "aa-pfd-best-v1";

function headingLabel(deg: number) {
  const h = ((deg % 360) + 360) % 360;
  return ({ 0: "N", 90: "E", 180: "S", 270: "W" } as Record<number, string>)[h] ?? (h % 30 === 0 ? String(h / 10) : "");
}

function rankFor(distance: number) {
  return RANKS.find(([max]) => distance <= max)![1];
}

export function Pfd() {
  const root = useRef<HTMLDivElement>(null);

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
      bestRank: q<HTMLSpanElement>("best-rank"),
      card: q<HTMLButtonElement>("card"),
      cardEyebrow: q<HTMLSpanElement>("card-eyebrow"),
      cardTitle: q<HTMLSpanElement>("card-title"),
      cardSub: q<HTMLSpanElement>("card-sub"),
      cardStats: q<HTMLDivElement>("card-stats"),
      touchToggle: q<HTMLButtonElement>("touch-toggle"),
    };
    const fallback = el.querySelectorAll<HTMLElement>('[data-pfd="fallback"]');

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flight: FlightState = createFlight(reduced);
    try {
      const saved = localStorage.getItem(BEST_KEY);
      if (saved !== null && Number.isFinite(Number(saved))) flight.best = Number(saved);
    } catch {}

    // --- Input ---------------------------------------------------------------------
    const input = {
      pointerX: 0,
      pointerY: 0,
      hoverSince: -1, // when the mouse entered the display
      leftAt: -Infinity, // when it last left
      touchFlying: false,
      touching: false,
      stickX: 0, // filtered
      stickY: 0,
      throttleHeld: 0, // from on-screen buttons
      flaps: 0,
      retry: false,
    };
    const keys = new Set<string>();

    function wantsControl(now: number) {
      if (input.touchFlying) return true;
      if (input.hoverSince >= 0) return now - input.hoverSince > ENGAGE_DELAY;
      return now - input.leftAt < RELEASE_DELAY;
    }

    function controls(now: number, dt: number): Controls {
      const flying = wantsControl(now);
      let target = { x: 0, y: 0 };
      if (flying && (input.hoverSince >= 0 || input.touching)) {
        const rect = parts.svt.getBoundingClientRect();
        target = {
          x: Math.max(-1, Math.min(1, (input.pointerX - (rect.left + rect.width / 2)) / (rect.width / 2))),
          y: Math.max(-1, Math.min(1, (input.pointerY - (rect.top + rect.height / 2)) / (rect.height / 2))),
        };
      }
      // Low-pass the stick so a twitchy mouse still flies smoothly.
      const k = 1 - Math.exp(-dt / 0.09);
      input.stickX += (target.x - input.stickX) * k;
      input.stickY += (target.y - input.stickY) * k;

      const up = keys.has("w") || keys.has("arrowup") ? 1 : 0;
      const down = keys.has("s") || keys.has("arrowdown") ? 1 : 0;
      const c: Controls = {
        stick: flying ? { x: input.stickX, y: input.stickY } : null,
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
    let lastSecond = -1;
    let savedBest = flight.best;
    let resizeObserver: ResizeObserver | null = null;

    function renderCard(s: FlightState) {
      const show = s.phase === "failed" || ((s.phase === "landed" || s.phase === "rollout") && s.result !== null);
      const key = show ? `${s.phase === "failed" ? "f" : "r"}|${s.resets}` : "";
      if (key === lastCard) return;
      lastCard = key;
      parts.card.dataset.on = show ? "true" : "false";
      if (!show) return;
      if (s.phase === "failed" && s.failure) {
        parts.card.dataset.tone = "red";
        parts.cardEyebrow.textContent = "RUN OVER";
        parts.cardTitle.textContent = s.failure.title;
        parts.cardSub.textContent = s.failure.tip;
        parts.cardStats.replaceChildren();
        return;
      }
      const r = s.result!;
      parts.card.dataset.tone = r.newBest ? "magenta" : "green";
      parts.cardEyebrow.textContent = r.newBest ? "NEW PERSONAL BEST" : r.ranked ? "LANDED" : "AUTOPILOT LANDING · NOT RANKED";
      parts.cardTitle.textContent = r.rank;
      parts.cardSub.textContent = `${r.distance.toLocaleString()} ft past the threshold`;
      const stats: [string, string][] = [
        ["SINK", `${r.sink} FPM`],
        ["SPEED", `${r.speed} KT`],
        ["GATES", `${r.gates}/${GATES.length}`],
        ["BEST", s.best === null ? "—" : `${s.best.toLocaleString()} FT`],
      ];
      parts.cardStats.replaceChildren(
        ...stats.map(([label, value]) => {
          const cell = document.createElement("div");
          cell.className = "flex flex-col gap-0.5";
          const l = document.createElement("span");
          l.className = "text-[10px] tracking-[.12em] text-dim";
          l.textContent = label;
          const v = document.createElement("span");
          v.className = "text-[13px] text-ink md:text-[15px]";
          v.textContent = value;
          cell.append(l, v);
          return cell;
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

      // Text only changes a few times a second; skip DOM writes when equal.
      const showToast = s.toast && s.time - s.toast.at < (s.toast.text.startsWith("GATE") ? 1.4 : 3.2);
      const text = [
        r.iasText, r.altText, r.hdgText, r.vsText, modeLabel(s), s.phase, s.altSel, r.gatesText,
        r.stallWarning, r.vfeWarning, r.overspeedWarning, r.terrainWarning,
        Math.round(s.throttle * 100), s.flapsCmd, s.best, input.touchFlying, showToast ? s.toast!.at : "",
      ].join("|");
      if (text !== lastText) {
        lastText = text;
        parts.speedText.textContent = r.iasText;
        parts.gs.textContent = r.iasText;
        parts.altText.textContent = r.altText;
        parts.hdgText.textContent = `${r.hdgText}°`;
        parts.vsiText.textContent = r.vsText;
        parts.altSel.textContent = String(s.altSel);
        parts.gates.textContent = r.gatesText;
        parts.mode.textContent = modeLabel(s);
        parts.mode.dataset.mode = s.phase;
        parts.annStall.dataset.on = String(r.stallWarning);
        parts.annVfe.dataset.on = String(r.vfeWarning);
        parts.annOverspeed.dataset.on = String(r.overspeedWarning);
        parts.annTerrain.dataset.on = String(r.terrainWarning);
        parts.pwrText.textContent = `${Math.round(s.throttle * 100)}%`;
        parts.flapText.textContent = `${s.flapsCmd}°`;
        parts.best.textContent = s.best === null ? "—" : `${s.best.toLocaleString()} FT`;
        parts.bestRank.textContent = s.best === null ? "LAND TO SET A SCORE" : rankFor(s.best);
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
      step(flight, dt, controls(t, dt));
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
      if (inside && input.hoverSince < 0) input.hoverSince = performance.now();
      if (!inside && input.hoverSince >= 0) {
        input.hoverSince = -1;
        input.leftAt = performance.now();
      }
    };
    const onLeaveWindow = () => {
      if (input.hoverSince >= 0) {
        input.hoverSince = -1;
        input.leftAt = performance.now();
      }
    };
    // Touch: once FLY is on, drag on the display to steer.
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !input.touchFlying) return;
      if ((e.target as HTMLElement).closest("button")) return;
      input.touching = e.type !== "pointerup" && e.type !== "pointercancel";
      input.pointerX = e.clientX;
      input.pointerY = e.clientY;
    };
    const armed = () => input.touchFlying || input.hoverSince >= 0 || flight.phase === "manual";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = e.key.toLowerCase();
      const over = flight.phase === "failed" || flight.phase === "landed";
      if (!armed() && !(key === "r" && over)) return;
      if (["arrowup", "arrowdown", " "].includes(key)) e.preventDefault();
      if (e.repeat) return;
      keys.add(key);
      if (key === "f") input.flaps = 1;
      if (key === "v") input.flaps = -1;
      if (key === "r" || key === " ") input.retry = true;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();

    // On-screen buttons (also how you fly on a phone).
    const holdHandlers: [HTMLElement, string, EventListener][] = [];
    el.querySelectorAll<HTMLButtonElement>("[data-hold]").forEach((b) => {
      const dir = Number(b.dataset.hold);
      const down = (e: Event) => {
        e.preventDefault();
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
      if (action === "flaps-down") input.flaps = 1;
      if (action === "flaps-up") input.flaps = -1;
      if (action === "retry") input.retry = true;
      if (action === "touch-toggle") {
        input.touchFlying = !input.touchFlying;
        input.touching = false;
        parts.svt.style.touchAction = input.touchFlying ? "none" : "";
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
          <div className="flex h-9 items-center gap-4 border-b border-white/10 bg-[#0b0b0c] px-4 font-mono text-[11px] tracking-[.06em] text-dim md:h-10 md:gap-6 md:px-5 md:text-[12px]">
            <span className="flex items-center gap-2 text-ink">
              <LogoMark size={20} />
              <span className="hidden sm:inline">AA-PFD</span>
            </span>
            <span className="hidden md:inline">
              GS <span data-pfd="gs" className="text-ink">---</span>KT
            </span>
            <span>
              GATES <span data-pfd="gates" className="text-magenta">0/{GATES.length}</span>
            </span>
            <span
              data-pfd="mode"
              data-mode="ap"
              className="mx-auto rounded-md px-2 py-0.5 font-bold text-green transition-colors data-[mode=failed]:bg-red/15 data-[mode=failed]:text-red data-[mode=manual]:bg-cyan/15 data-[mode=manual]:text-cyan"
            >
              TO/GA
            </span>
            <span data-pfd="utc" className="hidden tabular-nums text-ink sm:inline">
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
              <div className="pointer-events-none absolute bottom-3 right-3 hidden flex-col items-end rounded-xl bg-black/60 px-3 py-2 font-mono ring-1 ring-white/15 backdrop-blur sm:flex md:bottom-6 md:right-6">
                <span className="text-[9px] tracking-[.12em] text-dim md:text-[10px]">SHORTEST LANDING</span>
                <span data-pfd="best" className="font-display text-xl font-semibold tabular-nums md:text-2xl">
                  —
                </span>
                <span data-pfd="best-rank" className="text-[9px] tracking-[.1em] text-magenta md:text-[10px]">
                  LAND TO SET A SCORE
                </span>
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
              <button
                type="button"
                data-pfd="card"
                data-action="retry"
                data-on="false"
                data-tone="green"
                aria-live="assertive"
                className="group pointer-events-none absolute left-1/2 top-1/2 flex w-[86%] max-w-[420px] -translate-x-1/2 -translate-y-[46%] scale-95 flex-col items-center gap-2 rounded-2xl bg-black/75 px-6 py-5 text-center opacity-0 shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-[opacity,transform] duration-300 data-[on=true]:pointer-events-auto data-[on=true]:-translate-y-1/2 data-[on=true]:scale-100 data-[on=true]:opacity-100 md:gap-3 md:px-8 md:py-6"
              >
                <span data-pfd="card-eyebrow" className="font-mono text-[10px] tracking-[.16em] text-dim md:text-[11px]" />
                <span
                  data-pfd="card-title"
                  className="font-display text-[28px] font-bold leading-none tracking-[-.02em] group-data-[tone=green]:text-green group-data-[tone=magenta]:text-magenta group-data-[tone=red]:text-red md:text-[40px]"
                />
                <span data-pfd="card-sub" className="max-w-[340px] text-[13px] leading-snug text-soft md:text-[15px]" />
                <div data-pfd="card-stats" className="grid w-full grid-cols-4 gap-2 border-t border-white/10 pt-3 font-mono empty:hidden" />
                <span className="font-mono text-[10px] tracking-[.14em] text-cyan md:text-[11px]">PRESS R OR TAP TO FLY AGAIN</span>
              </button>

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
          HOVER TO FLY · <span className="text-ink">MOUSE</span> YOKE · <span className="text-ink">W/S</span> POWER · <span className="text-ink">F/V</span> FLAPS ·{" "}
          <span className="text-ink">R</span> RETRY
        </p>
        <p className="md:hidden">TAP FLY · DRAG TO STEER · BUTTONS FOR POWER &amp; FLAPS</p>
        <p className="max-w-[640px] text-[10px] leading-relaxed md:text-[11px]">
          FLY THE MAGENTA GATES, THEN LAND AS CLOSE TO THE THRESHOLD AS YOU CAN: UNDER {MAX_TOUCHDOWN_KT} KT, GENTLE, WINGS LEVEL, NOSE UP. LAND SHORT AND THE RUN IS OVER.
        </p>
      </div>
    </div>
  );
}
