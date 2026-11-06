"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/logo";
import { createFlight, modeLabel, readouts, step, type FlightState } from "./flight-model";
import type { SvtScene } from "./scene";
import { GATES } from "./world";

// A working Garmin-style primary flight display with synthetic vision.
// It takes off on load and the autopilot flies the magenta pathway around
// the traffic pattern to a landing. Hover the display (or drag on a phone)
// to take the controls; let go and the autopilot takes them back.
//
// One requestAnimationFrame loop drives everything: the flight model, the
// 3D scene (loaded on demand) and the 2D instruments, which are written as
// transforms straight to the DOM so React never re-renders mid-flight.

const PPK = 4; // speed tape: px per knot
const PPF = 0.4; // altitude tape: px per foot
const PPH = 6; // heading tape: px per degree

const SPEEDS = Array.from({ length: 23 }, (_, i) => i * 10); // 0–220 kt
const ALTS = Array.from({ length: 121 }, (_, i) => i * 100); // 0–12,000 ft
const HEADINGS = Array.from({ length: 73 }, (_, i) => i * 10 - 180); // -180–540°
// The first frame, rendered on the server so the display is right before
// the script starts.
const INITIAL = createFlight();

const PITCH_LINES = Array.from({ length: 25 }, (_, i) => (i - 12) * 2.5).filter((d) => d !== 0);
const ROLL_TICKS = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
const MANUAL_TIMEOUT = 2500; // ms without input before the autopilot takes back over

function headingLabel(deg: number) {
  const h = ((deg % 360) + 360) % 360;
  return ({ 0: "N", 90: "E", 180: "S", 270: "W" } as Record<number, string>)[h] ?? (h % 30 === 0 ? String(h / 10) : "");
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
      warning: q<HTMLDivElement>("warning"),
      toast: q<HTMLDivElement>("toast"),
      fade: q<HTMLDivElement>("fade"),
    };
    const fallback = el.querySelectorAll<HTMLElement>('[data-pfd="fallback"]');

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flight: FlightState = createFlight(reduced);
    const pointer = { x: 0, y: 0, at: -Infinity };
    let svt: SvtScene | null = null;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let lastText = "";
    let lastSecond = -1;
    let resizeObserver: ResizeObserver | null = null;

    function render(s: FlightState) {
      const r = readouts(s);
      parts.attitude.style.transform = `rotate(${-r.roll}deg) translateY(calc(var(--ppd) * ${r.pitch}))`;
      parts.rollPointer.style.transform = `rotate(${-r.roll}deg)`;
      parts.fpm.style.transform = `translate(-50%, -50%) translate(${r.drift * 3}px, calc(var(--ppd) * ${r.pitch - r.fpa}))`;
      parts.speedStrip.style.transform = `translateY(${s.ias * PPK}px)`;
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

      svt?.update(s, r);

      // Text only changes a few times a second; skip DOM writes when equal.
      const showToast = s.toast && s.time - s.toast.at < (s.toast.tone === "green" && s.toast.text.startsWith("GATE") ? 1.4 : 3.2);
      const text = `${r.iasText}|${r.altText}|${r.hdgText}|${r.vsText}|${s.phase}|${s.altSel}|${r.warning}|${r.gatesText}|${showToast ? s.toast!.at : ""}`;
      if (text !== lastText) {
        lastText = text;
        parts.speedText.textContent = r.iasText;
        parts.gs.textContent = r.iasText;
        parts.altText.textContent = r.altText;
        parts.hdgText.textContent = `${r.hdgText}°`;
        parts.vsiText.textContent = r.vsText;
        parts.altSel.textContent = String(s.altSel);
        parts.gates.textContent = r.gatesText;
        parts.mode.textContent = modeLabel(s.phase);
        parts.mode.dataset.mode = s.phase;
        parts.warning.dataset.on = r.warning ? "true" : "false";
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
    }

    // The stick is the pointer's position over the attitude display.
    function stick() {
      if (performance.now() - pointer.at > MANUAL_TIMEOUT) return null;
      const rect = parts.svt.getBoundingClientRect();
      return {
        x: Math.max(-1, Math.min(1, (pointer.x - (rect.left + rect.width / 2)) / (rect.width / 2))),
        y: Math.max(-1, Math.min(1, (pointer.y - (rect.top + rect.height / 2)) / (rect.height / 2))),
      };
    }

    function frame(t: number) {
      // Clamp long gaps (tab switches, slow frames) so nothing ever jumps.
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      step(flight, dt, { stick: stick() });
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

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = parts.svt.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.at = performance.now();
    };
    // On touch: drag sideways across the display to bank. Vertical drags
    // still scroll the page (touch-action: pan-y on the element).
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !e.buttons) return;
      const rect = parts.svt.getBoundingClientRect();
      pointer.x = e.clientX;
      pointer.y = rect.top + rect.height / 2;
      pointer.at = performance.now();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    el.addEventListener("pointermove", onTouch, { passive: true });

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
      el.removeEventListener("pointermove", onTouch);
      document.removeEventListener("visibilitychange", onVisibility);
      svt?.dispose();
    };
  }, []);

  return (
    <div className="w-full max-w-[1100px]">
      <div
        ref={root}
        className="relative overflow-hidden rounded-[30px] bg-[#1d1d1f] p-2 shadow-[0_0_0_1px_#3a3a3c,0_50px_140px_rgba(0,0,0,.85)] md:rounded-[36px] md:p-2.5"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label="A working primary flight display with synthetic vision. Hover over it to fly the airplane through the gates and land."
      >
        <div className="flex flex-col overflow-hidden rounded-[22px] bg-black md:rounded-[27px]">
          {/* Top strip */}
          <div className="flex h-9 items-center gap-4 border-b border-white/10 bg-[#0b0b0c] px-4 font-mono text-[11px] tracking-[.06em] text-dim md:h-10 md:gap-6 md:px-5 md:text-[12px]">
            <span className="flex items-center gap-2 text-ink">
              <LogoMark size={20} />
              <span className="hidden sm:inline">AA-PFD</span>
            </span>
            <span className="hidden md:inline">
              GS <span data-pfd="gs" className="text-ink">0</span>KT
            </span>
            <span>
              GATES <span data-pfd="gates" className="text-magenta">0/{GATES.length}</span>
            </span>
            <span
              data-pfd="mode"
              data-mode="takeoff"
              className="mx-auto rounded-md px-2 py-0.5 font-bold text-green transition-colors data-[mode=crashed]:bg-red/15 data-[mode=crashed]:text-red data-[mode=manual]:bg-cyan/15 data-[mode=manual]:text-cyan"
            >
              TO/GA
            </span>
            <span data-pfd="utc" className="tabular-nums text-ink">
              00:00:00Z
            </span>
          </div>

          {/* Attitude + tapes */}
          <div className="relative aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9]">
            <div className="absolute inset-0 overflow-hidden bg-[#3d86e6] [container-type:size]" style={{ ["--ppd" as string]: "2.6cqh" }}>
              {/* Synthetic vision (3D), fades in once loaded */}
              <div data-pfd="svt" data-ready="false" className="absolute inset-0 opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100" />
              {/* Sky / ground / pitch ladder: rotates with roll, slides with pitch */}
              <div data-pfd="attitude" className="absolute inset-0 will-change-transform">
                <div data-pfd="fallback" className="absolute -inset-x-[150%] -top-[150%] bottom-1/2 bg-[linear-gradient(to_bottom,#0b3a86_0%,#1f63c4_70%,#3d86e6_100%)] transition-opacity duration-700" />
                <div data-pfd="fallback" className="absolute -inset-x-[150%] -bottom-[150%] top-1/2 bg-[linear-gradient(to_bottom,#7a4a22_0%,#5b3518_30%,#3b220f_100%)] transition-opacity duration-700" />
                <div className="absolute -inset-x-[150%] top-1/2 h-[2px] -translate-y-1/2 bg-white" />
                {PITCH_LINES.map((deg) => {
                  const major = deg % 10 === 0;
                  const mid = !major && deg % 5 === 0;
                  return (
                    <div
                      key={deg}
                      className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 font-mono text-[11px] font-bold text-white"
                      style={{ top: `calc(50% - var(--ppd) * ${deg})` }}
                    >
                      {major && <span className="w-5 text-right">{Math.abs(deg)}</span>}
                      <span className={`block h-[2px] bg-white ${major ? "w-28 md:w-36" : mid ? "w-14 md:w-16" : "w-7"}`} />
                      {major && <span className="w-5">{Math.abs(deg)}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Roll scale (fixed) + pointer (rotates with bank) */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                {ROLL_TICKS.map((deg) => (
                  <div
                    key={deg}
                    className="absolute left-0 top-0 origin-top"
                    style={{ transform: `rotate(${deg}deg) translateY(calc(var(--ppd) * -15))` }}
                  >
                    {deg === 0 ? (
                      <div className="-ml-[7px] -mt-3 h-0 w-0 border-x-[7px] border-t-[11px] border-x-transparent border-t-white" />
                    ) : (
                      <div className={`-ml-px w-[2px] bg-white ${Math.abs(deg) % 30 === 0 ? "-mt-4 h-4" : "-mt-2.5 h-2.5"}`} />
                    )}
                  </div>
                ))}
                <div data-pfd="roll-pointer" className="absolute left-0 top-0">
                  <div
                    className="-ml-[7px] h-0 w-0 border-x-[7px] border-b-[11px] border-x-transparent border-b-white"
                    style={{ transform: "translateY(calc(var(--ppd) * -15 + 3px))" }}
                  />
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
              <div className="absolute left-3 top-1/2 h-[64%] w-[64px] -translate-y-1/2 md:left-6 md:w-[84px]">
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
                  </div>
                  <div data-pfd="speed-trend" className="absolute bottom-1/2 right-2.5 w-[3px] origin-bottom bg-magenta" />
                </div>
                <div className="absolute left-0 right-3 top-1/2 flex h-10 -translate-y-1/2 items-center justify-end rounded-md border-2 border-white bg-black pr-2 font-mono text-[20px] font-bold tabular-nums text-white md:text-[24px]">
                  <span data-pfd="speed-text">---</span>
                </div>
                <span className="absolute -bottom-6 left-0 font-mono text-[11px] text-dim">KT</span>
              </div>

              {/* Altitude tape + VSI */}
              <div className="absolute right-3 top-1/2 flex h-[64%] -translate-y-1/2 gap-1 md:right-6">
                <div className="relative w-[72px] md:w-[96px]">
                  <div className="absolute -top-8 left-0 right-0 rounded-md bg-black/60 px-2 py-1 text-center font-mono text-[12px] text-cyan ring-1 ring-cyan/40 md:text-[13px]">
                    <span data-pfd="alt-sel">3000</span>
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
                  <div className="absolute left-3 right-0 top-1/2 flex h-10 -translate-y-1/2 items-center rounded-md border-2 border-white bg-black pl-2 font-mono text-[18px] font-bold tabular-nums text-white md:text-[22px]">
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
              <div className="absolute bottom-4 left-1/2 h-11 w-[52%] -translate-x-1/2 overflow-hidden rounded-lg bg-black/55 ring-1 ring-white/15 md:bottom-6 md:w-[40%]">
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
              <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 rounded-md border-2 border-white bg-black px-2 py-0.5 font-mono text-[15px] font-bold tabular-nums text-white md:bottom-[72px] md:text-[17px]">
                <span data-pfd="hdg-text">090°</span>
              </div>

              {/* Data fields: the offers, as panel readouts */}
              <Link
                href="/book?service=zoom"
                className="absolute bottom-4 left-3 hidden flex-col rounded-lg bg-black/60 px-3 py-2 ring-1 ring-white/15 backdrop-blur transition hover:ring-cyan sm:flex md:bottom-6 md:left-6"
              >
                <span className="font-mono text-[10px] tracking-[.1em] text-dim md:text-[11px]">1-ON-1 · ZOOM</span>
                <span className="font-display text-xl font-semibold md:text-2xl">
                  $50<span className="text-[13px] font-medium text-mute"> /hr</span>
                </span>
              </Link>
              <Link
                href="/book?service=oral_ppl"
                className="absolute bottom-4 right-3 hidden flex-col items-end rounded-lg bg-black/60 px-3 py-2 ring-1 ring-white/15 backdrop-blur transition hover:ring-magenta sm:flex md:bottom-6 md:right-6"
              >
                <span className="font-mono text-[10px] tracking-[.1em] text-dim md:text-[11px]">MOCK ORAL · PPL/CPL</span>
                <span className="font-display text-xl font-semibold md:text-2xl">$175</span>
              </Link>

              {/* Terrain warning: red only ever means warning */}
              <div
                data-pfd="warning"
                data-on="false"
                className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 rounded-md bg-red px-4 py-1.5 font-mono text-lg font-bold tracking-[.12em] text-black opacity-0 transition-opacity data-[on=true]:animate-pulse data-[on=true]:opacity-100"
              >
                PULL UP
              </div>

              {/* Messages: gates, landings, go-arounds */}
              <div
                data-pfd="toast"
                data-on="false"
                aria-live="polite"
                className="pointer-events-none absolute left-1/2 top-[19%] -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-black/65 px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-[.1em] opacity-0 backdrop-blur transition-[opacity,transform] duration-300 data-[on=true]:translate-y-0 data-[on=true]:opacity-100 data-[tone=amber]:text-amber data-[tone=cyan]:text-cyan data-[tone=green]:text-green data-[tone=red]:text-red md:text-[14px]"
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
      <p className="mt-5 text-center font-mono text-[12px] tracking-[.1em] text-dim">
        <span>
          <span className="hidden md:inline">HOVER THE DISPLAY TO TAKE THE CONTROLS · FLY THE MAGENTA GATES · LAND ON RUNWAY 9</span>
          <span className="md:hidden">DRAG SIDEWAYS TO BANK · FLY THE MAGENTA GATES</span>
        </span>
      </p>
    </div>
  );
}
