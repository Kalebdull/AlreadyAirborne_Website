import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { site } from "@/lib/site";
import { TOPICS } from "@/lib/topics";
import { Pfd } from "@/components/pfd/pfd";
import { RiseText } from "@/components/rise-text";
import { HeroUntangle } from "@/components/hero-untangle";
import { Spotlight } from "@/components/spotlight";
import { GameSection } from "@/components/leaderboard-section";
import { TopicMarquee } from "@/components/topic-marquee";
import { Faq } from "@/components/faq";
import { SectionHeader } from "@/components/section-header";
import { LogoMark } from "@/components/logo";
import { BulbIcon, ClipboardIcon, PlayIcon, VideoIcon } from "@/components/icons";

// Section order follows the Prestige layout kit; colors, type and components
// are this site's own (src/app/globals.css, design/README.md).
export default async function Home() {
  const { topics, clips } = await getLibrary();
  const counts = new Map<string, number>();
  for (const t of topics) counts.set(t.slug, clips.filter((c) => c.topic_id === t.id).length);

  return (
    <main>
      <Hero />
      <TopicMarquee />
      <StatBand />
      <Mission />
      <GameSection>
        <div className="scroll-settle flex w-full justify-center">
          <Pfd />
        </div>
      </GameSection>
      <Pricing />
      <HowItWorks />
      <Library counts={counts} hasLibrary={topics.length > 0} />
      <Faq />
      <Cta />
    </main>
  );
}

// --- 3. Hero: full-bleed image, content anchored bottom-left ------------------

function ImageTreatment({ glow = true }: { glow?: boolean }) {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,.92)_0%,rgba(0,0,0,.6)_42%,rgba(0,0,0,.1)_100%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      <div aria-hidden className="grain" />
      {glow && <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,.12)_0%,transparent_65%)]" />}
    </>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[780px] items-end overflow-hidden md:h-[92vh] md:min-h-[640px]">
      <HeroUntangle className="absolute inset-x-0 top-12 h-[46%] w-full object-cover object-[70%_50%] md:inset-0 md:h-full md:object-[80%_50%]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,.85)_38%,transparent_62%)] md:bg-[linear-gradient(100deg,rgba(0,0,0,.95)_0%,rgba(0,0,0,.75)_40%,transparent_66%)]" />
      <div aria-hidden className="grain" />

      <div className="absolute left-[clamp(1.25rem,4vw,4rem)] top-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[3px] text-soft">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-magenta opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-magenta" />
        </span>
        Now on Instagram · @{site.instagram.handle}
      </div>

      <div className="pointer-events-none relative w-full pb-20 pl-[clamp(1.25rem,4vw,4rem)] pr-6 pt-32 md:pb-24">
        <div className="pointer-events-auto flex max-w-3xl flex-col items-start gap-6">
          <span className="fade-up rounded-full bg-cyan/15 px-3.5 py-1.5 font-mono text-[11px] tracking-[.14em] text-cyan ring-1 ring-cyan/30">
            FLIGHT INSTRUCTION · {site.instructor.location.toUpperCase()} &amp; ZOOM
          </span>
          <div className="flex items-start gap-5">
            <span className="fade-up mt-2 hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/60 shadow-[0_12px_40px_rgba(0,0,0,.65)] ring-1 ring-white/10 backdrop-blur md:flex">
              <LogoMark size={34} />
            </span>
            <h1 className="headline text-[clamp(3.25rem,8vw,5.5rem)] leading-[1.02]">
              <span className="block">
                <RiseText text="Aviation," delay={130} />
              </span>
              <span className="block text-dim">
                <RiseText text="made simple." delay={230} />
              </span>
            </h1>
          </div>
          <p className="fade-up max-w-xl text-lg leading-relaxed text-soft md:text-xl" style={{ animationDelay: "440ms" }}>
            The hard topics, untangled in thirty-second clips. Then one-on-one on Zoom with {site.instructor.name}, CFI, until it clicks.
          </p>
          <div className="fade-up flex flex-wrap gap-3" style={{ animationDelay: "560ms" }}>
            <Link href="/book" className="btn btn-primary">
              Book a session
            </Link>
            <a href="#fly" className="btn btn-ghost !border-white/35">
              Fly the landing game
            </a>
          </div>
        </div>
      </div>

      <a
        href="#stats"
        className="press absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] tracking-[3px] text-dim hover:text-ink md:flex"
        aria-label="Scroll down"
      >
        SCROLL
        <span className="h-8 w-px overflow-hidden bg-white/10">
          <span className="scroll-cue block h-full w-full bg-cyan" />
        </span>
      </a>
    </section>
  );
}

// --- 5. Stat band ---------------------------------------------------------------

function StatBand() {
  const stats = [
    { value: "30s", label: "Per clip", sub: "Hard topics, short and visual", color: "text-cyan", bar: "bg-cyan" },
    { value: "$50", label: "Per hour", sub: "1-on-1 on Zoom", color: "text-green", bar: "bg-green" },
    { value: "$175", label: "Mock oral", sub: "Private or Commercial", color: "text-magenta", bar: "bg-magenta" },
    { value: "10", label: "Levels", sub: "Landings in the flight game", color: "text-amber", bar: "bg-amber" },
  ];
  return (
    <section id="stats" className="bg-[linear-gradient(135deg,#04161b,#050608)] px-6">
      <div className="reveal-stagger mx-auto grid max-w-[1180px] grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col gap-3 border-white/[.07] px-2 py-12 md:px-8 md:py-14 ${i % 2 === 1 ? "border-l" : ""} ${i > 0 ? "md:border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""}`}
          >
            <span aria-hidden className={`h-[3px] w-8 rounded-full ${s.bar}`} />
            <span className={`headline text-[52px] tracking-[-.04em] md:text-[68px] ${s.color}`}>{s.value}</span>
            <span className="font-mono text-[11px] uppercase tracking-[.16em] text-ink">{s.label}</span>
            <span className="text-[14px] text-dim">{s.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- 6. Mission: centered header, pillar cards, then the instructor -------------

function Mission() {
  const pillars = [
    { title: "Relatable ideas", body: "Every topic gets an everyday comparison, so it sticks after the lesson ends.", color: "var(--color-cyan)", text: "text-cyan", Icon: BulbIcon },
    { title: "Short and visual", body: "Thirty-second clips you can rewatch the night before a lesson or checkride.", color: "var(--color-magenta)", text: "text-magenta", Icon: PlayIcon },
    { title: "One-on-one", body: "On Zoom, at your pace, on exactly what you're stuck on.", color: "var(--color-green)", text: "text-green", Icon: VideoIcon },
    { title: "Checkride ready", body: "Mock orals built on the ACS, with a debrief on where you're weak.", color: "var(--color-amber)", text: "text-amber", Icon: ClipboardIcon },
  ];
  const { instructor } = site;
  return (
    <section id="about" className="scroll-mt-20 px-6 py-14 md:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9 md:gap-10">
        <SectionHeader
          eyebrow="Why I teach this way"
          rule
          title={
            <>
              Find the idea <span className="text-dim">that makes it click.</span>
            </>
          }
          intro="I started making these videos to get better at teaching: every one is me hunting for the relatable idea that makes a hard topic land. Sessions work the same way."
        />

        <div className="reveal-stagger grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {pillars.map(({ title, body, color, text, Icon }) => (
            <div
              key={title}
              className="accent-bar relative flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-white/5 md:gap-4 md:p-7"
              style={{ ["--bar" as string]: color }}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${text}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-semibold leading-tight tracking-[-.01em] md:text-xl">{title}</span>
              <span className="text-[13px] leading-relaxed text-mute md:text-[15px]">{body}</span>
            </div>
          ))}
        </div>

        <div className="card reveal flex flex-col overflow-hidden md:flex-row">
          <div className="relative flex aspect-[4/3] overflow-hidden bg-raised md:aspect-auto md:min-h-[520px] md:basis-[44%]">
            {instructor.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={instructor.photo} alt={instructor.photoAlt} className="absolute inset-0 h-full w-full object-cover object-[60%_35%]" />
            )}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <div aria-hidden className="grain" />
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
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Link href="/book" className="btn btn-primary btn-sm">
                Book a session
              </Link>
              <a href={site.instagram.url} className="link press text-[15px]">
                Follow @{site.instagram.handle} ›
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 8. Pricing: three cards, featured middle -----------------------------------

function Pricing() {
  return (
    <section id="sessions" className="scroll-mt-20 border-t border-line bg-[#050506] px-6 py-14 md:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9 md:gap-10">
        <SectionHeader
          eyebrow="Work with me"
          title={
            <>
              Three ways <span className="text-dim">to learn it.</span>
            </>
          }
          intro="Start free with the clips. When something won't click, book an hour. Before your checkride, run a mock oral. You pay after I confirm."
        />
        <div className="reveal-stagger grid items-center gap-6 md:grid-cols-3">
          <PriceCard
            tag="Free · with an account"
            title="Clip Library"
            description="Every reel, organized by topic, with your progress saved."
            price="$0"
            sub="always"
            items={["Airspace, weather, regs and more", "Instrument 101 series", "Track what you've watched"]}
            cta={{ href: "/signup?next=/library", label: "Create free account" }}
            note="No card, no catch."
          />
          <PriceCard
            featured
            tag="Session · Zoom"
            title="1-on-1 Tutoring"
            description="Any topic you're stuck on, worked through together until it makes sense."
            price="$50"
            sub="per hour"
            items={["Screen-shared charts and diagrams", "Real scenarios, not just definitions", "1, 1.5 or 2 hours"]}
            cta={{ href: "/book?service=zoom", label: "Request a time" }}
            note="Pay after I confirm."
          />
          <PriceCard
            id="oral"
            tag="Checkride prep"
            title="Mock Oral Exam"
            description="A two-hour mock oral run like the real thing, then a debrief."
            price="$175"
            sub="per exam"
            items={["Private Pilot or Commercial", "Built on the ACS", "Debrief on where you're weak"]}
            cta={{ href: "/book?service=oral_ppl", label: "Schedule a mock oral" }}
            note="Pay after I confirm."
          />
        </div>
      </div>
    </section>
  );
}

function PriceCard(props: {
  id?: string;
  tag: string;
  title: string;
  description: string;
  price: string;
  sub: string;
  items: string[];
  cta: { href: string; label: string };
  note: string;
  featured?: boolean;
}) {
  return (
    <Spotlight
      id={props.id}
      tint="34 211 238"
      className={`card-lift accent-bar relative flex scroll-mt-24 flex-col gap-6 rounded-[28px] p-8 md:p-9 ${
        props.featured ? "bg-raised shadow-[inset_0_0_0_1px_rgba(34,211,238,.55)] md:scale-[1.02]" : "bg-card"
      }`}
    >
      {props.featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan px-4 py-1 font-mono text-[11px] font-bold tracking-[.12em] text-black">
          START HERE
        </span>
      )}
      <div className="flex flex-col gap-2">
        <span className={`font-mono text-[11px] uppercase tracking-[.14em] ${props.featured ? "text-cyan" : "text-dim"}`}>{props.tag}</span>
        <h3 className="font-display text-[28px] font-bold tracking-[-.01em]">{props.title}</h3>
        <p className="text-[15px] leading-relaxed text-mute">{props.description}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="headline text-[56px]">{props.price}</span>
        <span className="text-[15px] text-mute">{props.sub}</span>
      </div>
      <ul className="flex flex-col gap-3 text-[15px] text-soft">
        {props.items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="font-mono text-cyan" aria-hidden>
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2">
        <Link href={props.cta.href} className={`btn w-full !rounded-2xl ${props.featured ? "btn-primary" : "btn-ghost"}`}>
          {props.cta.label}
        </Link>
        <span className="text-center text-[12px] text-dim">{props.note}</span>
      </div>
    </Spotlight>
  );
}

// --- 9. Details: how it works, the library ---------------------------------------

function HowItWorks() {
  const steps = [
    { n: "01", tag: "Request", title: "Pick a time.", body: "Choose a session or mock oral and an open slot. Tell me what you're stuck on.", color: "var(--color-amber)", text: "text-amber" },
    { n: "02", tag: "Cleared", title: "I confirm it.", body: "Your dashboard shows the Zoom link and how to pay.", color: "var(--color-green)", text: "text-green" },
    { n: "03", tag: "Join", title: "Hop on Zoom.", body: "The link is one tap away when it's time. Bring your questions.", color: "var(--color-cyan)", text: "text-cyan" },
  ];
  return (
    <section className="border-t border-line bg-[#050506] px-6 pb-14 md:pb-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9 pt-14 md:gap-10 md:pt-20">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              Request, cleared, <span className="text-dim">join.</span>
            </>
          }
        />
        <ol className="reveal-stagger grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="accent-bar relative flex flex-col gap-3 rounded-3xl bg-card p-7" style={{ ["--bar" as string]: s.color }}>
              <span className={`font-mono text-[12px] uppercase tracking-[.12em] ${s.text}`}>
                {s.n} · {s.tag}
              </span>
              <span className="font-display text-2xl font-semibold">{s.title}</span>
              <span className="leading-relaxed text-mute">{s.body}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Library({ counts, hasLibrary }: { counts: Map<string, number>; hasLibrary: boolean }) {
  const label = (slug: string) => {
    const n = hasLibrary ? (counts.get(slug) ?? 0) : 0;
    return n ? `${n} ${n === 1 ? "CLIP" : "CLIPS"}` : "COMING SOON";
  };
  const [featured, ...rest] = TOPICS;
  return (
    <section id="library" className="scroll-mt-20 px-6 py-14 md:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9 md:gap-10">
        <SectionHeader
          eyebrow="The library"
          title={
            <>
              Every reel, organized. <span className="text-dim">Free with an account.</span>
            </>
          }
          intro="What each topic covers, so you can find the thing you're stuck on."
        />

        <div className="reveal-stagger grid gap-4 md:grid-cols-3 md:grid-rows-2">
          <Link
            href={`/library#${featured.slug}`}
            className="card-lift accent-bar relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[28px] bg-card p-8 md:row-span-2"
            style={{ ["--bar" as string]: "var(--color-magenta)" }}
          >
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
            <Link key={t.slug} href={`/library#${t.slug}`} className="card-lift accent-bar flex flex-col gap-5 rounded-[28px] bg-card p-7">
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
            className="card-lift flex flex-col justify-between gap-5 rounded-[28px] p-7 shadow-[inset_0_0_0_1px_rgba(34,211,238,.35)] md:col-span-2"
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

// --- 10. CTA: faint image, gradients, grain, glow; lockup card -------------------

function Cta() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-[#050608] px-6 py-16 md:py-20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero-approach.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <ImageTreatment />
      <div className="relative mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.3fr_1fr]">
        <div className="reveal flex flex-col gap-5">
          <span className="font-mono text-[12px] tracking-[.14em] text-green">● READY TO COPY</span>
          <h2 className="headline text-[44px] md:text-[60px]">
            Request your <span className="text-cyan">clearance.</span>
          </h2>
          <p className="text-[17px] leading-relaxed text-soft">Pick a time that works and tell me what you&apos;re stuck on. I&apos;ll confirm and send the Zoom link.</p>
          <p className="text-[15px] text-dim">Nothing to pay until I confirm.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/book" className="btn btn-primary">
              Book a session
            </Link>
            <a href={site.instagram.url} className="btn btn-ghost !border-white/35">
              Message on Instagram
            </a>
          </div>
        </div>
        <div className="reveal flex flex-col items-center gap-4 rounded-3xl bg-white/[.04] p-10 text-center ring-1 ring-white/[.09] backdrop-blur-md">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-[0_12px_40px_rgba(0,0,0,.65)] ring-1 ring-white/10">
            <LogoMark size={40} />
          </span>
          <span className="font-display text-2xl font-semibold">AlreadyAirborne</span>
          <span className="font-mono text-[10px] tracking-[.2em] text-dim">HARD TOPICS · THIRTY SECONDS</span>
          <span aria-hidden className="accent-rule" />
          <span className="font-mono text-[11px] tracking-[.14em] text-soft">
            {site.instructor.name.toUpperCase()}, CFI · {site.instructor.location.toUpperCase()}
          </span>
        </div>
      </div>
    </section>
  );
}
