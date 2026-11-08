import "server-only";

// Shapes returned by the admin_stats / admin_sessions SQL functions
// (supabase/migrations/20261108000000_analytics.sql).

export type Totals = {
  visitors: number;
  pageviews: number;
  players: number;
  runs: number;
  landings: number;
  signups: number;
  scores: number;
  requests: number;
};

export type Stats = {
  since: string;
  totals: { today: Totals; week: Totals; range: Totals };
  days: { day: string; visitors: number; players: number; runs: number; signups: number }[];
  sources: { name: string; sessions: number }[];
  devices: { name: string; sessions: number }[];
  places: { name: string; sessions: number }[];
  pages: { path: string; views: number; visitors: number }[];
  levels: number[];
  pilots: { visitor: string; score: number | null; cleared: number | null; runs: number; last: string; email: string | null }[];
  live: number;
};

export type Visit = {
  session: string;
  visitor: string;
  started: string;
  last_seen: string;
  email: string | null;
  source: string | null;
  device: string | null;
  place: string | null;
  pages: number;
  page_list: string[] | null;
  runs: number;
  best_score: number | null;
  best_cleared: number | null;
  is_returning: boolean;
};

export function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

// "Pilot 3F9A": a stable short name for an anonymous visitor.
export function pilotName(visitor: string) {
  return `Pilot ${visitor.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct / typed in",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X / Twitter",
  reddit: "Reddit",
  bio: "Instagram bio link",
  reel: "Instagram reel",
  story: "Instagram story",
};

export function sourceLabel(source: string | null) {
  return SOURCE_LABELS[source ?? "direct"] ?? source ?? "Direct";
}

export function pageLabel(path: string, clipTitles: Map<string, string>) {
  if (path === "/") return "Home";
  const clip = path.match(/^\/library\/([0-9a-f-]{36})/);
  if (clip) return `Clip: ${clipTitles.get(clip[1]) ?? "deleted clip"}`;
  const names: Record<string, string> = {
    "/library": "Clip library",
    "/book": "Book a session",
    "/leaderboard": "Leaderboard",
    "/leaderboard/rules": "Contest rules",
    "/signup": "Sign up",
    "/login": "Sign in",
    "/dashboard": "Student dashboard",
    "/privacy": "Privacy",
  };
  return names[path] ?? path;
}
