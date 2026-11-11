import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { DesktopNav, MobileNavLinks } from "@/components/nav-links";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();

  const links = viewer
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/library", label: "Library" },
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/book", label: "Book" },
        ...(viewer.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [
        { href: "/#sessions", label: "Sessions" },
        { href: "/#fly", label: "Flight game" },
        { href: "/library", label: "Library" },
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/#about", label: "About" },
      ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#161617]/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="relative mx-auto flex h-[60px] max-w-[1180px] items-center gap-6 px-6">
        <Link href="/" className="press flex items-center gap-3 text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black ring-1 ring-white/10">
            <LogoMark size={30} glow />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[16px] font-semibold tracking-[-.01em]">AlreadyAirborne</span>
            <span className="mt-1 font-mono text-[9px] tracking-[.16em] text-dim">HARD TOPICS · 30 SEC</span>
          </span>
        </Link>

        <DesktopNav links={links} />

        <div className="ml-auto flex items-center gap-4">
          {viewer ? (
            <form action="/auth/signout" method="post" className="hidden lg:block">
              <button className="press text-[13px] text-soft hover:text-ink" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="press hidden text-[13px] text-soft hover:text-ink lg:block">
              Sign in
            </Link>
          )}
          <Link href="/book" className="btn btn-primary btn-sm !px-4 !py-[7px] !text-[13px]">
            Book
          </Link>
          <details className="relative lg:hidden">
            <summary
              aria-label="Menu"
              className="press flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-soft hover:bg-raised [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="12" viewBox="0 0 18 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <line x1="0" y1="2" x2="18" y2="2" />
                <line x1="0" y1="10" x2="18" y2="10" />
              </svg>
            </summary>
            <div className="absolute right-0 top-11 flex w-60 flex-col rounded-2xl border border-line bg-card p-2 text-[15px] shadow-2xl">
              <MobileNavLinks links={links} />
              {viewer ? (
                <form action="/auth/signout" method="post">
                  <button className="press w-full rounded-xl px-4 py-3 text-left hover:bg-raised" type="submit">
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/login" className="press rounded-xl px-4 py-3 hover:bg-raised">
                  Sign in
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
