"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

// Counts down to a deadline in days/hours/minutes/seconds.
export function Countdown({ to, className }: { to: string; className?: string }) {
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => 0);
  if (!now) return <span className={className}>&nbsp;</span>;
  const left = Math.max(0, Math.floor(Date.parse(to) / 1000) - now);
  if (left === 0) return <span className={className}>CONTEST CLOSED</span>;
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className={className} aria-label={`${d} days ${h} hours ${m} minutes left`}>
      {d > 0 ? `${d}D ` : ""}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
