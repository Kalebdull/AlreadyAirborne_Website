import type { Metadata } from "next";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { getContest, getLeaderboard } from "@/lib/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Fly the traffic pattern, land on the numbers, top the board. The best score when the contest ends wins.",
};

export default async function LeaderboardPage() {
  const { contest, live } = await getContest();
  const board = contest ? await getLeaderboard(contest.id, 100) : { entries: [], total: 0 };

  return (
    <main className="px-6 pb-28 pt-14 md:pt-20">
      <div className="mx-auto flex max-w-[880px] flex-col gap-12">
        <div className="flex flex-col gap-4">
          <span className="eyebrow text-magenta">{contest ? (live ? "● Contest live" : "Contest closed") : "Leaderboard"}</span>
          <h1 className="headline text-[48px] md:text-[72px]">{contest?.title ?? "Top pilots."}</h1>
          {contest && (
            <p className="max-w-[620px] text-xl leading-snug text-mute">
              Highest verified score when the clock runs out wins <span className="text-ink">{contest.prize}</span>.
            </p>
          )}
        </div>

        {contest && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card flex flex-col gap-1 p-6">
              <span className="eyebrow">{live ? "Ends in" : "Ended"}</span>
              {live ? (
                <Countdown to={contest.ends_at} className="font-mono text-2xl font-bold tabular-nums text-cyan" />
              ) : (
                <span className="font-mono text-2xl font-bold">{new Date(contest.ends_at).toLocaleDateString()}</span>
              )}
            </div>
            <div className="card flex flex-col gap-1 p-6">
              <span className="eyebrow">Pilots</span>
              <span className="font-mono text-2xl font-bold tabular-nums">{board.total}</span>
            </div>
            <div className="card flex flex-col gap-1 p-6">
              <span className="eyebrow">Leading</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-magenta">{board.entries[0]?.score.toLocaleString() ?? "—"}</span>
            </div>
          </div>
        )}

        <LeaderboardTable entries={board.entries} empty={contest ? "No scores yet. Be the first." : "No contest is running right now. Check back soon."} />

        <section className="grid gap-8 border-t border-line pt-10 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-semibold">How scoring works</h2>
            <ul className="flex flex-col gap-2 text-[15px] leading-relaxed text-mute">
              <li><span className="text-ink">A run is ten landings.</span> Each level&apos;s rings shrink, the wind builds and the land-by line moves closer.</li>
              <li><span className="text-ink">Per level:</span> points for clearing it, up to 100 per ring for threading it dead center, touching down close to the threshold, a soft touchdown and the centerline.</li>
              <li><span className="text-ink">Later levels count more:</span> level 10 is worth almost three times level 1.</li>
              <li><span className="text-ink">Miss a ring, land past the line, or break a limit</span> (stall, overspeed, flap speed, too fast or too hard at touchdown) and the run is over. Your score is everything you landed before that.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-semibold">Fair play</h2>
            <p className="text-[15px] leading-relaxed text-mute">
              Only runs you hand-fly from level 1 count. Your browser records your control inputs and our server re-flies the run with the same
              physics to compute your score, so every score on this board was actually flown. One entry per email; your best counts.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/" className="btn btn-primary btn-sm">
                Go fly
              </Link>
              <Link href="/leaderboard/rules" className="btn btn-ghost btn-sm">
                Official rules
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
