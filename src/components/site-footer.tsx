import Link from "next/link";
import { InstagramIcon, MailIcon } from "@/components/icons";
import { site } from "@/lib/site";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Train", links: [["1-on-1 tutoring", "/#sessions"], ["Mock oral exams", "/#oral"], ["Book a session", "/book"]] },
  { title: "Learn", links: [["Clip library", "/library"], ["The flight game", "/#fly"], ["Leaderboard", "/leaderboard"]] },
  { title: "Account", links: [["Sign in", "/login"], ["Create profile", "/signup"], ["Dashboard", "/dashboard"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-[#050608] px-6 py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <span className="font-display text-xl font-semibold">{site.name}</span>
            <span className="font-mono text-[10px] tracking-[.2em] text-cyan">HARD TOPICS · THIRTY SECONDS</span>
            <p className="max-w-[320px] text-[14px] leading-relaxed text-mute">
              Short explainers, then one-on-one on Zoom with {site.instructor.name}, CFI · {site.instructor.location}.
            </p>
            <div className="flex gap-2">
              <a
                href={site.instagram.url}
                aria-label="Instagram"
                className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-soft ring-1 ring-white/10 hover:bg-white/10 hover:text-ink"
              >
                <InstagramIcon className="h-[18px] w-[18px]" />
              </a>
              <a
                href={`mailto:${site.email}`}
                aria-label="Email"
                className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-soft ring-1 ring-white/10 hover:bg-white/10 hover:text-ink"
              >
                <MailIcon className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3 text-[14px]">
              <span className="font-mono text-[11px] uppercase tracking-[.16em] text-cyan">{col.title}</span>
              {col.links.map(([label, href]) => (
                <Link key={href} href={href} className="footer-link press">
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-white/[.08] pt-6 text-xs text-dim">
          <span>
            © {new Date().getFullYear()} {site.name} · {site.email}
          </span>
          <div className="flex gap-5">
            <Link href="/leaderboard/rules" className="press hover:text-ink">
              Contest rules
            </Link>
            <span className="font-mono">SQUAWK 1200</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
