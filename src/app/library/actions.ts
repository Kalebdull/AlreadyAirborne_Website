"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setWatched(clipId: string, watched: boolean) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  if (watched) {
    await supabase
      .from("clip_progress")
      .upsert({ user_id: viewer.id, clip_id: clipId }, { onConflict: "user_id,clip_id", ignoreDuplicates: true });
  } else {
    await supabase.from("clip_progress").delete().eq("user_id", viewer.id).eq("clip_id", clipId);
  }
  revalidatePath("/library", "layout");
  revalidatePath("/dashboard");
}
