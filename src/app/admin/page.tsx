import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestTime } from "@/lib/format";
import { site } from "@/lib/site";
import { ago, pageLabel, pilotName, sourceLabel, type Stats, type Visit } from "@/lib/admin-stats";

export const metadata: Metadata = { title: "Overview · Admin" };

const RANGES = [7, 30, 90] as const;

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const now = requestTime();
  const nowIso = new Date(now).toISOString();

  const supabase = await createClient();
  const [stats, visits, settings, slots, contests, clips, pending, unpaid, profiles, scores, requests] = await Promise.all([
    supabase.rpc("admin_stats", { days }),
    supabase.rpc("admin_sessions", { max_rows: 25 }),
    supabase.from("settings").select("zoom_link, payment_instructions").eq("id", 1).maybeSingle(),
    supabase.from("availability").select("id", { count: "exact", head: true }),
    supabase.from("contests").select("title, ends_at, starts_at").lte("starts_at", nowIso).gt("ends_at", nowIso).order("ends_at").limit(1),
    supabase.from("clips").select("id, title, published"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending").gt("ends_at", nowIso),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cleared").eq("paid", false).lt("ends_at", nowIso),
    supabase.from("profiles").select("email, full_name, created_at").neq("role", "admin").order("created_at", { ascending: false }).limit(6),
    supabase.from("scores").select("callsign, score, level, updated_at").order("updated_at", { ascending: false }).limit(6),
    supabase.from("bookings").select("service, created_at, status, profiles(email)").order("created_at", { ascending: false }).limit(6),
  ]);

  const s = stats.data as Stats | null;
  const clipTitles = new Map((clips.data ?? []).map((c) => [c.id as string, c.title as string]));
  const published = (clips.data ?? []).filter((c) => c.published).length;
  const contest = contests.data?.[0];
  const daysLeft = contest ? Math.ceil((Date.parse(contest.ends_at) - now) / 86_400_000) : 0;

  const checks: Check[] = [
    settings.data?.zoom_link
      ? { tone: "green", label: "Zoom link", detail: "Set" }
      : { tone: "red", label: "Zoom link", detail: "Missing: students can't join confirmed sessions", href: "/admin/settings" },
    settings.data?.payment_instructions
      ? { tone: "green", label: "Payment instructions", detail: "Set" }
      : { tone: "amber", label: "Payment instructions", detail: "Not set yet", href: "/admin/settings" },
    (slots.count ?? 0) > 0
      ? { tone: "green", label: "Availability", detail: `${slots.count} weekly start times` }
      : { tone: "red", label: "Availability", detail: "No hours set: nobody can request a time", href: "/admin/settings" },
    (pending.count ?? 0) > 0
      ? { tone: "amber", label: "Requests waiting", detail: `${pending.count} to clear or decline`, href: "/admin/requests" }
      : { tone: "green", label: "Requests waiting", detail: "None" },
    (unpaid.count ?? 0) > 0
      ? { tone: "amber", label: "Unpaid sessions", detail: `${unpaid.count} finished, not marked paid`, href: "/admin/requests" }
      : { tone: "green", label: "Unpaid sessions", detail: "None" },
    contest
      ? { tone: daysLeft <= 3 ? "amber" : "green", label: "Contest", detail: `${contest.title}: ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, href: "/admin/contest" }
      : { tone: "amber", label: "Contest", detail: "None running: the leaderboard is closed", href: "/admin/contest" },
    published > 0
      ? { tone: "green", label: "Clip library", detail: `${published} published` }
      : { tone: "amber", label: "Clip library", detail: "No clips published yet", href: "/admin/clips" },
    site.instagram.handle.includes("[")
      ? { tone: "red", label: "Instagram handle", detail: "Still a placeholder in src/lib/site.ts" }
      : { tone: "green", label: "Instagram handle", detail: `@${site.instagram.handle}` },
  ];
  const issues = checks.filter((c) => c.tone !== "green").length;

  type Activity = { at: string; tone: string; text: string; href: string };
  const activity: Activity[] = [
    ...(profiles.data ?? []).map((p) => ({ at: p.created_at as string, tone: "bg-green", text: `New account: ${p.full_name || p.email}`, href: "/admin/students" })),
    ...(scores.data ?? []).map((r) => ({ at: r.updated_at as string, tone: "bg-magenta", text: `${r.callsign} posted ${Number(r.score).toLocaleString()} (L${r.level})`, href: "/admin/contest" })),
    ...(requests.data ?? []).map((b) => {
      const who = (b.profiles as unknown as { email: string | null } | null)?.email ?? "A student";
      return { at: b.created_at as string, tone: "bg-amber", text: `${who} requested ${b.service === "zoom" ? "1-on-1 tutoring" : b.service === "oral_cpl" ? "a Commercial mock oral" : "a Private mock oral"}`, href: "/admin/requests" };
    }),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);

  if (stats.error || !s) {
    return (
      <p className="rounded-2xl bg-red/10 px-5 py-4 text-soft">
        <span className="mr-2 font-mono text-[11px] font-bold tracking-[.08em] text-red">UNABLE</span>
        Stats didn&apos;t load: {stats.error?.message ?? "no data"}.
      </p>
    );
  }

  const t = s.totals;
  const visitList = (visits.data ?? []) as Visit[];

  return (
    <div className="flex flex-col gap-12">
      {/* --- Status line + range ----------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-3 font-mono text-[12px] tracking-[.12em] text-soft">
          <span className="relative flex h-2 w-2">
            {s.live > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60 motion-reduce:animate-none" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${s.live > 0 ? "bg-green" : "bg-dim"}`} />
          </span>
          {s.live > 0 ? `${s.live} ON THE SITE NOW` : "NOBODY ON THE SITE RIGHT NOW"}
          <span className="text-dim">· YOUR OWN VISITS AREN&apos;T COUNTED</span>
        </p>
        <div className="flex gap-1 rounded-full bg-card p-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin?range=${r}`}
              aria-current={r === days ? "true" : undefined}
              className={`press rounded-full px-3.5 py-1.5 font-mono text-[12px] transition-colors ${r === days ? "bg-raised text-ink" : "text-mute hover:text-ink"}`}
            >
              {r}D
            </Link>
          ))}
        </div>
      </div>

      {/* --- KPI band --------------------------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line md:grid-cols-5" aria-label="Key numbers">
        <Kpi label="Visitors" tone="bg-cyan" text="text-cyan" value={t.range.visitors} today={t.today.visitors} sub={`${t.range.pageviews.toLocaleString()} page views`} />
        <Kpi label="Played the game" tone="bg-magenta" text="text-magenta" value={t.range.players} today={t.today.players} sub={pct(t.range.players, t.range.visitors, "of visitors")} />
        <Kpi label="Runs flown" tone="bg-magenta" text="text-ink" value={t.range.runs} today={t.today.runs} sub={`${t.range.landings.toLocaleString()} landings`} />
        <Kpi label="New accounts" tone="bg-green" text="text-green" value={t.range.signups} today={t.today.signups} sub={pct(t.range.signups, t.range.visitors, "of visitors")} />
        <Kpi wide label="Requests" tone="bg-amber" text="text-amber" value={t.range.requests} today={t.today.requests} sub={`${t.range.scores} scores submitted`} />
      </section>

      {/* --- Chart -------------------------------------------------------------------------- */}
      <section className="card flex flex-col gap-5 p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="eyebrow">Last {days} days</h2>
          <div className="flex flex-wrap gap-4 font-mono text-[11px] tracking-[.1em] text-mute">
            <Legend className="bg-cyan/60" label="VISITORS" />
            <Legend className="bg-magenta" label="PLAYED" />
            <Legend className="bg-green" label="SIGNED UP" round />
          </div>
        </div>
        <DayChart days={s.days} />
      </section>

      {/* --- Visits + side column ---------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow">Recent visits</h2>
          {visitList.length === 0 ? (
            <Empty>No visits yet. Once the site is live, every visit shows up here, even if they never sign up.</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {visitList.map((v) => (
                <VisitRow key={v.session} v={v} now={now} clipTitles={clipTitles} />
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section className="card accent-bar relative flex flex-col gap-4 p-6" style={{ ["--bar" as string]: issues ? "var(--color-amber)" : "var(--color-green)" }}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="eyebrow">Preflight checklist</h2>
              <span className={`font-mono text-[11px] font-bold tracking-[.1em] ${issues ? "text-amber" : "text-green"}`}>
                {issues ? `${issues} TO CHECK` : "ALL GREEN"}
              </span>
            </div>
            <ul className="flex flex-col">
              {checks.map((c) => (
                <CheckRow key={c.label} c={c} />
              ))}
            </ul>
          </section>

          <section className="card flex flex-col gap-4 p-6">
            <h2 className="eyebrow">Latest</h2>
            {activity.length === 0 ? (
              <p className="text-[14px] text-mute">New accounts, scores and requests show up here.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {activity.map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="press -mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-raised">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.tone}`} />
                      <span className="flex-1 text-[14px] text-soft">{a.text}</span>
                      <span className="shrink-0 font-mono text-[11px] text-dim">{ago(a.at, now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* --- Game ----------------------------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow text-magenta">The flight game · last {days} days</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card flex flex-col gap-5 p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">How far runs get</h3>
              <span className="font-mono text-[11px] text-dim">LEVELS LANDED PER RUN</span>
            </div>
            <LevelBars levels={s.levels} />
          </div>
          <div className="card flex flex-col gap-4 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl font-semibold">Top pilots</h3>
              <span className="font-mono text-[11px] text-dim">INCLUDING UNSUBMITTED RUNS</span>
            </div>
            {s.pilots.length === 0 ? (
              <p className="text-[14px] text-mute">Nobody has flown yet.</p>
            ) : (
              <ol className="flex flex-col">
                {s.pilots.map((p, i) => (
                  <li key={p.visitor} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                    <span className="w-5 font-mono text-[12px] text-dim">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">
                      {p.email ?? pilotName(p.visitor)}
                      <span className="ml-2 font-mono text-[11px] text-dim">
                        {p.runs} run{p.runs === 1 ? "" : "s"} · {ago(p.last, now)}
                      </span>
                    </span>
                    <span className="font-mono text-[12px] text-mute">L{p.cleared ?? 0}</span>
                    <span className="w-16 text-right font-mono text-[14px] font-bold">{(p.score ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* --- Where from ------------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow">Where visits come from · last {days} days</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <ListCard title="Sources" rows={s.sources.map((r) => [sourceLabel(r.name), r.sessions])} bar="bg-cyan" />
          <ListCard title="Devices" rows={s.devices.map((r) => [cap(r.name), r.sessions])} bar="bg-cyan" />
          <ListCard title="Places" rows={s.places.map((r) => [r.name, r.sessions])} bar="bg-cyan" empty="Shows once the site is live on Vercel." />
          <ListCard title="Top pages" rows={s.pages.map((r) => [pageLabel(r.path, clipTitles), r.views])} bar="bg-cyan" unit="views" />
        </div>
        <p className="text-[13px] text-dim">
          Tip: link your Instagram bio as <span className="font-mono text-soft">{site.url.replace(/^https?:\/\//, "")}/?ref=bio</span> and reel captions with{" "}
          <span className="font-mono text-soft">?ref=reel</span> to see exactly which ones send visitors.
        </p>
      </section>
    </div>
  );
}

// --- Pieces ----------------------------------------------------------------------------------

type Check = { tone: "green" | "amber" | "red"; label: string; detail: string; href?: string };

function CheckRow({ c }: { c: Check }) {
  const dot = { green: "bg-green", amber: "bg-amber", red: "bg-red" }[c.tone];
  const linked = Boolean(c.href) && c.tone !== "green";
  const inner = (
    <>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-medium">{c.label}</span>
        <span className="text-[13px] text-mute">{c.detail}</span>
      </span>
      {linked && <span className="font-mono text-[12px] text-cyan">FIX ›</span>}
    </>
  );
  return (
    <li className="border-t border-line first:border-t-0">
      {linked ? (
        <Link href={c.href!} className="press -mx-2 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-raised">
          {inner}
        </Link>
      ) : (
        <div className="flex items-start gap-3 py-2.5">{inner}</div>
      )}
    </li>
  );
}

function Kpi({ label, value, today, sub, tone, text, wide }: { label: string; value: number; today: number; sub: string; tone: string; text: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 bg-card p-5 md:p-6 ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <span className={`h-[3px] w-8 rounded-full ${tone}`} />
      <span className={`font-display text-4xl font-semibold tabular-nums tracking-[-0.04em] md:text-5xl ${text}`}>{value.toLocaleString()}</span>
      <span className="font-mono text-[11px] uppercase tracking-[.12em] text-soft">{label}</span>
      <span className="text-[12px] text-dim">
        {today > 0 ? <span className="text-green">+{today} today · </span> : null}
        {sub}
      </span>
    </div>
  );
}

function Legend({ className, label, round }: { className: string; label: string; round?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`${round ? "h-2 w-2 rounded-full" : "h-2.5 w-2.5 rounded-sm"} ${className}`} />
      {label}
    </span>
  );
}

function DayChart({ days }: { days: Stats["days"] }) {
  const W = 1000;
  const H = 220;
  const pad = 24;
  const max = Math.max(4, ...days.map((d) => d.visitors));
  const bw = W / days.length;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const fmt = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full md:h-56" preserveAspectRatio="none" role="img" aria-label="Daily visitors, players and sign-ups">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
        ))}
        {days.map((d, i) => {
          const x = i * bw;
          return (
            <g key={d.day}>
              <title>{`${fmt(d.day)}: ${d.visitors} visitors, ${d.players} played, ${d.runs} runs, ${d.signups} sign-ups`}</title>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect x={x + bw * 0.12} y={y(d.visitors)} width={bw * 0.76} height={H - pad - y(d.visitors)} rx={Math.min(4, bw * 0.2)} fill="var(--color-cyan)" opacity={0.55} />
              {d.players > 0 && (
                <rect x={x + bw * 0.32} y={y(d.players)} width={bw * 0.36} height={H - pad - y(d.players)} rx={Math.min(3, bw * 0.15)} fill="var(--color-magenta)" />
              )}
              {d.signups > 0 && <circle cx={x + bw / 2} cy={y(d.visitors) - 10} r={4} fill="var(--color-green)" />}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H - pad} y2={H - pad} stroke="rgba(255,255,255,.15)" strokeWidth={1} />
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-dim">
        <span>{days[0] && fmt(days[0].day)}</span>
        <span>PEAK {max} / DAY</span>
        <span>TODAY</span>
      </div>
    </div>
  );
}

function LevelBars({ levels }: { levels: number[] }) {
  const max = Math.max(1, ...levels);
  const total = levels.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-[14px] text-mute">No runs yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-36 items-end gap-1.5">
        {levels.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${n} run${n === 1 ? "" : "s"} landed ${i} level${i === 1 ? "" : "s"}`}>
            <span className="font-mono text-[10px] text-dim">{n || ""}</span>
            <div className={`w-full rounded-t-md ${i === 10 ? "bg-green" : i === 0 ? "bg-red/60" : "bg-magenta"}`} style={{ height: `${Math.max(n ? 4 : 0, (n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 font-mono text-[10px] text-dim">
        {levels.map((_, i) => (
          <span key={i} className="flex-1 text-center">
            {i}
          </span>
        ))}
      </div>
      <p className="text-[13px] text-mute">
        {pct(levels[0], total, "crash before landing once")}. {levels[10] ? `${levels[10]} run${levels[10] === 1 ? "" : "s"} beat all ten.` : "Nobody has beaten all ten yet."}
      </p>
    </div>
  );
}

function ListCard({ title, rows, bar, unit = "visits", empty = "No data yet." }: { title: string; rows: [string, number][]; bar: string; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <span className="font-mono text-[10px] uppercase text-dim">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-mute">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(([name, n]) => (
            <li key={name} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg px-2.5 py-1.5 text-[13px]">
              <span className={`absolute inset-y-0 left-0 ${bar} opacity-15`} style={{ width: `${(n / max) * 100}%` }} />
              <span className="relative truncate text-soft">{name}</span>
              <span className="relative font-mono text-ink">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitRow({ v, now, clipTitles }: { v: Visit; now: number; clipTitles: Map<string, string> }) {
  const live = now - Date.parse(v.last_seen) < 5 * 60_000;
  const who = v.email ?? pilotName(v.visitor);
  const minutes = Math.round((Date.parse(v.last_seen) - Date.parse(v.started)) / 60_000);
  return (
    <li className="card flex flex-col gap-2.5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`h-2 w-2 rounded-full ${live ? "bg-green" : "bg-dim"}`} title={live ? "On the site now" : undefined} />
        <span className="font-medium">{who}</span>
        {v.is_returning && <span className="rounded-full bg-cyan/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[.08em] text-cyan">RETURNING</span>}
        {v.email && <span className="rounded-full bg-green/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[.08em] text-green">ACCOUNT</span>}
        <span className="ml-auto font-mono text-[11px] text-dim">{live ? "NOW" : ago(v.last_seen, now)}</span>
      </div>
      <p className="text-[13px] text-mute">
        From {sourceLabel(v.source)} · {cap(v.device ?? "unknown")}
        {v.place ? ` · ${v.place}` : ""}
        {minutes > 0 ? ` · ${minutes} min` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {v.runs > 0 && (
          <span className="rounded-full bg-magenta/15 px-2.5 py-1 font-mono text-[11px] text-magenta">
            FLEW {v.runs} RUN{v.runs === 1 ? "" : "S"} · BEST L{v.best_cleared ?? 0} · {(v.best_score ?? 0).toLocaleString()} PTS
          </span>
        )}
        {(v.page_list ?? []).map((p) => (
          <span key={p} className="rounded-full bg-raised px-2.5 py-1 text-[12px] text-soft">
            {pageLabel(p, clipTitles)}
          </span>
        ))}
      </div>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card px-6 py-8 text-center text-mute">{children}</p>;
}

function pct(part: number, whole: number, label: string) {
  if (!whole) return `0% ${label}`;
  return `${Math.round((part / whole) * 100)}% ${label}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

