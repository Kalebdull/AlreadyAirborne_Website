"use client";

import { useEffect, useRef } from "react";

// "Aviation, made simple": an Eevee-rendered loop (design/blender/untangle.py)
// of tangled flight paths and jargon collapsing into the chrome AlreadyAirborne A.
//
// A still of the finished A sits underneath, and the video stays invisible
// until it is actually playing. When a phone refuses to autoplay (iPhone Low
// Power Mode), visitors see the still, never a play button.
//
// Phones and desktops each get a version rendered at the exact size they're
// shown (1040x900 and 2000x876), so it stays sharp on high-density screens.
//
// The <video> is written as raw HTML on purpose: React sets `muted` as a
// property, not an attribute, and iOS only autoplays videos whose server
// markup says muted.
const ARIA = "A tangle of colored flight paths and aviation jargon untangling into one clean flight path marker, then tangling again.";
const HOLD = 160 / 30; // seconds into the loop where the A is fully formed and settled (matches the still)

export function HeroUntangle({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = wrap.current?.querySelector("video");
    if (!v) return;
    v.muted = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const show = () => v.style.setProperty("opacity", "1");
    const hide = () => v.style.setProperty("opacity", "0");
    const play = () => {
      if (reduce.matches) return;
      v.play().catch(() => {});
    };
    // Start where the still leaves off, so the switch is invisible.
    const seek = () => {
      if (v.paused && v.currentTime < 0.1) v.currentTime = HOLD;
    };
    // Shown once frames are actually advancing (autoplay may have started
    // before this script ran, so "playing" alone can be missed).
    const onTime = () => {
      if (!v.paused && v.currentTime > 0) show();
    };
    const apply = () => {
      if (reduce.matches) {
        v.pause();
        hide();
      } else {
        play();
      }
    };
    if (v.readyState >= 1) seek();
    v.addEventListener("loadedmetadata", seek);
    v.addEventListener("playing", show);
    v.addEventListener("timeupdate", onTime);
    onTime();
    // Low Power Mode blocks autoplay but allows it after a touch.
    window.addEventListener("touchend", play, { passive: true });
    reduce.addEventListener("change", apply);
    apply();
    return () => {
      v.removeEventListener("loadedmetadata", seek);
      v.removeEventListener("playing", show);
      v.removeEventListener("timeupdate", onTime);
      window.removeEventListener("touchend", play);
      reduce.removeEventListener("change", apply);
    };
  }, []);

  return (
    <div ref={wrap} className={className}>
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-untangle-phone.jpg" />
        <img src="/hero-untangle.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[inherit]" />
      </picture>
      <div
        className="absolute inset-0 object-[inherit]"
        dangerouslySetInnerHTML={{
          __html: `<video class="hero-video h-full w-full object-cover object-[inherit]" style="opacity:0;transition:opacity .6s ease" autoplay muted loop playsinline webkit-playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-label="${ARIA}"><source src="/hero-untangle-phone.mp4" type="video/mp4" media="(max-width: 767px)"><source src="/hero-untangle.mp4" type="video/mp4"></video>`,
        }}
      />
    </div>
  );
}
