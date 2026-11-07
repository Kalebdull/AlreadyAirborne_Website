import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LevelLadder } from "@/components/level-ladder";
import { getContest, getLeaderboard } from "@/lib/leaderboard";

// The game, explained: the ten-level ladder, then the contest board (or what
// the board is about, before there's a contest running).
export async function LeaderboardSection() {
  const { contest, live } = await getContest();
  const board = contest ? await getLeaderboard(contest.id, 5) : { entries: [], total: 0 };

  return (
    <section id="leaderboard" className="scroll-mt-20 px-6 py-20 md:py-24">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-3">
            <span className="eyebrow text-magenta">{contest ? (live ? "● Contest live" : "Contest closed") : "The game"}</span>
            <h2 className="headline text-[40px] md:text-[56px]">
              Ten landings.
              <br />
              <span className="text-dim">Miss one, back to one.</span>
            </h2>
            <p className="text-[17px] leading-relaxed text-mute">
              The rings shrink, the wind builds and the land-by line creeps toward you. Your run score is every level added up.
            </p>
          </div>
          {contest && live && (
            <div className="flex flex-col items-end gap-1">
              <span className="eyebrow">Ends in</span>
              <Countdown to={contest.ends_at} className="font-mono text-3xl font-bold tabular-nums text-cyan md:text-4xl" />
              <span className="text-[14px] text-mute">Top score wins {contest.prize.charAt(0).toLowerCase() + contest.prize.slice(1)}</span>
            </div>
          )}
        </div>

        <div className="reveal">
          <LevelLadder />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="reveal flex flex-col gap-3">
            {contest ? (
              <LeaderboardTable entries={board.entries} empty="No scores yet. Fly a run above and be the first on the board." />
            ) : (
              <div className="card flex h-full flex-col justify-center gap-3 p-8">
                <span className="font-mono text-[12px] tracking-[.14em] text-amber">● LEADERBOARD OPENING SOON</span>
                <p className="font-display text-2xl font-semibold leading-snug">Top run when the first contest ends wins a free lesson.</p>
                <p className="text-mute">Fly runs now. Your best is saved on this device, ready to submit the moment the board opens.</p>
              </div>
            )}
          </div>
          <div className="card reveal flex flex-col gap-5 p-8">
            <span className="eyebrow">Fair play</span>
            <ul className="flex flex-col gap-3 text-[15px] leading-relaxed text-soft">
              <li className="flex gap-3">
                <span className="font-mono text-green">01</span>Press R and hand-fly from level 1. Autopilot runs don&apos;t count.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-green">02</span>Every score is verified by re-flying your run on our server.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-green">03</span>One entry per email. Your best run counts.
              </li>
            </ul>
            <div className="mt-auto flex flex-wrap gap-3">
              <a href="#fly" className="btn btn-primary btn-sm">
                Fly a run
              </a>
              <Link href="/leaderboard" className="btn btn-ghost btn-sm">
                {board.total > 0 ? `All ${board.total} pilots` : "Rules & scoring"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
