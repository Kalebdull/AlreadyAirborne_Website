import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeBooking, type Booking } from "@/lib/data";
import { formatPrice, isOral, serviceById } from "@/lib/services";
import { StatusChip, Chip } from "@/components/status-chip";
import { LocalTime } from "@/components/local-time";
import { requestTime } from "@/lib/format";
import { BookingActions } from "./booking-actions";

export const metadata: Metadata = { title: "Admin" };

type Row = Booking & { profiles: { full_name: string | null; email: string | null } | null };

export default async function AdminRequestsPage() {
  // The layout checks too, but layouts and pages render in parallel.
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, profiles(full_name, email)")
      .order("starts_at", { ascending: true })
      .limit(300),
    supabase.from("settings").select("zoom_link").eq("id", 1).single(),
  ]);
  const rows = (data ?? []).map((r) => ({ ...normalizeBooking(r), profiles: r.profiles })) as Row[];

  const now = requestTime();
  const live = (b: Row) => Date.parse(b.ends_at) > now;
  const pending = rows.filter((b) => b.status === "pending" && live(b));
  const upcoming = rows.filter((b) => b.status === "cleared" && live(b));
  const unpaid = rows.filter((b) => b.status === "cleared" && !live(b) && !b.paid);
  const history = rows
    .filter((b) => !pending.includes(b) && !upcoming.includes(b) && !unpaid.includes(b))
    .reverse()
    .slice(0, 30);

  return (
    <div className="flex flex-col gap-12">
      {!settings?.zoom_link && (
        <p className="rounded-2xl bg-amber/10 px-5 py-4 text-soft">
          <span className="mr-2 font-mono text-[11px] font-bold tracking-[.08em] text-amber">CAUTION</span>
          Add your Zoom link and payment instructions in{" "}
          <Link href="/admin/settings" className="link">
            Settings
          </Link>{" "}
          before clearing requests.
        </p>
      )}

      <Group title="Awaiting clearance" tone="text-amber" rows={pending} now={now} empty="No pending requests. Quiet frequency." />
      <Group title="Upcoming" tone="text-green" rows={upcoming} now={now} empty="Nothing cleared on the schedule yet." />
      {unpaid.length > 0 && <Group title="Done, payment outstanding" tone="text-amber" rows={unpaid} now={now} empty="" />}
      <Group title="History" tone="text-dim" rows={history} now={now} empty="No history yet." compact />
    </div>
  );
}

function Group({
  title,
  tone,
  rows,
  now,
  empty,
  compact,
}: {
  title: string;
  tone: string;
  rows: Row[];
  now: number;
  empty: string;
  compact?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={`eyebrow ${tone}`}>
        {title} · {rows.length}
      </h2>
      {rows.length === 0 ? (
        <p className="text-mute">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((b) => (
            <li key={b.id} className={`card flex flex-wrap items-start justify-between gap-5 ${compact ? "!rounded-2xl px-6 py-4" : "p-6"}`}>
              <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={b.status} />
                  {b.status === "cleared" && (b.paid ? <Chip tone="paid">Paid</Chip> : <Chip tone="due">Unpaid</Chip>)}
                  <span className="font-mono text-xs text-dim">{formatPrice(b.price_cents)}</span>
                </div>
                <span className={`font-display font-semibold ${compact ? "text-lg" : "text-[22px]"}`}>
                  <LocalTime iso={b.starts_at} /> · {serviceById(b.service)?.label}
                  {isOral(b.service) ? " mock oral" : ` · ${b.hours} hr`}
                </span>
                <span className="text-[15px] text-mute">
                  {b.profiles?.full_name ?? "Student"}
                  {b.profiles?.email && (
                    <>
                      {" · "}
                      <a href={`mailto:${b.profiles.email}`} className="link">
                        {b.profiles.email}
                      </a>
                    </>
                  )}
                </span>
                {b.notes && !compact && <p className="mt-1 rounded-xl bg-raised px-4 py-3 text-[15px] text-soft">“{b.notes}”</p>}
                {b.admin_note && <p className="text-[14px] text-dim">Note: {b.admin_note}</p>}
              </div>
              <BookingActions id={b.id} status={b.status} paid={b.paid} past={Date.parse(b.ends_at) < now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
