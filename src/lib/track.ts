// Anonymous activity for the admin overview: a random id per browser, one per
// visit, sent with sendBeacon so it never slows the page. Browsers where the
// admin has opened /admin are left out (see markAdminBrowser).

const VISITOR_KEY = "aa:visitor";
const SESSION_KEY = "aa:session";
const SKIP_KEY = "aa:skip-stats";
const SESSION_IDLE_MS = 30 * 60 * 1000;
let sent = 0; // per page load, a backstop against runaway loops

function id() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function ids() {
  try {
    if (localStorage.getItem(SKIP_KEY)) return null;
    let visitor = localStorage.getItem(VISITOR_KEY);
    if (!visitor) localStorage.setItem(VISITOR_KEY, (visitor = id()));
    // A visit ends after 30 idle minutes.
    const [sid, at] = (sessionStorage.getItem(SESSION_KEY) ?? "").split("|");
    const session = sid && Date.now() - Number(at) < SESSION_IDLE_MS ? sid : id();
    sessionStorage.setItem(SESSION_KEY, `${session}|${Date.now()}`);
    return { visitor, session, fresh: session !== sid };
  } catch {
    return null; // storage blocked: don't track
  }
}

export type TrackKind = "pageview" | "game_start" | "run_end";

export function track(kind: TrackKind, data?: Record<string, unknown>) {
  if (typeof window === "undefined" || sent >= 300) return;
  const who = ids();
  if (!who) return;
  sent++;
  const params = new URLSearchParams(location.search);
  const body = JSON.stringify({
    kind,
    ...who,
    path: location.pathname,
    // The referrer and campaign tag only matter on a visit's first hit.
    referrer: who.fresh ? document.referrer || null : null,
    utm: who.fresh ? params.get("utm_source") ?? params.get("ref") : null,
    data,
  });
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/track", blob)) {
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

// Called on admin pages so your own browsing doesn't count.
export function markAdminBrowser() {
  try {
    localStorage.setItem(SKIP_KEY, "1");
  } catch {}
}

export function unmarkAdminBrowser() {
  try {
    localStorage.removeItem(SKIP_KEY);
  } catch {}
}
