import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestTime } from "@/lib/format";
import { ago } from "@/lib/admin-stats";
import { LocalTime } from "@/components/local-time";

export const metadata: Metadata = { title: "Students · Admin" };

type Student = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "student" | "admin";
  joined: string;
  last_seen: string | null;
  clips_watched: number;
  requests: number;
  sessions_done: number;
  best_cleared: number | null;
};

export default async function AdminStudentsPage() {
  await requireAdmin();
  const now = requestTime();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_students");
  const all = ((data ?? []) as Student[]).filter((s) => s.role !== "admin");
  const week = all.filter((s) => now - Date.parse(s.joined) < 7 * 86_400_000).length;
  const active = all.filter((s) => s.last_seen && now - Date.parse(s.last_seen) < 7 * 86_400_000).length;
  const booked = all.filter((s) => s.requests > 0).length;
  const emails = all.map((s) => s.email).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-10">
      {error && (
        <p className="rounded-2xl bg-red/10 px-5 py-4 text-soft">
          <span className="mr-2 font-mono text-[11px] font-bold tracking-[.08em] text-red">UNABLE</span>
          {error.message}
        </p>
      )}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line md:grid-cols-4" aria-label="Student numbers">
        <Stat label="Accounts" value={all.length} tone="text-ink" />
        <Stat label="Joined this week" value={week} tone="text-green" />
        <Stat label="Active this week" value={active} tone="text-cyan" />
        <Stat label="Have booked" value={booked} tone="text-amber" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="eyebrow">Everyone with an account · {all.length}</h2>
          {emails.length > 0 && (
            <a className="link text-[14px]" href={`mailto:?bcc=${encodeURIComponent(emails.join(","))}`} title="Opens your email app with every student in BCC">
              Email all {emails.length} ›
            </a>
          )}
        </div>
        {all.length === 0 ? (
          <p className="card px-6 py-8 text-center text-mute">No student accounts yet. New sign-ups appear here the moment they confirm their email.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-card">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <thead className="font-mono text-[11px] uppercase tracking-[.1em] text-dim">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3 text-right">Clips</th>
                  <th className="px-4 py-3 text-right">Requests</th>
                  <th className="px-4 py-3 text-right">Sessions</th>
                  <th className="px-4 py-3 text-right">Game</th>
                </tr>
              </thead>
              <tbody>
                {all.map((s) => (
                  <tr key={s.id} className="border-t border-line transition-colors hover:bg-raised">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{s.full_name || "—"}</span>
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="link text-[13px]">
                            {s.email}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-mute">
                      <LocalTime iso={s.joined} format="date" />
                    </td>
                    <td className="px-4 py-3 text-mute">{s.last_seen ? ago(s.last_seen, now) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.clips_watched}</td>
                    <td className={`px-4 py-3 text-right font-mono ${s.requests ? "text-amber" : "text-dim"}`}>{s.requests}</td>
                    <td className={`px-4 py-3 text-right font-mono ${s.sessions_done ? "text-green" : "text-dim"}`}>{s.sessions_done}</td>
                    <td className="px-4 py-3 text-right font-mono text-mute">{s.best_cleared === null ? "—" : `L${s.best_cleared}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[13px] text-dim">
          Last seen and game levels count only visits made while signed in. Sessions are finished, confirmed bookings.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5 md:p-6">
      <span className={`font-display text-4xl font-semibold tabular-nums tracking-[-0.04em] ${tone}`}>{value.toLocaleString()}</span>
      <span className="font-mono text-[11px] uppercase tracking-[.12em] text-soft">{label}</span>
    </div>
  );
}
