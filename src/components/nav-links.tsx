"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0] || "/";
  if (href.includes("#")) return false; // section links on the homepage
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

// Centered desktop links with a growing accent underline on the active one.
export function DesktopNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-[13px] lg:flex">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`nav-link press ${active ? "text-cyan" : "text-soft hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile menu rows, with a dot on the active page.
export function MobileNavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`press flex items-center justify-between rounded-xl px-4 py-3 hover:bg-raised ${active ? "text-cyan" : ""}`}
          >
            {l.label}
            {active && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan" />}
          </Link>
        );
      })}
    </>
  );
}
