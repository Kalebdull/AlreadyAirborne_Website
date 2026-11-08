"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyInstructor } from "@/lib/notify";
import { site } from "@/lib/site";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoursFor, serviceById, ZOOM_LENGTHS } from "@/lib/services";

export type BookingState = { error?: string; ok?: boolean } | undefined;

export async function requestBooking(_: BookingState, formData: FormData): Promise<BookingState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/book");

  const service = serviceById(String(formData.get("service") ?? ""));
  const startsAt = String(formData.get("starts_at") ?? "");
  const zoomHours = Number(formData.get("hours") ?? 1);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;

  if (!service) return { error: "Pick a service." };
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return { error: "Pick an open time." };
  if (!ZOOM_LENGTHS.includes(zoomHours as (typeof ZOOM_LENGTHS)[number])) return { error: "Pick a length." };

  // Price, end time and availability are enforced by the database trigger;
  // the client only says what and when.
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").insert({
    user_id: viewer.id,
    service: service.id,
    hours: hoursFor(service.id, zoomHours),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(startsAt).toISOString(),
    price_cents: 0,
    notes,
  });

  if (error) {
    if (error.code === "23P01") return { error: "Someone just grabbed that time. Pick another slot." };
    if (error.code === "P0001") return { error: `${error.message}. Pick another slot.` };
    return { error: "Couldn't send that request. Try again in a moment." };
  }

  after(() => {
    const when = new Date(startsAt).toLocaleString("en-US", { timeZone: site.timezone, dateStyle: "full", timeStyle: "short" });
    return notifyInstructor(
      `New request: ${service.label}`,
      [
        `${viewer.fullName ?? viewer.email} (${viewer.email}) requested ${service.label}.`,
        `When: ${when} (Pacific)`,
        notes ? `Their note: ${notes}` : "No note.",
      ],
      { label: "Clear or decline it", path: "/admin/requests" },
    );
  });

  revalidatePath("/dashboard");
  revalidatePath("/book");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function cancelBooking(id: string) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  revalidatePath("/dashboard");
  revalidatePath("/book");
  revalidatePath("/admin", "layout");
}
