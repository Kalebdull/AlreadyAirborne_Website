import { LEVELS } from "@/components/pfd/levels";

// All ten levels at a glance: rings shrink, wind builds, the line closes in.
export function LevelLadder() {
  const maxRing = LEVELS[0].ringRadius;
  const maxWind = Math.max(...LEVELS.map((l) => l.wind + l.gust));
  return (
    <ol className="grid grid-cols-5 gap-2 md:grid-cols-10" aria-label="The ten levels">
      {LEVELS.map((level) => {
        const ring = 10 + (level.ringRadius / maxRing) * 22; // px radius
        const gusts = level.wind + level.gust;
        return (
          <li
            key={level.number}
            title={`Level ${level.number}: ${level.name}`}
            className="group flex flex-col items-center gap-3 rounded-2xl bg-card px-2 pb-3 pt-4 text-center transition-colors hover:bg-raised"
          >
            <span className="font-mono text-[11px] tracking-[.1em] text-dim group-hover:text-cyan">L{level.number}</span>
            <svg viewBox="0 0 72 72" className="h-14 w-14 md:h-16 md:w-16" aria-hidden>
              <circle cx="36" cy="36" r={ring} fill="none" stroke="#f048c8" strokeWidth={3} opacity={0.35 + (level.number / 10) * 0.65} />
            </svg>
            <div className="flex h-10 w-2 items-end overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div className="w-full rounded-full bg-cyan" style={{ height: `${Math.max(6, (gusts / maxWind) * 100)}%` }} />
            </div>
            <span className="font-mono text-[10px] leading-tight text-mute md:text-[11px]">
              {level.wind ? `${level.wind}${level.gust ? `G${gusts}` : ""} KT` : "CALM"}
            </span>
            <span className="hidden truncate text-[11px] leading-tight text-soft md:block md:max-w-full">{level.name}</span>
          </li>
        );
      })}
    </ol>
  );
}
