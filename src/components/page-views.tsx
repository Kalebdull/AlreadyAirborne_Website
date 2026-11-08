"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { markAdminBrowser, track } from "@/lib/track";

let last = { path: "", at: 0 };

// One page view per route change, for the admin overview.
export function PageViews() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return markAdminBrowser();
    // Effects can run twice for one navigation (dev mode, fast remounts).
    if (pathname === last.path && Date.now() - last.at < 2000) return;
    last = { path: pathname, at: Date.now() };
    track("pageview");
  }, [pathname]);
  return null;
}
