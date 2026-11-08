import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

// Anonymous site activity (page views, flight-game runs) for the admin
// overview. No IP addresses are stored; the visitor id is a random value the
// browser keeps in local storage.
const KINDS = new Set(["pageview", "game_start", "run_end"]);
const ID = /^[A-Za-z0-9-]{8,64}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

const clip = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
const int = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

function device(ua: string) {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "mobile";
  return "desktop";
}

// Where a visit came from: a ?utm_source / ?ref tag wins, then the referrer's site.
function source(referrer: string | null, utm: string | null, host: string | null) {
  if (utm) return utm.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40) || null;
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.replace(/^(www|m|l|lm)\./, "");
    if (host && h === host.replace(/^www\./, "")) return null;
    if (/instagram\.com$/.test(h)) return "instagram";
    if (/facebook\.com$|fb\.me$/.test(h)) return "facebook";
    if (/google\./.test(h)) return "google";
    if (/youtube\.com$|youtu\.be$/.test(h)) return "youtube";
    if (/tiktok\.com$/.test(h)) return "tiktok";
    if (/t\.co$|twitter\.com$|x\.com$/.test(h)) return "x";
    if (/reddit\.com$/.test(h)) return "reddit";
    return h.slice(0, 40);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ok = new NextResponse(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  if (!hasSupabase || !ua || BOT.test(ua)) return ok;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !KINDS.has(body.kind) || !ID.test(body.visitor) || !ID.test(body.session)) {
    return ok;
  }

  // Signed-in visitors are linked to their account; the admin isn't counted.
  let userId: string | null = null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub) {
    userId = claims.claims.sub;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role === "admin") return ok;
  }

  const data =
    body.kind === "run_end"
      ? { score: int(body.data?.score, 100_000), cleared: int(body.data?.cleared, 10), level: int(body.data?.level, 10), ranked: body.data?.ranked === true }
      : {};

  const admin = createAdminClient();
  if (!admin) return ok;
  const city = request.headers.get("x-vercel-ip-city");
  await admin.from("events").insert({
    kind: body.kind,
    visitor: body.visitor,
    session: body.session,
    user_id: userId,
    path: clip(body.path, 300),
    referrer: clip(body.referrer, 300),
    source: source(clip(body.referrer, 300), clip(body.utm, 60), request.headers.get("host")),
    device: device(ua),
    country: clip(request.headers.get("x-vercel-ip-country"), 2),
    city: city ? decodeURIComponent(city).slice(0, 80) : null,
    data,
  });
  return ok;
}
