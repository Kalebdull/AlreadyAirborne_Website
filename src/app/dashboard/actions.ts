"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeBooking } from "@/lib/data";
import { sessionLabel, stripe } from "@/lib/stripe";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

// Send the student to Stripe Checkout for one confirmed, unpaid session.
// The price comes from the booking row (set by the database), never the form.
export async function payBooking(formData: FormData) {
  const viewer = await requireViewer("/dashboard");
  if (!stripe) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").eq("id", String(formData.get("id") ?? "")).eq("user_id", viewer.id).maybeSingle();
  if (!data) redirect("/dashboard");
  const b = normalizeBooking(data);
  if (b.status !== "cleared" || b.paid || b.price_cents <= 0) redirect("/dashboard");

  const base = await origin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Live 1-on-1 tutoring is a service, not a digital product, so Stripe's
    // Managed Payments (on by default for new accounts) doesn't apply.
    managed_payments: { enabled: false },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: b.price_cents,
          product_data: {
            name: sessionLabel(b.service, b.hours),
            description: `With Kaleb Dull, CFI · ${new Date(b.starts_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT`,
          },
        },
      },
    ],
    customer_email: viewer.email ?? undefined,
    client_reference_id: b.id,
    metadata: { booking_id: b.id },
    payment_intent_data: { metadata: { booking_id: b.id } },
    success_url: `${base}/dashboard?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/dashboard`,
  });
  redirect(session.url ?? "/dashboard");
}
