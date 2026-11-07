import { STUCK_ON } from "@/lib/topics";

// A slow, quiet ticker of the topics students get stuck on.
export function TopicMarquee() {
  const items = [...STUCK_ON, ...STUCK_ON];
  return (
    <div className="marquee relative overflow-hidden border-y border-line bg-[#050506] py-4" aria-label={`Topics covered: ${STUCK_ON.join(", ")}`}>
      <div aria-hidden className="marquee-track flex w-max gap-10 font-mono text-[12px] uppercase tracking-[.14em] text-dim md:text-[13px]">
        {items.map((topic, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className={i % 3 === 0 ? "text-soft" : undefined}>{topic}</span>
            <span className="text-magenta">◆</span>
          </span>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050506] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050506] to-transparent" />
    </div>
  );
}
