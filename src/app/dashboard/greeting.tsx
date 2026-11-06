"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Uses the viewer's local hour, which only the browser knows.
export function Greeting() {
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => -1);
  if (hour < 0) return <>Welcome back</>;
  if (hour < 12) return <>Good morning</>;
  if (hour < 18) return <>Good afternoon</>;
  return <>Good evening</>;
}
