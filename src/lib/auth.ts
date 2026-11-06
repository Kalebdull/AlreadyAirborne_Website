import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

export type Viewer = {
  id: string;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
};

// The one place that reads the session. Cached per request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: profile?.email ?? (data.claims.email as string | undefined) ?? null,
    fullName: profile?.full_name ?? null,
    isAdmin: profile?.role === "admin",
  };
});

export async function requireViewer(next: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (!viewer.isAdmin) redirect("/dashboard");
  return viewer;
}

export function firstName(viewer: Viewer) {
  return viewer.fullName?.split(" ")[0] ?? "pilot";
}
