import { SectionHeader } from "@/components/section-header";

const QUESTIONS: [string, string][] = [
  ["Do I need to be in San Jose?", "No. Tutoring and mock orals happen on Zoom, so you can join from anywhere."],
  ["When do I pay?", "After I confirm your request. Your dashboard shows how to pay right next to the Zoom link, so you never pay for a time that didn't work out."],
  ["What do I need for a Zoom session?", "A computer or tablet with Zoom, plus whatever you're working on: your questions, a chart, or your training materials. I share my screen to walk through diagrams and real scenarios."],
  ["How does a mock oral work?", "It's a two-hour session run like the real checkride for Private Pilot or Commercial, built on the ACS. We finish with a debrief on exactly where you're weak, so you know what to study."],
  ["Can I book more than an hour?", "Yes. Tutoring can be one, one and a half, or two hours, at $50 an hour."],
  ["What if I need to cancel?", "You can cancel a request from your dashboard while it's still pending. For a confirmed session, email me."],
  ["Are the clips free?", "Yes. Create a free account to watch the whole library and track what you've seen."],
  ["Is the flight game realistic?", "It's built on real numbers: stall speed rises in a bank and drops with flaps, flaps have speed limits, and there's a working PAPI on the runway. It's still a game, not a simulator."],
];

// Apple-style list: each question opens in place. No script needed.
export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-line px-6 py-20 md:py-24">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12">
        <SectionHeader
          eyebrow="Questions"
          title={
            <>
              Before you <span className="text-dim">book.</span>
            </>
          }
          intro={
            <>
              Something else? <a href="mailto:alreadyairborne@gmail.com" className="link">Email me</a>.
            </>
          }
        />
        <div className="reveal mx-auto flex w-full max-w-3xl flex-col border-t border-line">
          {QUESTIONS.map(([q, a]) => (
            <details key={q} className="group border-b border-line">
              <summary className="press flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-lg font-semibold hover:text-cyan md:text-xl [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-2xl font-light text-dim transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-[640px] pb-6 text-[16px] leading-relaxed text-mute">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
