import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  // The layout checks too, but layouts and pages render in parallel.
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: settings }, { data: availability }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("availability").select("weekday, start_time"),
  ]);

  return (
    <SettingsForm
      settings={{
        timezone: settings?.timezone ?? "America/Los_Angeles",
        zoom_link: settings?.zoom_link ?? "",
        payment_instructions: settings?.payment_instructions ?? "",
        booking_window_days: settings?.booking_window_days ?? 21,
        min_notice_hours: settings?.min_notice_hours ?? 12,
      }}
      slots={(availability ?? []).map((a) => `${a.weekday}@${String(a.start_time).slice(0, 5)}`)}
    />
  );
}
