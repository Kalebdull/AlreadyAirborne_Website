import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Clip, Topic } from "@/lib/data";
import { formatDuration } from "@/lib/format";
import { UploadClip } from "./upload-clip";
import { ClipRow } from "./clip-row";
import { TopicForm, DeleteTopicButton } from "./topic-form";

export const metadata: Metadata = { title: "Clips · Admin" };

export default async function AdminClipsPage() {
  // The layout checks too, but layouts and pages render in parallel.
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: topics }, { data: clips }] = await Promise.all([
    supabase.from("topics").select("id, slug, name, position").order("position"),
    supabase.from("clips").select("*").order("position"),
  ]);
  const allTopics = (topics ?? []) as Topic[];
  const allClips = (clips ?? []) as Clip[];

  return (
    <div className="flex flex-col gap-12">
      <UploadClip topics={allTopics} />

      {allTopics.map((topic) => {
        const topicClips = allClips.filter((c) => c.topic_id === topic.id);
        return (
          <section key={topic.id} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h2 className="font-display text-2xl font-semibold">{topic.name}</h2>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-dim">
                  {topicClips.filter((c) => c.published).length} LIVE · {topicClips.length} TOTAL
                </span>
                {topicClips.length === 0 && <DeleteTopicButton id={topic.id} />}
              </div>
            </div>
            {topicClips.length === 0 ? (
              <p className="text-[15px] text-dim">No clips yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topicClips.map((clip) => (
                  <ClipRow
                    key={clip.id}
                    clip={clip}
                    topics={allTopics}
                    duration={clip.duration_seconds ? formatDuration(clip.duration_seconds) : null}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <TopicForm />
    </div>
  );
}
