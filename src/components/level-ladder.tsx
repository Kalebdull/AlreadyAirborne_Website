import { LEVELS } from "@/components/pfd/levels";

// All ten levels at a glance: rings shrink, wind builds, the line closes in.
export function LevelLadder() {
  const maxRing = LEVELS[0].ringRadius;
  const maxWind = Math.max(...LEVELS.map((l) => l.wind + l.gust));
  return (
    <ol className="grid grid-cols-10 gap-1 md:gap-2" aria-label="The ten levels">
      {LEVELS.map((level) => {
        const ring = 10 + (level.ringRadius / maxRing) * 22; // px radius
        const gusts = level.wind + level.gust;
        return (
          <li
            key={level.number}
            title={`Level ${level.number}: ${level.name}`}
            className="group flex flex-col items-center gap-1.5 rounded-xl bg-card px-0.5 pb-2 pt-2.5 text-center transition-colors hover:bg-raised md:gap-3 md:rounded-2xl md:px-2 md:pb-3 md:pt-4"
          >
            <span className="font-mono text-[9px] tracking-[.06em] text-dim group-hover:text-cyan md:text-[11px] md:tracking-[.1em]">L{level.number}</span>
            <svg viewBox="0 0 72 72" className="h-7 w-7 md:h-16 md:w-16" aria-hidden>
              <circle cx="36" cy="36" r={ring} fill="none" stroke="#f048c8" strokeWidth={3} opacity={0.35 + (level.number / 10) * 0.65} />
            </svg>
            <div className="flex h-6 w-1.5 items-end overflow-hidden rounded-full bg-white/10 md:h-10 md:w-2" aria-hidden>
              <div className="w-full rounded-full bg-cyan" style={{ height: `${Math.max(6, (gusts / maxWind) * 100)}%` }} />
            </div>
            <span className="font-mono text-[8px] leading-tight text-mute md:text-[11px]">
              {level.wind ? `${level.wind}${level.gust ? `G${gusts}` : ""}` : "CALM"}
              {level.wind ? <span className="hidden md:inline"> KT</span> : null}
            </span>
            <span className="hidden truncate text-[11px] leading-tight text-soft md:block md:max-w-full">{level.name}</span>
          </li>
        );
      })}
    </ol>
  );
}
