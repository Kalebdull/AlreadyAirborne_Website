import { NextResponse } from "next/server";
import { getContest, getLeaderboard } from "@/lib/leaderboard";

// Public board for the running contest: callsigns and scores, never emails.
export async function GET() {
  const { contest, live } = await getContest();
  if (!contest) return NextResponse.json({ contest: null, live: false, entries: [], total: 0 });
  const { entries, total } = await getLeaderboard(contest.id, 100);
  return NextResponse.json({ contest, live, entries, total }, { headers: { "Cache-Control": "no-store" } });
}
