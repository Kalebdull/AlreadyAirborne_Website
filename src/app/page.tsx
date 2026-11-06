import Link from "next/link";
import { getLibrary } from "@/lib/data";
import { site } from "@/lib/site";

export default async function Home() {
  const { topics, clips } = await getLibrary();
  const counts = new Map<string, number>();
  for (const clip of clips) counts.set(clip.topic_id, (counts.get(clip.topic_id) ?? 0) + 1);

  return (
    <main>
      <Hero />
      <Offers />

      <section id="library" className="px-6 py-24 md:py-32">
        <div className="mx-auto flex max-w-[1024px] flex-col gap-12">
          <div className="reveal flex flex-col gap-3.5">
            <span className="eyebrow">The library</span>
            <h2 className="headline text-[40px] md:text-[64px]">
              Every reel, organized.
              <br />
              <span className="text-dim">Free with an account.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {topics.length === 0 &&
              ["Airspace", "Weather", "Regulations", "Instrument 101", "Aerodynamics", "Navigation"].map((name) => (
                <TopicTile key={name} href="/library" name={name} count={null} />
              ))}
            {topics.map((t) => (
              <TopicTile key={t.id} href={`/library#${t.slug}`} name={t.name} count={counts.get(t.id) ?? 0} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 md:pb-32">
        <div className="mx-auto grid max-w-[1024px] gap-10 border-t border-line pt-14 md:grid-cols-3">
          <Step n="01" tone="text-amber" tag="Request" title="Pick a time.">
            Choose a session or mock oral and an open slot. Tell me what you&apos;re stuck on.
          </Step>
          <Step n="02" tone="text-green" tag="Cleared" title="I confirm it.">
            You get a confirmation in your dashboard with the Zoom link and how to pay.
          </Step>
          <Step n="03" tone="text-cyan" tag="Join" title="Hop on Zoom.">
            The link lives in your dashboard, one tap away when it&apos;s time.
          </Step>
        </div>
      </section>

      <About />

      <section className="flex flex-col items-center gap-6 border-t border-raised px-6 py-28 text-center md:py-32">
        <span className="font-mono text-[13px] tracking-[.14em] text-green">● READY TO COPY</span>
        <h2 className="headline reveal text-[48px] md:text-[80px]">Request your clearance.</h2>
        <Link href="/book" className="btn btn-primary">
          Book a session
        </Link>
      </section>
    </main>
  );
}

function Hero() {
  return (
    <section className="relative flex flex-col items-center gap-5 overflow-hidden px-6 pt-20 text-center md:pt-28">
      <a href={site.instagram.url} className="font-mono text-[13px] tracking-[.14em] text-magenta hover:text-ink">
        ● NOW ON INSTAGRAM · @{site.instagram.handle.toUpperCase()}
      </a>
      <h1 className="headline text-[56px] leading-[.98] md:text-[104px]">
        Hard topics.
        <br />
        Thirty seconds.
      </h1>
      <p className="max-w-[640px] text-xl font-medium leading-snug text-mute md:text-2xl">
        Then go deeper, one-on-one, with a CFI who&apos;ll explain it until it clicks.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        <Link href="/book" className="btn btn-primary">
          Book a session
        </Link>
        <Link href="/library" className="link text-[17px] font-medium">
          Watch the clips ›
        </Link>
      </div>

      <div className="relative mt-16 flex h-[600px] w-full max-w-[1180px] justify-center md:h-[720px]">
        {/* The horizon: sky above, ground below, slightly banked. */}
        <div aria-hidden className="absolute -inset-x-[10%] top-[46%] h-px -rotate-[4deg] bg-white/35" />
        <div
          aria-hidden
          className="absolute -inset-x-[10%] top-[46%] -bottom-52 mt-px origin-top -rotate-[4deg] bg-[#0a0806]"
        />

        <div className="relative h-[580px] w-[282px] rounded-[50px] bg-raised p-[11px] shadow-[0_0_0_1px_#3a3a3c,0_40px_120px_rgba(0,0,0,.8)] md:h-[700px] md:w-[340px] md:rounded-[58px] md:p-3">
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[40px] bg-card md:rounded-[46px]">
            {site.heroReel ? (
              <video
                src={site.heroReel}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                aria-label="A 30-second AlreadyAirborne explainer"
              />
            ) : (
              <span className="font-mono text-xs text-dim">[YOUR REEL · 9:16]</span>
            )}
            <div className="absolute left-1/2 top-3.5 h-8 w-[110px] -translate-x-1/2 rounded-[20px] bg-black" />
            <div className="absolute inset-x-5 bottom-7 flex flex-col gap-2.5 text-left">
              <span className="font-mono text-[11px] text-cyan">AIRSPACE · 0:30</span>
              <span className="font-display text-[22px] font-semibold leading-tight">
                The stuff the textbook makes complicated.
              </span>
              <div className="h-[3px] rounded bg-white/20">
                <div className="h-full w-[62%] rounded bg-magenta" />
              </div>
            </div>
          </div>
        </div>

        <FloatChip className="left-[4%] top-[22%]" label="1-on-1 · Zoom">
          $50<span className="text-[15px] font-medium text-mute"> / hour</span>
        </FloatChip>
        <FloatChip className="right-[4%] top-[58%]" label="Mock oral · PPL / CPL">
          $175
        </FloatChip>
      </div>
    </section>
  );
}

function FloatChip({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute hidden flex-col gap-1.5 rounded-[18px] border border-white/10 bg-[#1c1c1e]/80 px-[18px] py-4 text-left backdrop-blur-xl md:flex ${className}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[.1em] text-dim">{label}</span>
      <span className="font-display text-[28px] font-semibold">{children}</span>
    </div>
  );
}

function Offers() {
  return (
    <section id="sessions" className="px-6 pb-16 pt-28 md:pt-36">
      <div className="mx-auto flex max-w-[1024px] flex-col gap-12">
        <div className="reveal flex flex-col items-center gap-3.5 text-center">
          <h2 className="headline text-[40px] md:text-[64px]">Two ways to go deeper.</h2>
          <p className="max-w-[560px] text-[21px] text-mute">
            Request a time. I confirm, send the Zoom link, and you pay after it&apos;s confirmed.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
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
            items={[
              "Private Pilot or Commercial Pilot",
              "Run like the real checkride, built on the ACS",
              "Debrief on exactly where you're weak",
            ]}
            cta={
              <Link href="/book?service=oral_ppl" className="btn btn-ghost !border-magenta">
                Schedule a mock oral
              </Link>
            }
          />
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
    <article
      id={props.id}
      className={`card reveal flex scroll-mt-24 flex-col gap-7 p-8 md:p-11 ${props.highlight ? "shadow-[inset_0_0_0_1px_rgba(240,72,200,.45)]" : ""}`}
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
    </article>
  );
}

function TopicTile({ href, name, count }: { href: string; name: string; count: number | null }) {
  return (
    <Link
      href={href}
      className="reveal flex flex-col gap-10 rounded-3xl bg-card p-6 text-ink transition-transform duration-300 hover:-translate-y-1 md:p-7"
    >
      <span className="font-mono text-xs text-cyan">
        {count === null ? "COMING SOON" : `${count} ${count === 1 ? "CLIP" : "CLIPS"}`}
      </span>
      <span className="font-display text-[22px] font-semibold md:text-[28px]">{name}</span>
    </Link>
  );
}

function Step(props: { n: string; tone: string; tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="reveal flex flex-col gap-3">
      <span className={`font-mono text-[13px] uppercase ${props.tone}`}>
        {props.n} · {props.tag}
      </span>
      <span className="font-display text-2xl font-semibold">{props.title}</span>
      <span className="leading-normal text-mute">{props.children}</span>
    </div>
  );
}

function About() {
  const { instructor } = site;
  return (
    <section id="about" className="scroll-mt-20 px-6 pb-28 md:pb-36">
      <div className="card reveal mx-auto flex max-w-[1024px] flex-col overflow-hidden md:flex-row">
        <div className="flex min-h-[360px] items-center justify-center bg-raised md:min-h-[460px] md:basis-[42%]">
          {instructor.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={instructor.photo} alt={instructor.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-xs text-dim">[PHOTO OF YOU]</span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-5 p-8 md:p-13">
          <span className="eyebrow">Your instructor</span>
          <h2 className="headline text-[40px] md:text-[48px]">{instructor.name}</h2>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {instructor.ratings.map((r, i) => (
              <span
                key={r}
                className={`rounded-full border px-3 py-1 ${i === 0 ? "border-green/50 text-green" : "border-edge text-soft"}`}
              >
                {r.toUpperCase()}
              </span>
            ))}
          </div>
          <p className="text-lg leading-relaxed text-mute">{instructor.bio}</p>
          <a href={site.instagram.url} className="link text-[17px]">
            Follow @{site.instagram.handle} on Instagram ›
          </a>
        </div>
      </div>
    </section>
  );
}
