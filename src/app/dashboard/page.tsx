import type { Metadata } from "next";
import Link from "next/link";
import { firstName, requireViewer } from "@/lib/auth";
import { getLibrary, getMyBookings, getWatchedClipIds } from "@/lib/data";
import { serviceById, formatPrice, isOral } from "@/lib/services";
import { Chip, StatusChip } from "@/components/status-chip";
import { LocalTime } from "@/components/local-time";
import { requestTime } from "@/lib/format";
import { CancelButton } from "./cancel-button";
import { Greeting } from "./greeting";
import { payBooking } from "./actions";
import { settleCheckout, stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const viewer = await requireViewer("/dashboard");
  // Back from Stripe Checkout: confirm with Stripe before showing "paid"
  // (the webhook does the same; whichever lands first wins).
  const { paid } = await searchParams;
  const justPaid = typeof paid === "string" && (await settleCheckout(paid).catch(() => false));
  const [bookings, { topics, clips }, watched] = await Promise.all([
    getMyBookings(viewer.id),
    getLibrary(),
    getWatchedClipIds(viewer.id),
  ]);

  const now = requestTime();
  const upcoming = bookings
    .filter((b) => Date.parse(b.ends_at) > now && (b.status === "cleared" || b.status === "pending"))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextCleared = upcoming.find((b) => b.status === "cleared");
  const total = clips.length;
  const done = clips.filter((c) => watched.has(c.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // "Continue": the first unwatched clip in library order.
  const topicOrder = new Map(topics.map((t, i) => [t.id, i]));
  const continueClip = [...clips]
    .sort((a, b) => (topicOrder.get(a.topic_id) ?? 0) - (topicOrder.get(b.topic_id) ?? 0) || a.position - b.position)
    .find((c) => !watched.has(c.id));
  const continueTopic = topics.find((t) => t.id === continueClip?.topic_id);

  return (
    <main className="px-6 pb-24 pt-12 md:pt-14">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">
            <LocalTime iso={new Date(now).toISOString()} format="date" />
          </span>
          <h1 className="headline text-[40px] md:text-[56px]">
            <Greeting />, {firstName(viewer)}.
          </h1>
        </div>

        {justPaid && (
          <p className="rounded-2xl bg-green/10 px-5 py-4 text-soft" role="status">
            <span className="mr-2 font-mono text-[11px] font-bold tracking-[.08em] text-green">PAYMENT RECEIVED</span>
            Thanks! You&apos;re all set. A receipt is on its way to your email.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <section className="card flex flex-col gap-[22px] p-8 md:col-span-2 md:p-9">
            {nextCleared ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="eyebrow">Next session</span>
                  <StatusChip status="cleared" />
                  {nextCleared.paid ? (
                    <Chip tone="paid">Paid</Chip>
                  ) : (
                    <Chip tone="due">Payment due · {formatPrice(nextCleared.price_cents)}</Chip>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="headline text-[34px] md:text-[44px]">
                    <LocalTime iso={nextCleared.starts_at} format="relative" />
                  </span>
                  <span className="text-lg text-mute">
                    {serviceById(nextCleared.service)?.label}
                    {isOral(nextCleared.service) ? " mock oral" : ` · ${nextCleared.hours} hr`}
                    {nextCleared.notes ? ` · “${nextCleared.notes}”` : ""}
                  </span>
                </div>
                {!nextCleared.paid && !stripe && nextCleared.payment_instructions && (
                  <p className="rounded-2xl bg-amber/10 px-5 py-4 text-[15px] leading-relaxed text-soft">
                    <span className="mb-1 block font-mono text-[11px] font-bold tracking-[.08em] text-amber">HOW TO PAY</span>
                    {nextCleared.payment_instructions}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-3">
                  {!nextCleared.paid && stripe && <PayButton id={nextCleared.id} amount={formatPrice(nextCleared.price_cents)} primary />}
                  {nextCleared.zoom_link && (
                    <a href={nextCleared.zoom_link} className={`btn ${!nextCleared.paid && stripe ? "btn-ghost" : "btn-primary"}`} target="_blank" rel="noreferrer">
                      Join Zoom
                    </a>
                  )}
                  <Link href="/book" className="btn btn-ghost">
                    Book another
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">Next session</span>
                <span className="headline text-[34px] md:text-[44px]">
                  {upcoming.length ? "Awaiting clearance." : "Nothing on the schedule."}
                </span>
                <span className="text-lg text-mute">
                  {upcoming.length
                    ? "I'll confirm your request soon. The Zoom link shows up right here."
                    : "Stuck on a topic or a checkride coming up? Grab an hour."}
                </span>
                <div className="mt-auto">
                  <Link href="/book" className="btn btn-primary">
                    Request a session
                  </Link>
                </div>
              </>
            )}
          </section>

          <section aria-label="Library progress" className="card flex flex-col items-center gap-2 p-8">
            <span className="eyebrow self-start">Library</span>
            <Gauge pct={pct} />
            <span className="font-mono text-[11px] text-dim">
              {done} / {total} CLIPS
            </span>
            <span className="text-center text-[15px] text-mute">Watched across all topics</span>
          </section>

          <section className="card flex flex-col gap-2 p-8">
            {continueClip ? (
              <>
                <span className="font-mono text-[11px] uppercase tracking-[.1em] text-magenta">
                  ➔ Continue · {continueTopic?.name}
                </span>
                <span className="font-display text-[22px] font-semibold">{continueClip.title}</span>
                <Link href={`/library/${continueClip.id}`} className="link mt-auto pt-4 text-[15px]">
                  Watch ›
                </Link>
              </>
            ) : (
              <>
                <span className="font-mono text-[11px] uppercase tracking-[.1em] text-green">✓ All caught up</span>
                <span className="font-display text-[22px] font-semibold">
                  {total ? "You've watched every clip." : "Clips are on the way."}
                </span>
                <Link href="/library" className="link mt-auto pt-4 text-[15px]">
                  Open library ›
                </Link>
              </>
            )}
          </section>

          <section className="card flex flex-col p-8 md:col-span-2 md:px-9">
            <span className="eyebrow mb-4">Your requests</span>
            {bookings.length === 0 && <p className="text-mute">No requests yet.</p>}
            <ul>
              {bookings.slice(0, 8).map((b) => {
                const past = Date.parse(b.ends_at) < now;
                return (
                  <li
                    key={b.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line py-3.5 last:border-0 sm:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <span className={past || b.status === "cancelled" ? "text-mute" : ""}>
                      {serviceById(b.service)?.label}
                      {isOral(b.service) ? " mock oral" : ` · ${b.hours} hr`}
                    </span>
                    <span className="text-[15px] text-mute sm:order-none">
                      <LocalTime iso={b.starts_at} />
                    </span>
                    <span>
                      {b.status === "pending" && !past ? <CancelButton id={b.id} /> : null}
                      {b.status === "cleared" && !b.paid && stripe && b.id !== nextCleared?.id ? <PayButton id={b.id} amount={formatPrice(b.price_cents)} /> : null}
                    </span>
                    <span className="justify-self-end">
                      <StatusChip status={b.status} />
                    </span>
                    {b.status === "unable" && b.admin_note && (
                      <span className="col-span-full text-[14px] text-dim">{b.admin_note}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link href="/book" className="link mt-3 text-[15px]">
              Request another session ›
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}

// A 270° arc, like an engine gauge.
function Gauge({ pct }: { pct: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const track = c * 0.75;
  return (
    <div className="relative h-[180px] w-[180px]">
      <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden className="rotate-[135deg]">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#2c2c2e" strokeWidth="12" strokeDasharray={`${track} ${c}`} strokeLinecap="round" />
        {pct > 0 && (
          <circle className="gauge-arc" cx="90" cy="90" r={r} fill="none" stroke="#f048c8" strokeWidth="12" strokeDasharray={`${(track * pct) / 100} ${c}`} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="headline text-[44px]">{pct}%</span>
      </div>
    </div>
  );
}

// Opens Stripe Checkout for one confirmed session (see ./actions.ts).
function PayButton({ id, amount, primary }: { id: string; amount: string; primary?: boolean }) {
  return (
    <form action={payBooking}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={primary ? "btn btn-primary" : "link text-[14px]"}>
        Pay {amount}
        {primary ? <span className="ml-1.5 font-mono text-[11px] opacity-70">CARD · APPLE PAY</span> : " ›"}
      </button>
    </form>
  );
}
