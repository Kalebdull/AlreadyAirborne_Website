import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();

  const links = viewer
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/library", label: "Library" },
        { href: "/book", label: "Book" },
        ...(viewer.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [
        { href: "/#sessions", label: "Sessions" },
        { href: "/#oral", label: "Mock Oral" },
        { href: "/library", label: "Library" },
        { href: "/#about", label: "About" },
      ];

  return (
    <header className="sticky top-0 z-50 h-[52px] border-b border-white/[.08] bg-[#161617]/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-full max-w-[1024px] items-center gap-7 px-[22px]">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <LogoMark />
          <span className="font-display text-base font-semibold tracking-[-.01em]">AlreadyAirborne</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 text-[13px] text-soft md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
          {viewer ? (
            <form action="/auth/signout" method="post">
              <button className="hover:text-ink" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          )}
        </nav>

        <Link href="/book" className="btn btn-primary btn-sm ml-auto !px-3.5 !py-[7px] !text-[13px] md:ml-0">
          Book
        </Link>

        <details className="relative md:hidden">
          <summary
            aria-label="Menu"
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-soft hover:bg-raised [&::-webkit-details-marker]:hidden"
          >
            <svg width="18" height="12" viewBox="0 0 18 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <line x1="0" y1="2" x2="18" y2="2" />
              <line x1="0" y1="10" x2="18" y2="10" />
            </svg>
          </summary>
          <div className="absolute right-0 top-11 flex w-56 flex-col rounded-2xl border border-line bg-card p-2 text-[15px] shadow-2xl">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl px-4 py-3 hover:bg-raised">
                {l.label}
              </Link>
            ))}
            {viewer ? (
              <form action="/auth/signout" method="post">
                <button className="w-full rounded-xl px-4 py-3 text-left hover:bg-raised" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="rounded-xl px-4 py-3 hover:bg-raised">
                Sign in
              </Link>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
