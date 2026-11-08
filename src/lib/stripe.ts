import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyInstructor } from "@/lib/notify";
import { formatPrice, isOral, serviceById } from "@/lib/services";
import type { ServiceId } from "@/lib/services";

// Card payments for confirmed sessions. Without STRIPE_SECRET_KEY the site
// falls back to the written payment instructions from Settings.
const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;

export function sessionLabel(service: ServiceId, hours: number) {
  const s = serviceById(service);
  return isOral(service) ? `${s?.label ?? "Mock oral"} mock oral exam` : `${s?.label ?? "1-on-1 tutoring"} · ${hours} hr`;
}

// Mark a booking paid from a Checkout Session, after checking with Stripe that
// the money actually arrived. Safe to call more than once (the webhook and the
// success redirect both do).
export async function settleCheckout(sessionId: string) {
  if (!stripe || !sessionId.startsWith("cs_")) return false;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const bookingId = session.metadata?.booking_id;
  if (session.payment_status !== "paid" || !bookingId) return false;

  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("bookings")
    .update({ paid: true, paid_at: new Date().toISOString(), stripe_session_id: session.id })
    .eq("id", bookingId)
    .eq("paid", false)
    .select("service, hours, starts_at, price_cents, profiles(full_name, email)");

  // Only the first call flips it; that one sends the heads-up.
  const row = data?.[0];
  if (row) {
    const who = (row.profiles as unknown as { full_name: string | null; email: string | null } | null) ?? null;
    await notifyInstructor(
      `Paid: ${formatPrice(row.price_cents)}`,
      [
        `${who?.full_name ?? who?.email ?? "A student"} paid ${formatPrice(session.amount_total ?? row.price_cents)} by card for ${sessionLabel(row.service, Number(row.hours))}.`,
        `Session: ${new Date(row.starts_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" })} (Pacific)`,
      ],
      { label: "See your schedule", path: "/admin/requests" },
    );
  }
  return true;
}
