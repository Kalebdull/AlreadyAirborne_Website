"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/clips", label: "Clips" },
  { href: "/admin/contest", label: "Contest" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
      <div className="flex w-max gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`press flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-colors ${active ? "bg-raised text-ink" : "text-mute hover:text-ink"}`}
            >
              {t.label}
              {t.href === "/admin/requests" && pending > 0 && (
                <span className="rounded-full bg-amber px-1.5 font-mono text-[11px] font-bold text-black" aria-label={`${pending} pending`}>
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
