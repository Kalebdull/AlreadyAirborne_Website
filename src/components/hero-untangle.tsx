"use client";

import { useEffect, useRef } from "react";

// "Aviation, made simple": an Eevee-rendered loop (design/blender/untangle.py)
// of tangled flight paths and jargon collapsing into the flight path marker.
// Holds on the first frame for people who prefer reduced motion.
export function HeroUntangle({ className }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (reduce.matches ? v.pause() : v.play().catch(() => {}));
    apply();
    reduce.addEventListener("change", apply);
    return () => reduce.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={video}
      src="/hero-untangle.mp4"
      poster="/hero-untangle.jpg"
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-label="A tangle of colored flight paths and aviation jargon untangling into one clean flight path marker, then tangling again."
      className={className}
    />
  );
}
