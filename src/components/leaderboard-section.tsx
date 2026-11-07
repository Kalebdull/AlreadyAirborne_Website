import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { getContest, getLeaderboard } from "@/lib/leaderboard";

// Homepage strip under the flight display: the prize, the clock, the top 5.
export async function LeaderboardSection() {
  const { contest, live } = await getContest();
  if (!contest) return null;
  const { entries, total } = await getLeaderboard(contest.id, 5);

  return (
    <section id="leaderboard" className="scroll-mt-20 px-6 pt-24 md:pt-32">
      <div className="mx-auto flex max-w-[1024px] flex-col gap-8">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow text-magenta">{live ? "● Contest live" : "Contest closed"}</span>
            <h2 className="headline text-[40px] md:text-[56px]">
              Top pilots.
              <br />
              <span className="text-dim">Top score wins: {contest.prize}.</span>
            </h2>
          </div>
          {live && (
            <div className="flex flex-col items-end gap-1">
              <span className="eyebrow">Ends in</span>
              <Countdown to={contest.ends_at} className="font-mono text-3xl font-bold tabular-nums text-cyan md:text-4xl" />
            </div>
          )}
        </div>
        <div className="reveal">
          <LeaderboardTable entries={entries} empty="No scores yet. Hand-fly a lap above and be the first on the board." />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-[15px] text-mute">
          <span>
            {total > 0 ? `${total} pilot${total === 1 ? "" : "s"} on the board.` : ""} Scores are verified by re-flying your run on our server.
          </span>
          <Link href="/leaderboard" className="link">
            Full leaderboard &amp; rules ›
          </Link>
        </div>
      </div>
    </section>
  );
}
