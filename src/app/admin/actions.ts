"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; message?: string } | undefined;

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/book");
  revalidatePath("/library", "layout");
  revalidatePath("/");
}

// --- Bookings --------------------------------------------------------------

export async function clearBooking(id: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("zoom_link, payment_instructions").eq("id", 1).single();
  if (!settings?.zoom_link) return { error: "Add your Zoom link in Settings first, so the student gets it." };

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cleared",
      zoom_link: settings.zoom_link,
      payment_instructions: settings.payment_instructions,
      admin_note: null,
    })
    .eq("id", id);
  refresh();
  return error ? { error: error.message } : undefined;
}

export async function declineBooking(id: string, note: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "unable", admin_note: note.trim() || null })
    .eq("id", id);
  refresh();
  return error ? { error: error.message } : undefined;
}

export async function setPaid(id: string, paid: boolean): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ paid }).eq("id", id);
  refresh();
  return error ? { error: error.message } : undefined;
}

export async function cancelBookingAsAdmin(id: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
  refresh();
  return error ? { error: error.message } : undefined;
}

// --- Settings & availability ----------------------------------------------

export async function saveSettings(_: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const timezone = String(formData.get("timezone") ?? "");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { error: "That time zone isn't recognized." };
  }

  const zoomLink = String(formData.get("zoom_link") ?? "").trim();
  if (zoomLink && !/^https:\/\//.test(zoomLink)) return { error: "The Zoom link should start with https://" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      timezone,
      zoom_link: zoomLink || null,
      payment_instructions: String(formData.get("payment_instructions") ?? "").trim() || null,
      booking_window_days: Number(formData.get("booking_window_days") ?? 21),
      min_notice_hours: Number(formData.get("min_notice_hours") ?? 12),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  // Availability: the checked boxes are the full weekly schedule.
  const slots = formData
    .getAll("slot")
    .map(String)
    .map((v) => {
      const [weekday, time] = v.split("@");
      return { weekday: Number(weekday), start_time: time };
    })
    .filter((s) => s.weekday >= 0 && s.weekday <= 6 && /^\d{2}:\d{2}$/.test(s.start_time));

  const del = await supabase.from("availability").delete().gte("weekday", 0);
  if (del.error) return { error: del.error.message };
  if (slots.length) {
    const ins = await supabase.from("availability").insert(slots);
    if (ins.error) return { error: ins.error.message };
  }

  refresh();
  return { message: "Saved. Booking page updated." };
}

// --- Clips & topics --------------------------------------------------------

export async function createClip(input: {
  topicId: string;
  title: string;
  summary: string;
  videoPath: string | null;
  posterPath: string | null;
  durationSeconds: number | null;
  published: boolean;
}): Promise<AdminState> {
  await requireAdmin();
  if (!input.title.trim()) return { error: "Give the clip a title." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("clips")
    .select("position")
    .eq("topic_id", input.topicId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("clips").insert({
    topic_id: input.topicId,
    title: input.title.trim(),
    summary: input.summary.trim() || null,
    video_path: input.videoPath,
    poster_path: input.posterPath,
    duration_seconds: input.durationSeconds,
    published: input.published,
    position: (last?.position ?? -1) + 1,
  });
  refresh();
  return error ? { error: error.message } : { message: "Clip added." };
}

export async function updateClip(
  id: string,
  patch: Partial<{ title: string; summary: string | null; published: boolean; position: number; topic_id: string }>,
): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("clips").update(patch).eq("id", id);
  refresh();
  return error ? { error: error.message } : undefined;
}

export async function deleteClip(id: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: clip } = await supabase.from("clips").select("video_path, poster_path").eq("id", id).single();
  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return { error: error.message };
  const paths = [clip?.video_path, clip?.poster_path].filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from("clips").remove(paths);
  refresh();
  return undefined;
}

export async function createTopic(_: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the topic." };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const supabase = await createClient();
  const { data: last } = await supabase.from("topics").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("topics").insert({ name, slug, position: (last?.position ?? 0) + 1 });
  refresh();
  return error ? { error: error.code === "23505" ? "That topic already exists." : error.message } : { message: `Added ${name}.` };
}

export async function deleteTopic(id: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("topics").delete().eq("id", id);
  refresh();
  return error ? { error: "Move or delete this topic's clips first." } : undefined;
}
