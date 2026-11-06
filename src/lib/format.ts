export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The time this request is being rendered. Server pages here render per
// request, so reading the clock once at the top is intended.
export function requestTime() {
  return Date.now();
}
