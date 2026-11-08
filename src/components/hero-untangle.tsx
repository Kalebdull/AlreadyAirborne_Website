"use client";

import { useEffect, useRef } from "react";

// "Aviation, made simple": an Eevee-rendered loop (design/blender/untangle.py)
// of tangled flight paths and jargon collapsing into the flight path marker.
// Holds on the first frame for people who prefer reduced motion.
//
// The <video> is written as raw HTML on purpose: React sets `muted` as a
// property, not an attribute, so iPhones see an unmuted video in the server
// HTML and refuse to autoplay it (showing a play button instead).
const ARIA = "A tangle of colored flight paths and aviation jargon untangling into one clean flight path marker, then tangling again.";

export function HeroUntangle({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = wrap.current?.querySelector("video");
    if (!v) return;
    v.muted = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Low Power Mode on iPhone blocks autoplay; start on the first touch instead.
    const kick = () => {
      if (!reduce.matches) v.play().catch(() => {});
    };
    const apply = () => {
      if (reduce.matches) v.pause();
      else v.play().catch(() => {
        window.addEventListener("touchstart", kick, { once: true, passive: true });
        window.addEventListener("scroll", kick, { once: true, passive: true });
      });
    };
    apply();
    reduce.addEventListener("change", apply);
    return () => {
      reduce.removeEventListener("change", apply);
      window.removeEventListener("touchstart", kick);
      window.removeEventListener("scroll", kick);
    };
  }, []);

  return (
    <div
      ref={wrap}
      className={className}
      dangerouslySetInnerHTML={{
        __html: `<video class="hero-video h-full w-full object-cover object-[inherit]" src="/hero-untangle.mp4" poster="/hero-untangle.jpg" autoplay muted loop playsinline webkit-playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-label="${ARIA}"></video>`,
      }}
    />
  );
}
