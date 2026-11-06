"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setWatched } from "../actions";

export function ClipPlayer({
  clipId,
  src,
  poster,
  watched,
}: {
  clipId: string;
  src: string | null;
  poster: string | null;
  watched: boolean;
}) {
  const [optimisticWatched, setOptimisticWatched] = useOptimistic(watched);
  const [, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);

  function mark(value: boolean) {
    startTransition(async () => {
      setOptimisticWatched(value);
      await setWatched(clipId, value);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[32px] bg-card shadow-[0_0_0_1px_#2c2c2e]">
        {src ? (
          <video
            src={src}
            poster={poster ?? undefined}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => {
              if (!optimisticWatched) mark(true);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs text-dim">VIDEO NOT UPLOADED YET</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-white/10">
          <div className="h-full bg-magenta transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => mark(!optimisticWatched)}
        aria-pressed={optimisticWatched}
        className={`btn btn-sm self-center ${optimisticWatched ? "bg-green/15 text-green" : "btn-ghost"}`}
      >
        {optimisticWatched ? "✓ Watched" : "Mark as watched"}
      </button>
    </div>
  );
}
