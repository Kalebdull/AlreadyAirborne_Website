import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { site } from "@/lib/site";
import { TOPICS } from "@/lib/topics";
import { Pfd } from "@/components/pfd/pfd";
import { RiseText } from "@/components/rise-text";
import { Spotlight } from "@/components/spotlight";
import { LeaderboardSection } from "@/components/leaderboard-section";
import { TopicMarquee } from "@/components/topic-marquee";
import { Faq } from "@/components/faq";

export default async function Home() {
  const { topics, clips } = await getLibrary();
  // Clip counts per topic slug, once the library has clips.
  const counts = new Map<string, number>();
  for (const t of topics) counts.set(t.slug, clips.filter((c) => c.topic_id === t.id).length);

  return (
    <main>
      <Hero />
      <TopicMarquee />
      <LeaderboardSection />
      <Offers />
      <Library counts={counts} hasLibrary={topics.length > 0} />
      <About />
      <Faq />
      <Cta />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative flex flex-col items-center gap-5 overflow-hidden px-4 pb-16 pt-20 text-center sm:px-6 md:pb-20 md:pt-28">
      <a href={site.instagram.url} className="fade-up font-mono text-[13px] tracking-[.14em] text-magenta hover:text-ink">
        ● NOW ON INSTAGRAM · @{site.instagram.handle.toUpperCase()}
      </a>
      <h1 className="headline text-[56px] leading-[.98] md:text-[104px]">
        <RiseText text="Hard topics." delay={100} />
        <br />
        <RiseText text="Thirty seconds." delay={280} />
      </h1>
      <p className="fade-up max-w-[640px] text-xl font-medium leading-snug text-mute md:text-2xl" style={{ animationDelay: "550ms" }}>
        Then go deeper, one-on-one, with a CFI who&apos;ll explain it until it clicks.
      </p>
      <div className="fade-up mt-2 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: "700ms" }}>
        <Link href="/book" className="btn btn-primary">
          Book a session
        </Link>
        <Link href="/library" className="link text-[17px] font-medium">
          Watch the clips ›
        </Link>
      </div>

      <div id="fly" className="fade-up mt-14 flex w-full scroll-mt-20 justify-center md:mt-20" style={{ animationDelay: "850ms" }}>
        <div className="scroll-settle flex w-full justify-center">
          <Pfd />
        </div>
      </div>
    </section>
  );
}

function Offers() {
  return (
    <section id="sessions" className="scroll-mt-20 border-t border-line bg-[#050506] px-6 py-20 md:py-24">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow text-cyan">Work with me</span>
            <h2 className="headline text-[40px] md:text-[56px]">Two ways to go deeper.</h2>
          </div>
          <p className="max-w-[420px] text-[17px] leading-relaxed text-mute">
            Request a time. I confirm, send the Zoom link, and you pay after it&apos;s confirmed. Nothing up front.
          </p>
        </div>

        <div className="reveal-stagger grid gap-4 md:grid-cols-2">
          <OfferCard
            eyebrow="Session · Zoom"
            eyebrowClass="text-cyan"
            title="1-on-1 Tutoring"
            price="$50"
            per="per hour"
            items={[
              "Any topic you're stuck on: airspace, weather, regs, IFR",
              "Screen-shared charts, diagrams and real scenarios",
              "Book one hour or up to two in a row",
            ]}
            cta={
              <Link href="/book?service=zoom" className="btn btn-primary">
                Request a time
              </Link>
            }
          />
          <OfferCard
            id="oral"
            eyebrow="Checkride prep"
            eyebrowClass="text-magenta"
            title="Mock Oral Exam"
            price="$175"
            per="per exam"
            highlight
            items={["Private Pilot or Commercial Pilot", "Run like the real checkride, built on the ACS", "Debrief on exactly where you're weak"]}
            cta={
              <Link href="/book?service=oral_ppl" className="btn btn-ghost !border-magenta">
                Schedule a mock oral
              </Link>
            }
          />
        </div>

        {/* How it works, drawn like a flight plan: three legs, one route. */}
        <div className="relative">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-[54px] hidden h-px bg-gradient-to-r from-amber via-green to-cyan opacity-40 md:block" />
          <ol className="reveal-stagger relative grid gap-4 md:grid-cols-3">
          <Step n="01" tone="amber" tag="Request" title="Pick a time.">
            Choose a session or mock oral and an open slot. Tell me what you&apos;re stuck on.
          </Step>
          <Step n="02" tone="green" tag="Cleared" title="I confirm it.">
            Your dashboard shows the Zoom link and how to pay.
          </Step>
          <Step n="03" tone="cyan" tag="Join" title="Hop on Zoom.">
            The link is one tap away when it&apos;s time. Bring your questions.
          </Step>
          </ol>
        </div>
      </div>
    </section>
  );
}

function OfferCard(props: {
  id?: string;
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  price: string;
  per: string;
  items: string[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Spotlight
      id={props.id}
      tint={props.highlight ? "240 72 200" : "34 211 238"}
      className={`card flex scroll-mt-24 flex-col gap-7 p-8 md:p-11 ${props.highlight ? "shadow-[inset_0_0_0_1px_rgba(240,72,200,.45)]" : ""}`}
    >
      <div className="flex flex-col gap-2.5">
        <span className={`eyebrow ${props.eyebrowClass}`}>{props.eyebrow}</span>
        <h3 className="font-display text-[34px] font-bold tracking-[-.02em] md:text-[40px]">{props.title}</h3>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="headline text-[64px] md:text-[72px]">{props.price}</span>
        <span className="text-[19px] text-mute">{props.per}</span>
      </div>
      <ul className="flex flex-col gap-3.5 text-[17px] text-soft">
        {props.items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="font-mono text-green" aria-hidden>
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{props.cta}</div>
    </Spotlight>
  );
}

function Step(props: { n: string; tone: "amber" | "green" | "cyan"; tag: string; title: string; children: React.ReactNode }) {
  const color = { amber: "text-amber ring-amber/40", green: "text-green ring-green/40", cyan: "text-cyan ring-cyan/40" }[props.tone];
  return (
    <li className="relative flex flex-col items-start gap-3 rounded-3xl bg-card p-7 md:items-center md:text-center">
      <span className={`flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black font-mono text-sm ring-1 ${color}`}>{props.n}</span>
      <span className={`font-mono text-[12px] uppercase tracking-[.12em] ${color.split(" ")[0]}`}>{props.tag}</span>
      <span className="font-display text-2xl font-semibold">{props.title}</span>
      <span className="leading-normal text-mute">{props.children}</span>
    </li>
  );
}

function Library({ counts, hasLibrary }: { counts: Map<string, number>; hasLibrary: boolean }) {
  const label = (slug: string) => {
    if (!hasLibrary) return "COMING SOON";
    const n = counts.get(slug) ?? 0;
    return n ? `${n} ${n === 1 ? "CLIP" : "CLIPS"}` : "COMING SOON";
  };
  const [featured, ...rest] = TOPICS;
  return (
    <section id="library" className="scroll-mt-20 px-6 py-20 md:py-24">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">The library</span>
            <h2 className="headline text-[40px] md:text-[56px]">
              Every reel, organized.
              <br />
              <span className="text-dim">Free with an account.</span>
            </h2>
          </div>
          <Link href="/library" className="btn btn-ghost btn-sm">
            Open the library
          </Link>
        </div>

        <div className="reveal-stagger grid gap-4 md:grid-cols-3 md:grid-rows-2">
          <Link href={`/library#${featured.slug}`} className="lift relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[28px] bg-card p-8 md:row-span-2">
            <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full border-[14px] border-magenta/20" />
            <div aria-hidden className="absolute -right-4 -top-4 h-40 w-40 rounded-full border-[10px] border-magenta/35" />
            <span className="relative font-mono text-xs tracking-[.12em] text-magenta">● {label(featured.slug)}</span>
            <div className="relative flex flex-col gap-4">
              <span className="font-display text-[34px] font-bold leading-tight tracking-[-.02em] md:text-[40px]">{featured.name}</span>
              <span className="text-[16px] text-mute">{"blurb" in featured ? featured.blurb : ""}</span>
              <ul className="flex flex-wrap gap-2">
                {featured.covers.map((c) => (
                  <li key={c} className="rounded-full bg-white/5 px-3 py-1 text-[13px] text-soft ring-1 ring-white/10">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Link>
          {rest.map((t) => (
            <Link key={t.slug} href={`/library#${t.slug}`} className="lift flex flex-col gap-5 rounded-[28px] bg-card p-7">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[24px] font-semibold">{t.name}</span>
                <span className="whitespace-nowrap font-mono text-[11px] text-cyan">{label(t.slug)}</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[15px] text-mute">
                {t.covers.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-dim" aria-hidden>
                      —
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
          <a
            href={site.instagram.url}
            className="lift flex flex-col justify-between gap-5 rounded-[28px] p-7 shadow-[inset_0_0_0_1px_rgba(34,211,238,.35)] md:col-span-2"
          >
            <span className="font-mono text-[11px] tracking-[.12em] text-cyan">REQUEST A TOPIC</span>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <span className="max-w-[420px] font-display text-[24px] font-semibold leading-snug">Stuck on something that isn&apos;t here? Tell me what to make next.</span>
              <span className="link whitespace-nowrap text-[15px]">Message on Instagram ›</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

function About() {
  const { instructor } = site;
  return (
    <section id="about" className="scroll-mt-20 border-y border-line bg-[#050506] px-6 py-20 md:py-24">
      <div className="card reveal mx-auto flex max-w-[1180px] flex-col overflow-hidden md:flex-row">
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-raised md:aspect-auto md:min-h-[540px] md:basis-[44%]">
          {instructor.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={instructor.photo} alt={instructor.photoAlt} className="h-full w-full object-cover object-[60%_35%]" />
          ) : (
            <span className="font-mono text-xs text-dim">[PHOTO OF YOU]</span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-5 p-8 md:p-14">
          <span className="eyebrow">Your instructor</span>
          <h2 className="headline text-[40px] md:text-[52px]">{instructor.name}</h2>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {instructor.ratings.map((r, i) => (
              <span key={r} className={`rounded-full border px-3 py-1 ${i === 0 ? "border-green/50 text-green" : "border-edge text-soft"}`}>
                {r.toUpperCase()}
              </span>
            ))}
            <span className="rounded-full border border-edge px-3 py-1 text-soft">{instructor.location.toUpperCase()}</span>
          </div>
          <p className="text-lg leading-relaxed text-mute">{instructor.bio}</p>
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <span className="eyebrow">I can help with</span>
            <p className="text-[15px] leading-relaxed text-soft">Airspace · Weather · Regulations · Instrument procedures · Aerodynamics · Checkride prep</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-1">
            <Link href="/book" className="btn btn-primary btn-sm">
              Book a session
            </Link>
            <a href={site.instagram.url} className="link text-[15px]">
              Follow @{site.instagram.handle} ›
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="px-6 pb-20 md:pb-24">
      <div className="card reveal relative mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-8 overflow-hidden p-10 md:flex-row md:items-center md:p-14">
        <div aria-hidden className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full border-[16px] border-cyan/10" />
        <div className="relative flex flex-col gap-3">
          <span className="font-mono text-[13px] tracking-[.14em] text-green">● READY TO COPY</span>
          <h2 className="headline text-[40px] md:text-[60px]">Request your clearance.</h2>
          <p className="text-[17px] text-mute">Pick a time that works. You pay after I confirm.</p>
        </div>
        <div className="relative flex flex-wrap gap-3">
          <Link href="/book" className="btn btn-primary">
            Book a session
          </Link>
          <a href={site.instagram.url} className="btn btn-ghost">
            Message on Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
