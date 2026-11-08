import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import type { AvailabilityRow, BookingConfig, Busy } from "@/lib/slots";
import type { ServiceId } from "@/lib/services";

export type Topic = { id: string; slug: string; name: string; position: number };
export type Clip = {
  id: string;
  topic_id: string;
  title: string;
  summary: string | null;
  video_path: string | null;
  poster_path: string | null;
  duration_seconds: number | null;
  position: number;
  published: boolean;
};
export type BookingStatus = "pending" | "cleared" | "unable" | "cancelled";
export type Booking = {
  id: string;
  user_id: string;
  service: ServiceId;
  hours: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: BookingStatus;
  price_cents: number;
  paid: boolean;
  zoom_link: string | null;
  payment_instructions: string | null;
  admin_note: string | null;
  stripe_session_id?: string | null; // set when paid by card through Stripe
  paid_at?: string | null;
  created_at: string;
};

const CLIP_COLUMNS =
  "id, topic_id, title, summary, video_path, poster_path, duration_seconds, position, published";

export async function getLibrary() {
  if (!hasSupabase) return { topics: [] as Topic[], clips: [] as Clip[] };
  const supabase = await createClient();
  const [topics, clips] = await Promise.all([
    supabase.from("topics").select("id, slug, name, position").order("position"),
    supabase.from("clips").select(CLIP_COLUMNS).eq("published", true).order("position"),
  ]);
  return { topics: (topics.data ?? []) as Topic[], clips: (clips.data ?? []) as Clip[] };
}

export async function getClip(id: string) {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("clips").select(CLIP_COLUMNS).eq("id", id).maybeSingle();
  return data as Clip | null;
}

export async function getWatchedClipIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clip_progress").select("clip_id").eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.clip_id as string));
}

export async function signedUrl(path: string | null, seconds = 60 * 60) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("clips").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function getBookingInputs(fromIso: string, toIso: string) {
  const fallback: BookingConfig = { timezone: "America/Los_Angeles", booking_window_days: 21, min_notice_hours: 12 };
  if (!hasSupabase) return { config: fallback, availability: [] as AvailabilityRow[], busy: [] as Busy[] };

  const supabase = await createClient();
  const [config, availability, busy] = await Promise.all([
    supabase.rpc("booking_config").maybeSingle(),
    supabase.from("availability").select("weekday, start_time"),
    supabase.rpc("busy_slots", { p_from: fromIso, p_to: toIso }),
  ]);
  return {
    config: (config.data as BookingConfig | null) ?? fallback,
    availability: (availability.data ?? []) as AvailabilityRow[],
    busy: (busy.data ?? []) as Busy[],
  };
}

export async function getMyBookings(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("starts_at", { ascending: false });
  return (data ?? []).map(normalizeBooking);
}

export function normalizeBooking(row: Record<string, unknown>): Booking {
  return { ...(row as Booking), hours: Number(row.hours) };
}
