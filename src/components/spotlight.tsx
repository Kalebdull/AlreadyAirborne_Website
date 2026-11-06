"use client";

import { useRef } from "react";

// A soft light that follows the cursor across a card.
export function Spotlight({ className, children, tint = "34 211 238", id }: { className?: string; children: React.ReactNode; tint?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      id={id}
      ref={ref}
      className={`spotlight ${className ?? ""}`}
      style={{ ["--tint" as string]: tint }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
