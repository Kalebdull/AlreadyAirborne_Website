"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Topic } from "@/lib/data";
import { createClip } from "../actions";

// Supabase's free plan caps uploads at 50 MB per file.
const MAX_BYTES = 50 * 1024 * 1024;

function readDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}

function extension(file: File, fallback: string) {
  return file.name.split(".").pop()?.toLowerCase() || fallback;
}

export function UploadClip({ topics }: { topics: Topic[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ tone: "info" | "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const video = form.get("video") as File | null;
    const poster = form.get("poster") as File | null;
    const hasVideo = video && video.size > 0;
    const hasPoster = poster && poster.size > 0;

    if (hasVideo && video.size > MAX_BYTES) {
      setStatus({ tone: "error", text: `That video is ${(video.size / 1048576).toFixed(0)} MB. Export it under 50 MB (720p works great for 30-second reels).` });
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const id = crypto.randomUUID();
    let videoPath: string | null = null;
    let posterPath: string | null = null;
    let duration: number | null = null;

    try {
      if (hasVideo) {
        setStatus({ tone: "info", text: "Uploading video… keep this tab open." });
        duration = await readDuration(video);
        videoPath = `videos/${id}.${extension(video, "mp4")}`;
        const { error } = await supabase.storage.from("clips").upload(videoPath, video, { contentType: video.type || "video/mp4" });
        if (error) throw error;
      }
      if (hasPoster) {
        setStatus({ tone: "info", text: "Uploading thumbnail…" });
        posterPath = `posters/${id}.${extension(poster, "jpg")}`;
        const { error } = await supabase.storage.from("clips").upload(posterPath, poster, { contentType: poster.type });
        if (error) throw error;
      }

      const result = await createClip({
        topicId: String(form.get("topic_id")),
        title: String(form.get("title") ?? ""),
        summary: String(form.get("summary") ?? ""),
        videoPath,
        posterPath,
        durationSeconds: duration,
        published: form.get("published") === "on",
      });
      if (result?.error) throw new Error(result.error);
      setStatus({ tone: "ok", text: "Clip added." });
      formRef.current?.reset();
    } catch (err) {
      // Don't leave orphaned files behind if the clip row wasn't created.
      const paths = [videoPath, posterPath].filter((p): p is string => Boolean(p));
      if (paths.length) await supabase.storage.from("clips").remove(paths);
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card grid gap-6 p-8 md:grid-cols-2">
      <h2 className="eyebrow md:col-span-2">Add a clip</h2>
      <label className="label">
        Title
        <input className="field" name="title" required placeholder="e.g. Class B vs Class C entry" />
      </label>
      <label className="label">
        Topic
        <select className="field" name="topic_id" required>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="label md:col-span-2">
        Summary (one or two lines)
        <textarea className="field resize-y" name="summary" rows={2} placeholder="The takeaway, in plain words." />
      </label>
      <label className="label">
        Video (vertical MP4, under 50 MB)
        <input className="field file:mr-4 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-1.5 file:text-ink" name="video" type="file" accept="video/mp4,video/quicktime,video/webm" required />
      </label>
      <label className="label">
        Thumbnail (optional)
        <input className="field file:mr-4 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-1.5 file:text-ink" name="poster" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <label className="flex items-center gap-3 text-[15px] text-soft">
        <input type="checkbox" name="published" defaultChecked className="h-5 w-5 accent-cyan" />
        Publish right away
      </label>
      <div className="flex flex-wrap items-center gap-4 md:justify-end">
        {status && (
          <span
            role="status"
            className={`text-[15px] ${status.tone === "error" ? "text-red" : status.tone === "ok" ? "text-green" : "text-amber"}`}
          >
            {status.text}
          </span>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || topics.length === 0}>
          {busy ? "Uploading…" : "Add clip"}
        </button>
      </div>
    </form>
  );
}
