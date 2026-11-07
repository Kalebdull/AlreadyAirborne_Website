import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

export type Contest = { id: string; title: string; prize: string; starts_at: string; ends_at: string };
export type Entry = { id: string; callsign: string; score: number; level: number; updated_at: string; place: number };

// The contest running now, or else the most recently finished one.
export async function getContest(): Promise<{ contest: Contest | null; live: boolean }> {
  if (!hasSupabase) return { contest: null, live: false };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: live } = await supabase
    .from("contests")
    .select("id, title, prize, starts_at, ends_at")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (live) return { contest: live as Contest, live: true };
  const { data: past } = await supabase
    .from("contests")
    .select("id, title, prize, starts_at, ends_at")
    .lte("ends_at", now)
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { contest: (past as Contest | null) ?? null, live: false };
}

export async function getLeaderboard(contestId: string, limit = 10) {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("leaderboard")
    .select("id, callsign, score, level, updated_at, place", { count: "exact" })
    .eq("contest_id", contestId)
    .order("place", { ascending: true })
    .limit(limit);
  return { entries: (data ?? []) as Entry[], total: count ?? 0 };
}
