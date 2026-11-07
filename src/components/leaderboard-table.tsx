import type { Entry } from "@/lib/leaderboard";

export function LeaderboardTable({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (entries.length === 0) {
    return <p className="rounded-2xl bg-card px-6 py-8 text-center text-mute">{empty}</p>;
  }
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
          <span className="hidden text-right font-mono text-[13px] text-dim md:block">{e.distance !== null ? `${e.distance.toLocaleString()} FT` : ""}</span>
          <span className="text-right font-mono text-lg font-bold tabular-nums">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
