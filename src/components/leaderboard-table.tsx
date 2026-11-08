import type { Entry } from "@/lib/leaderboard";

// `slots` pads a short board with open places to claim, so a new contest
// doesn't look empty.
export function LeaderboardTable({ entries, empty, slots = 0 }: { entries: Entry[]; empty: string; slots?: number }) {
  if (entries.length === 0 && slots === 0) {
    return <p className="rounded-2xl bg-card px-6 py-8 text-center text-mute">{empty}</p>;
  }
  const open = Array.from({ length: Math.max(0, slots - entries.length) }, (_, i) => entries.length + i + 1);
  return (
    <ol className="overflow-hidden rounded-3xl bg-card">
      {entries.map((e) => (
        <li
          key={e.id}
          className={`grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-0 md:grid-cols-[56px_1fr_120px_110px] md:px-7 ${
            e.place === 1 ? "bg-magenta/10" : ""
          }`}
        >
          <span className={`font-mono text-lg font-bold tabular-nums ${e.place === 1 ? "text-magenta" : e.place <= 3 ? "text-cyan" : "text-dim"}`}>
            {String(e.place).padStart(2, "0")}
          </span>
          <span className="truncate font-display text-lg font-semibold">{e.callsign}</span>
          <span className="hidden text-right font-mono text-[13px] text-dim md:block">{e.level >= 10 ? "ALL 10" : `LVL ${e.level}`}</span>
          <span className="text-right font-mono text-lg font-bold tabular-nums">{e.score.toLocaleString()}</span>
        </li>
      ))}
      {open.map((place) => (
        <li key={`open-${place}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-0 md:grid-cols-[56px_1fr_120px_110px] md:px-7">
          <span className="font-mono text-lg font-bold tabular-nums text-line">{String(place).padStart(2, "0")}</span>
          <span className="truncate font-mono text-[13px] tracking-[.1em] text-dim">{place === 1 ? "OPEN · FLY A RUN TO TAKE IT" : "OPEN"}</span>
          <span className="hidden md:block" />
          <span className="text-right font-mono text-lg text-line">—</span>
        </li>
      ))}
    </ol>
  );
}
