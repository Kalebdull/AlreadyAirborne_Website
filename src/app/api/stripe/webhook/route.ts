import { NextResponse, type NextRequest } from "next/server";
import { settleCheckout, stripe } from "@/lib/stripe";

// Stripe calls this when a checkout finishes (including payments that clear
// later). The signature check proves the request really came from Stripe.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return new NextResponse("Not configured", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new NextResponse("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await settleCheckout(event.data.object.id);
  }
  return NextResponse.json({ received: true });
}
