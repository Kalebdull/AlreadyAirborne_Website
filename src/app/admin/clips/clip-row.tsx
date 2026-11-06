"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Clip, Topic } from "@/lib/data";
import { deleteClip, updateClip, type AdminState } from "../actions";

export function ClipRow({ clip, topics, duration }: { clip: Clip; topics: Topic[]; duration: string | null }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(clip.title);
  const [summary, setSummary] = useState(clip.summary ?? "");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<AdminState>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="w-8 font-mono text-xs text-dim">{String(clip.position + 1).padStart(2, "0")}</span>
        <span className={`flex-1 ${clip.published ? "" : "text-mute"}`}>
          <Link href={`/library/${clip.id}`} className="hover:text-cyan">
            {clip.title}
          </Link>
        </span>
        <span className="font-mono text-xs text-dim">{duration ?? (clip.video_path ? "" : "NO VIDEO")}</span>
        <select
          aria-label="Topic"
          className="rounded-full border border-line bg-raised px-3 py-1.5 text-[13px]"
          defaultValue={clip.topic_id}
          disabled={pending}
          onChange={(e) => run(() => updateClip(clip.id, { topic_id: e.target.value }))}
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Order"
          type="number"
          min={1}
          defaultValue={clip.position + 1}
          disabled={pending}
          className="w-16 rounded-full border border-line bg-raised px-3 py-1.5 text-center font-mono text-[13px]"
          onBlur={(e) => {
            const position = Number(e.target.value) - 1;
            if (position >= 0 && position !== clip.position) run(() => updateClip(clip.id, { position }));
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => updateClip(clip.id, { published: !clip.published }))}
          className={`btn btn-sm ${clip.published ? "bg-green/15 text-green" : "btn-ghost"}`}
        >
          {clip.published ? "Live" : "Draft"}
        </button>
        <button type="button" className="text-[13px] text-mute hover:text-ink" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="text-[13px] text-dim hover:text-red"
          onClick={() => {
            if (confirm(`Delete “${clip.title}” and its video? This can't be undone.`)) run(() => deleteClip(clip.id));
          }}
        >
          Delete
        </button>
      </div>
      {editing && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          <textarea
            className="field resize-y"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-label="Summary"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm self-start"
            disabled={pending}
            onClick={() => run(() => updateClip(clip.id, { title: title.trim(), summary: summary.trim() || null }), () => setEditing(false))}
          >
            Save
          </button>
        </div>
      )}
      {error && <span className="text-[13px] text-red">{error}</span>}
    </li>
  );
}
