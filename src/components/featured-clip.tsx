"use client";

import { useEffect, useRef, useState } from "react";

// A real clip, playing on the homepage: muted on loop while it's on screen,
// with a button to restart it with sound.
//
// The <video> is raw HTML for the same reason as the hero: iOS only
// autoplays videos whose server markup says muted.
export function FeaturedClip({ src, poster, label }: { src: string; poster: string; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = wrap.current?.querySelector("video");
    if (!v) return;
    v.muted = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Only play while visible, to save phone batteries and data.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!reduce || !v.muted) v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    const onVolume = () => setSound(!v.muted);
    v.addEventListener("volumechange", onVolume);
    return () => {
      io.disconnect();
      v.removeEventListener("volumechange", onVolume);
    };
  }, []);

  function toggleSound() {
    const v = wrap.current?.querySelector("video");
    if (!v) return;
    if (v.muted) {
      v.currentTime = 0;
      v.muted = false;
      v.play().catch(() => {});
    } else {
      v.muted = true;
    }
  }

  return (
    <div ref={wrap} className="relative aspect-[9/16] w-full overflow-hidden rounded-[2rem] bg-black shadow-[0_24px_60px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.08)]">
      <div
        className="absolute inset-0"
        dangerouslySetInnerHTML={{
          __html: `<video class="h-full w-full object-cover" poster="${poster}" autoplay muted loop playsinline webkit-playsinline preload="metadata" disablepictureinpicture aria-label="${label}"><source src="${src}" type="video/mp4"></video>`,
        }}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={sound}
        className="press absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/65 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-ink ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70 active:scale-[.97]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
          {sound ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          ) : (
            <path d="m16 9 6 6m0-6-6 6" />
          )}
        </svg>
        {sound ? "Mute" : "Play with sound"}
      </button>
    </div>
  );
}
