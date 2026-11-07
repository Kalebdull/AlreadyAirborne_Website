import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { decode, replay } from "@/components/pfd/replay";
import { createAdminClient } from "@/lib/supabase/admin";

const CALLSIGN = /^[A-Za-z0-9 ._-]{2,16}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_REPLAY_CHARS = 700_000;

function error(message: string, status = 422) {
  return NextResponse.json({ error: message }, { status });
}

// Submit a leaderboard score. The browser sends the recorded inputs, not a
// score: we re-fly the run here with the same flight model and use our
// result. A claimed score that doesn't match is rejected.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Bad request.", 400);

  const callsign = String(body.callsign ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const claimed = Number(body.claimed);
  const data = String(body.replay ?? "");
  if (!CALLSIGN.test(callsign)) return error("Callsign: 2–16 letters, numbers, spaces, dots, dashes or underscores.");
  if (email.length > 254 || !EMAIL.test(email)) return error("That email doesn't look right.");
  if (body.agree !== true) return error("Please agree to the contest rules.");
  if (!data || data.length > MAX_REPLAY_CHARS || !Number.isFinite(claimed)) return error("Bad request.", 400);

  // --- Re-fly the run ---------------------------------------------------------
  let flight;
  try {
    flight = replay(decode(data));
  } catch {
    return error("That flight recording couldn't be read.");
  }
  const result = flight.result;
  if (flight.phase !== "rollout" || !result) return error("That run didn't end in a landing.");
  if (!result.ranked) return error("Only runs hand-flown from the takeoff roll count. Press R and fly the whole lap yourself.");
  // Browsers do floating-point math identically in practice; allow a sliver
  // of slack for engines that round transcendental functions differently.
  if (Math.abs(result.score - claimed) > Math.max(40, claimed * 0.02)) {
    return error("We couldn't verify that run. Try flying it again.");
  }

  // --- Save it ------------------------------------------------------------------
  const admin = createAdminClient();
  if (!admin) return error("The leaderboard isn't connected yet.", 503);

  const now = new Date().toISOString();
  const { data: contest } = await admin
    .from("contests")
    .select("id")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!contest) return error("There's no contest running right now.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${ip}|${process.env.SCORE_SALT ?? "already-airborne"}`).digest("hex").slice(0, 32);
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count: recent } = await admin.from("scores").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("updated_at", since);
  if ((recent ?? 0) >= 8) return error("Lots of submissions from here. Give it a few minutes.", 429);

  const { data: existing } = await admin.from("scores").select("id, score").eq("contest_id", contest.id).eq("email", email).maybeSingle();

  let id = existing?.id as string | undefined;
  let kept = false;
  if (existing && existing.score >= result.score) {
    kept = true;
  } else {
    const row = {
      contest_id: contest.id,
      callsign,
      email,
      marketing_opt_in: body.optIn === true,
      score: result.score,
      breakdown: result.breakdown,
      distance: result.distance,
      sink: result.sink,
      replay: data,
      ip_hash: ipHash,
      updated_at: now,
    };
    const { data: saved, error: saveError } = await admin.from("scores").upsert(row, { onConflict: "contest_id,email" }).select("id").single();
    if (saveError || !saved) return error("Couldn't save your score. Try again in a moment.", 500);
    id = saved.id;
  }

  const [{ data: placed }, { count: total }] = await Promise.all([
    admin.from("leaderboard").select("place, score").eq("id", id!).single(),
    admin.from("leaderboard").select("id", { count: "exact", head: true }).eq("contest_id", contest.id),
  ]);

  return NextResponse.json({ kept, score: placed?.score ?? result.score, place: placed?.place ?? null, total: total ?? null });
}
