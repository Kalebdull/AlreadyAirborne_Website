import Link from "next/link";
import { InstagramIcon, MailIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { site } from "@/lib/site";

// The thin bar above the nav: name, one announcement, social links.
export function TopBar() {
  return (
    <div className="border-b border-white/5 bg-[#050608]">
      <div className="mx-auto flex h-10 max-w-[1180px] items-center justify-between gap-4 px-6 text-[12px]">
        <Link href="/" className="press flex items-center gap-2 text-dim hover:text-ink">
          <LogoMark size={18} />
          <span className="font-mono tracking-[.1em]">ALREADYAIRBORNE</span>
        </Link>
        <p className="hidden text-mute md:block">
          <Link href="/#fly" className="press font-semibold text-cyan hover:text-ink">
            Fly the 10-level landing game
          </Link>{" "}
          · top run wins a free lesson
        </p>
        <div className="flex items-center gap-1">
          <a href={site.instagram.url} aria-label="Instagram" className="press rounded-full p-1.5 text-dim hover:bg-white/5 hover:text-ink">
            <InstagramIcon className="h-4 w-4" />
          </a>
          <a href={`mailto:${site.email}`} aria-label="Email" className="press rounded-full p-1.5 text-dim hover:bg-white/5 hover:text-ink">
            <MailIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
