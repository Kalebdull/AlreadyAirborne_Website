import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { LocalTime } from "@/components/local-time";
import { ContestForm } from "./contest-form";
import { DeleteScoreButton } from "./delete-score";

export const metadata: Metadata = { title: "Contest · Admin" };

type ContestRow = { id: string; title: string; prize: string; starts_at: string; ends_at: string };
type ScoreRow = {
  id: string;
  callsign: string;
  email: string;
  marketing_opt_in: boolean;
  score: number;
  distance: number | null;
  sink: number | null;
  updated_at: string;
};

export default async function AdminContestPage({ searchParams }: PageProps<"/admin/contest">) {
  await requireAdmin();
  const { id } = await searchParams;
  const supabase = await createClient();
  const { data: contests } = await supabase.from("contests").select("id, title, prize, starts_at, ends_at").order("ends_at", { ascending: false });
  const all = (contests ?? []) as ContestRow[];
  const now = new Date().toISOString();
  const selected = all.find((c) => c.id === id) ?? all.find((c) => c.starts_at <= now && c.ends_at > now) ?? all[0];

  const { data: scores } = selected
    ? await supabase
        .from("scores")
        .select("id, callsign, email, marketing_opt_in, score, distance, sink, updated_at")
        .eq("contest_id", selected.id)
        .order("score", { ascending: false })
        .order("updated_at", { ascending: true })
        .limit(200)
    : { data: [] };
  const rows = (scores ?? []) as ScoreRow[];
  const optIns = rows.filter((r) => r.marketing_opt_in).map((r) => r.email);

  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-4 md:grid-cols-2">
        {selected && <ContestForm key={selected.id} contest={selected} />}
        <ContestForm key="new" contest={null} />
      </section>

      {all.length > 1 && (
        <nav aria-label="Contests" className="flex flex-wrap gap-2">
          {all.map((c) => (
            <a
              key={c.id}
              href={`/admin/contest?id=${c.id}`}
              className={`rounded-full px-4 py-2 text-[14px] ${c.id === selected?.id ? "bg-raised text-ink" : "text-mute hover:text-ink"}`}
            >
              {c.title}
            </a>
          ))}
        </nav>
      )}

      {selected && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="eyebrow">
              {selected.title} · {rows.length} entries
            </h2>
            {optIns.length > 0 && (
              <a
                className="link text-[14px]"
                href={`mailto:?bcc=${encodeURIComponent(optIns.join(","))}`}
                title="Opens your email app with everyone who opted in to updates, in BCC"
              >
                Email the {optIns.length} who opted in ›
              </a>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="text-mute">No entries yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-card">
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead className="font-mono text-[11px] uppercase tracking-[.1em] text-dim">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Callsign</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-4 py-3 text-right">Distance</th>
                    <th className="px-4 py-3 text-right">Sink</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className={`border-t border-line ${i === 0 ? "bg-magenta/10" : ""}`}>
                      <td className="px-4 py-3 font-mono text-dim">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">{r.callsign}</td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${r.email}`} className="link">
                          {r.email}
                        </a>
                        {r.marketing_opt_in && <span className="ml-2 font-mono text-[10px] text-green">OPT-IN</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{r.score.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-mute">{r.distance ?? "—"} ft</td>
                      <td className="px-4 py-3 text-right font-mono text-mute">{r.sink ?? "—"}</td>
                      <td className="px-4 py-3 text-mute">
                        <LocalTime iso={r.updated_at} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteScoreButton id={r.id} callsign={r.callsign} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
