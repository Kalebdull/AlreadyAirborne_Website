import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LevelLadder } from "@/components/level-ladder";
import { getContest, getLeaderboard } from "@/lib/leaderboard";
import { SectionHeader } from "@/components/section-header";

// The feature section: the flight game itself, the ten-level ladder, then the
// contest board (or what it's about, before a contest is running).
export async function GameSection({ children }: { children: React.ReactNode }) {
  const { contest, live } = await getContest();
  const board = contest ? await getLeaderboard(contest.id, 5) : { entries: [], total: 0 };

  return (
    <section id="fly" className="scroll-mt-20 px-6 py-14 md:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9 md:gap-10">
        <SectionHeader
          eyebrow={contest ? (live ? "● Contest live · the flight game" : "The flight game") : "The flight game"}
          tone="text-magenta"
          title={
            <>
              Ten landings. <span className="text-dim">Miss one, back to one.</span>
            </>
          }
          intro="The rings shrink, the wind builds and the land-by line creeps toward you. On a computer, hover the display to fly and press R for a scored run. On a phone, fly with the thumb pad under it."
        />

        <div className="flex justify-center">{children}</div>

        {contest && live && (
          <div className="reveal flex flex-col items-center gap-1 text-center">
            <span className="eyebrow">Contest ends in</span>
            <Countdown to={contest.ends_at} className="font-mono text-3xl font-bold tabular-nums text-cyan md:text-4xl" />
            <span className="text-[14px] text-mute">Top score wins {contest.prize.charAt(0).toLowerCase() + contest.prize.slice(1)}</span>
          </div>
        )}

        <div className="reveal">
          <LevelLadder />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div id="leaderboard" className="reveal flex scroll-mt-24 flex-col gap-3">
            {contest ? (
              <LeaderboardTable entries={board.entries} slots={5} empty="No scores yet. Fly a run and be the first on the board." />
            ) : (
              <div className="card accent-bar relative flex h-full flex-col justify-center gap-3 p-8" style={{ ["--bar" as string]: "var(--color-amber)" }}>
                <span className="font-mono text-[12px] tracking-[.14em] text-amber">● LEADERBOARD OPENING SOON</span>
                <p className="font-display text-2xl font-semibold leading-snug">Top run when the first contest ends wins a free lesson.</p>
                <p className="text-mute">Fly runs now. Your best is saved on this device, ready to submit the moment the board opens.</p>
              </div>
            )}
          </div>
          <div className="card accent-bar reveal relative flex flex-col gap-5 p-8" style={{ ["--bar" as string]: "var(--color-green)" }}>
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
            <div className="mt-auto">
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
