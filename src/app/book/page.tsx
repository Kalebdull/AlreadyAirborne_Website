import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getBookingInputs } from "@/lib/data";
import { buildSlots } from "@/lib/slots";
import { requestTime } from "@/lib/format";
import { serviceById, type ServiceId } from "@/lib/services";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Book a session" };

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const { service } = await searchParams;
  const initialService = (typeof service === "string" && serviceById(service)?.id) || null;

  const now = requestTime();
  const to = new Date(now + 121 * 24 * 3_600_000).toISOString();
  const [viewer, { config, availability, busy }] = await Promise.all([
    getViewer(),
    getBookingInputs(new Date(now).toISOString(), to),
  ]);
  const days = buildSlots(availability, busy, config, now);
  const slots = days.flatMap((d) => d.slots);

  return (
    <main className="px-6 pb-28 pt-12 md:pt-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-11">
        <div className="flex flex-col gap-3">
          <span className="eyebrow">CLNC · Request</span>
          <h1 className="headline text-[48px] md:text-[64px]">Request clearance.</h1>
          <p className="text-[19px] text-mute">Pick what you need and when. Nothing to pay until I confirm.</p>
        </div>

        {!viewer && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-card px-6 py-5">
            <span className="text-mute">You&apos;ll need a free pilot profile to send a request.</span>
            <div className="flex gap-3">
              <Link href="/signup?next=/book" className="btn btn-primary btn-sm">
                Create profile
              </Link>
              <Link href="/login?next=/book" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
            </div>
          </div>
        )}

        <BookingForm
          slots={slots}
          signedIn={Boolean(viewer)}
          studentName={viewer?.fullName ?? null}
          initialService={initialService as ServiceId | null}
        />
      </div>
    </main>
  );
}
