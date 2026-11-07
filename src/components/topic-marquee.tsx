import { STUCK_ON } from "@/lib/topics";

// A solid accent strip of the topics students get stuck on.
export function TopicMarquee() {
  const items = [...STUCK_ON, ...STUCK_ON];
  return (
    <div className="marquee overflow-hidden bg-magenta py-3.5" aria-label={`Topics covered: ${STUCK_ON.join(", ")}`}>
      <div aria-hidden className="marquee-track flex w-max items-center gap-6 text-[12px] font-semibold uppercase tracking-[2px] text-black">
        {items.map((topic, i) => (
          <span key={i} className="flex items-center gap-6 whitespace-nowrap">
            {topic}
            <span className="h-1 w-1 rounded-full bg-black/40" />
          </span>
        ))}
      </div>
    </div>
  );
}
