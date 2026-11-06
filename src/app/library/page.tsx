import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { getViewer } from "@/lib/auth";
import { getLibrary, getWatchedClipIds, type Clip } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const [viewer, { topics, clips }] = await Promise.all([getViewer(), getLibrary()]);
  const watched = viewer ? await getWatchedClipIds(viewer.id) : new Set<string>();

  // Posters live in the private bucket, so only signed-in viewers get them.
  const posters = new Map<string, string>();
  if (viewer) {
    const paths = clips.map((c) => c.poster_path).filter((p): p is string => Boolean(p));
    if (paths.length) {
      const supabase = await createClient();
      const { data } = await supabase.storage.from("clips").createSignedUrls(paths, 3600);
      for (const item of data ?? []) if (item.path && item.signedUrl) posters.set(item.path, item.signedUrl);
    }
  }

  const total = clips.length;
  const done = clips.filter((c) => watched.has(c.id)).length;

  return (
    <main className="px-6 pb-28 pt-14 md:pt-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">The library</span>
            <h1 className="headline text-[48px] md:text-[72px]">
              Hard topics.
              <br />
              <span className="text-dim">Thirty seconds each.</span>
            </h1>
          </div>
          {viewer ? (
            total > 0 && (
              <div className="flex flex-col items-end gap-1">
                <span className="font-display text-4xl font-bold tracking-[-.03em]">
                  {done}
                  <span className="text-dim"> / {total}</span>
                </span>
                <span className="eyebrow">Clips watched</span>
              </div>
            )
          ) : (
            <Link href="/signup?next=/library" className="btn btn-primary">
              Create free account to watch
            </Link>
          )}
        </div>

        {total === 0 && (
          <div className="card flex flex-col gap-3 p-10">
            <span className="font-mono text-xs tracking-[.12em] text-amber">● ACQUIRING CLIPS</span>
            <p className="text-lg text-mute">The first clips are on the way. Follow along on Instagram in the meantime.</p>
          </div>
        )}

        {topics.map((topic) => {
          const topicClips = clips.filter((c) => c.topic_id === topic.id);
          if (topicClips.length === 0) return null;
          return (
            <section key={topic.id} id={topic.slug} className="flex scroll-mt-20 flex-col gap-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
                <h2 className="font-display text-[28px] font-semibold tracking-[-.02em] md:text-[34px]">{topic.name}</h2>
                <span className="font-mono text-xs text-dim">
                  {viewer ? `${topicClips.filter((c) => watched.has(c.id)).length} / ` : ""}
                  {topicClips.length} CLIPS
                </span>
              </div>
              <div className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5">
                {topicClips.map((clip, i) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    index={i + 1}
                    watched={watched.has(clip.id)}
                    poster={clip.poster_path ? posters.get(clip.poster_path) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function ClipCard({ clip, index, watched, poster }: { clip: Clip; index: number; watched: boolean; poster?: string }) {
  return (
    <Link
      href={`/library/${clip.id}`}
      className="group flex w-[46vw] max-w-[220px] shrink-0 snap-start flex-col gap-3 md:w-auto md:max-w-none"
    >
      <ViewTransition name={`clip-${clip.id}`} share="morph" default="none">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[22px] bg-card shadow-[0_0_0_1px_#2c2c2e] transition-transform duration-500 group-hover:-translate-y-1.5">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-end p-4">
            <span className="font-display text-lg font-semibold leading-tight text-soft">{clip.title}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 font-mono text-[11px] text-dim">{String(index).padStart(2, "0")}</span>
        {watched && (
          <span className="absolute right-3 top-3 rounded-full bg-green/15 px-2 py-0.5 font-mono text-[11px] font-bold text-green">
            ✓
          </span>
        )}
        {clip.duration_seconds ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">
            {formatDuration(clip.duration_seconds)}
          </span>
        ) : null}
      </div>
      </ViewTransition>
      <span className={`text-[15px] leading-snug ${watched ? "text-mute" : "text-ink"}`}>{clip.title}</span>
    </Link>
  );
}
