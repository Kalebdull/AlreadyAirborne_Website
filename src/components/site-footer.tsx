import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { site } from "@/lib/site";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Train", links: [["1-on-1 tutoring", "/#sessions"], ["Mock oral exams", "/#oral"], ["Book a session", "/book"]] },
  { title: "Learn", links: [["Clip library", "/library"], ["The flight game", "/#fly"], ["Leaderboard", "/leaderboard"]] },
  { title: "Account", links: [["Sign in", "/login"], ["Create profile", "/signup"], ["Dashboard", "/dashboard"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-[#050506] px-6 pb-8 pt-14">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 text-ink">
              <LogoMark />
              <span className="font-display text-lg font-semibold">{site.name}</span>
            </Link>
            <p className="max-w-[300px] text-[14px] leading-relaxed text-mute">
              Hard topics in thirty seconds, then one-on-one on Zoom with {site.instructor.name}, CFI · {site.instructor.location}.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              <a href={site.instagram.url} className="link">
                @{site.instagram.handle}
              </a>
              <a href={`mailto:${site.email}`} className="link">
                {site.email}
              </a>
            </div>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3 text-[14px]">
              <span className="eyebrow">{col.title}</span>
              {col.links.map(([label, href]) => (
                <Link key={href} href={href} className="text-soft hover:text-ink">
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-xs text-dim">
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
          <Link href="/leaderboard/rules" className="hover:text-ink">
            Contest rules
          </Link>
          <span className="font-mono">SQUAWK 1200</span>
        </div>
      </div>
    </footer>
  );
}
