// Turns weekly availability (wall-clock times in the instructor's time zone)
// into concrete UTC start times, minus anything already booked.

export type AvailabilityRow = { weekday: number; start_time: string };
export type Busy = { starts_at: string; ends_at: string };
export type BookingConfig = {
  timezone: string;
  booking_window_days: number;
  min_notice_hours: number;
};

export type Slot = { startsAt: string; maxHours: number };
export type SlotDay = { key: string; startsAt: string; slots: Slot[] };

const HOUR = 3_600_000;

// Offset (ms) of `timeZone` from UTC at the given instant.
function tzOffset(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant;
}

// UTC instant for a wall-clock time in `timeZone` (DST-safe).
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, timeZone: string) {
  const guess = Date.UTC(y, m, d, hh, mm);
  const first = guess - tzOffset(guess, timeZone);
  return guess - tzOffset(first, timeZone);
}

// Calendar date (y, m, d, weekday) of an instant as seen in `timeZone`.
function zonedDate(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")) - 1,
    d: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

export function buildSlots(
  availability: AvailabilityRow[],
  busy: Busy[],
  config: BookingConfig,
  now = Date.now(),
): SlotDay[] {
  const { timezone } = config;
  const earliest = now + config.min_notice_hours * HOUR;
  const latest = now + config.booking_window_days * 24 * HOUR;
  const busyRanges = busy.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);

  // Every availability start in the window, sorted, so we can tell how long a
  // session can run before bumping into the next booking.
  const days: SlotDay[] = [];
  for (let i = 0; i <= config.booking_window_days; i++) {
    const date = zonedDate(now + i * 24 * HOUR, timezone);
    const key = `${date.y}-${String(date.m + 1).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    if (days.some((day) => day.key === key)) continue;

    const slots: Slot[] = [];
    const rows = availability
      .filter((a) => a.weekday === date.weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (const row of rows) {
      const [hh, mm] = row.start_time.split(":").map(Number);
      const start = zonedToUtc(date.y, date.m, date.d, hh, mm, timezone);
      if (start < earliest || start > latest) continue;

      // Longest session (up to 2h) that doesn't overlap a live booking.
      let maxHours = 0;
      for (const hours of [1, 1.5, 2]) {
        const end = start + hours * HOUR;
        if (busyRanges.some(([bs, be]) => start < be && end > bs)) break;
        maxHours = hours;
      }
      if (maxHours > 0) slots.push({ startsAt: new Date(start).toISOString(), maxHours });
    }

    days.push({
      key,
      startsAt: new Date(zonedToUtc(date.y, date.m, date.d, 12, 0, timezone)).toISOString(),
      slots,
    });
  }
  return days;
}
