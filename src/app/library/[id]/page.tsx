import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClip, getLibrary, getWatchedClipIds, signedUrl } from "@/lib/data";
import { formatDuration } from "@/lib/format";
import { ClipPlayer } from "./clip-player";

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const clip = await getClip((await params).id);
  return { title: clip?.title ?? "Clip" };
}

export default async function ClipPage({ params }: PageProps<"/library/[id]">) {
  const { id } = await params;
  const [viewer, clip, { topics, clips }] = await Promise.all([getViewer(), getClip(id), getLibrary()]);
  if (!clip || (!clip.published && !viewer?.isAdmin)) notFound();

  const topic = topics.find((t) => t.id === clip.topic_id);
  const playlist = clips.filter((c) => c.topic_id === clip.topic_id);
  const index = playlist.findIndex((c) => c.id === clip.id);
  const laterTopics = topics.slice(topics.findIndex((t) => t.id === clip.topic_id) + 1);
  const next =
    playlist[index + 1] ??
    laterTopics.map((t) => clips.find((c) => c.topic_id === t.id)).find(Boolean);
  const watched = viewer ? await getWatchedClipIds(viewer.id) : new Set<string>();
  const [video, poster] = viewer
    ? await Promise.all([signedUrl(clip.video_path), signedUrl(clip.poster_path)])
    : [null, null];

  return (
    <main className="px-6 pb-28 pt-10 md:pt-12">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <nav aria-label="Breadcrumb" className="flex gap-2.5 text-[13px] text-mute">
          <Link href="/library" className="hover:text-ink">
            ‹ Library
          </Link>
          <span>/</span>
          <Link href={`/library#${topic?.slug ?? ""}`} className="text-ink">
            {topic?.name}
          </Link>
        </nav>

        <div className="flex flex-wrap items-start gap-12">
          <ViewTransition name={`clip-${clip.id}`} share="morph" default="none">
          <div className="mx-auto w-full max-w-[380px] shrink-0">
            {viewer ? (
              <ClipPlayer clipId={clip.id} src={video} poster={poster} watched={watched.has(clip.id)} />
            ) : (
              <div className="flex aspect-[9/16] flex-col items-center justify-center gap-5 rounded-[32px] bg-card p-8 text-center shadow-[0_0_0_1px_#2c2c2e]">
                <span className="font-mono text-xs tracking-[.12em] text-amber">● CLEARANCE REQUIRED</span>
                <p className="font-display text-2xl font-semibold leading-tight">Create a free account to watch.</p>
                <Link href={`/signup?next=/library/${clip.id}`} className="btn btn-primary">
                  Create free account
                </Link>
                <Link href={`/login?next=/library/${clip.id}`} className="link text-[15px]">
                  I have an account
                </Link>
              </div>
            )}
          </div>
          </ViewTransition>

          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-xs uppercase tracking-[.12em] text-magenta">
                ➔ {topic?.name} · Clip {index + 1} of {playlist.length}
              </span>
              <h1 className="headline text-[40px] leading-[1.02] md:text-[52px]">{clip.title}</h1>
              {clip.summary && <p className="text-lg leading-relaxed text-mute">{clip.summary}</p>}
            </div>

            {next && (
              <div>
                <Link href={`/library/${next.id}`} className="btn btn-primary">
                  Next clip ›
                </Link>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl bg-card">
              <div className="flex justify-between px-[22px] py-[18px] font-mono text-xs uppercase tracking-[.1em] text-dim">
                <span>{topic?.name}</span>
                {viewer && (
                  <span>
                    {playlist.filter((c) => watched.has(c.id)).length} / {playlist.length} watched
                  </span>
                )}
              </div>
              {playlist.map((c) => {
                const active = c.id === clip.id;
                const done = watched.has(c.id);
                return (
                  <Link
                    key={c.id}
                    href={`/library/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`grid grid-cols-[24px_1fr_auto] items-center gap-3.5 border-t border-line px-[22px] py-3.5 hover:bg-raised ${
                      active ? "bg-magenta/10 text-magenta" : done ? "text-mute" : "text-ink"
                    }`}
                  >
                    <span className="font-mono" aria-hidden>
                      {active ? "➔" : done ? <span className="text-green">✓</span> : ""}
                    </span>
                    <span>{c.title}</span>
                    <span className="font-mono text-xs text-dim">
                      {c.duration_seconds ? formatDuration(c.duration_seconds) : ""}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl px-7 py-6 shadow-[inset_0_0_0_1px_rgba(34,211,238,.4)]">
              <div className="flex flex-col gap-1">
                <span className="font-display text-[22px] font-semibold">Still fuzzy on this one?</span>
                <span className="text-[15px] text-mute">Book an hour and we&apos;ll work through it together. $50.</span>
              </div>
              <Link href="/book?service=zoom" className="btn btn-primary btn-sm">
                Book 1-on-1
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
