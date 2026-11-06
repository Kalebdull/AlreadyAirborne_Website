"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Times are stored in UTC; show them in the viewer's own time zone. The
// server can't know that zone, so it renders a placeholder and the browser
// fills in the real value right after hydration.
export function LocalTime({
  iso,
  format = "datetime",
}: {
  iso: string;
  format?: "datetime" | "date" | "time" | "relative";
}) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!isClient) return <span className="opacity-0">—</span>;
  return <time dateTime={iso}>{formatLocal(iso, format)}</time>;
}

export function formatLocal(iso: string, format: "datetime" | "date" | "time" | "relative" = "datetime") {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (format === "time") return time;
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (format === "date") return day;
  if (format === "relative") {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
    if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  }
  return `${day}, ${time}`;
}
