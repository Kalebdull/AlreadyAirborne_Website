"use client";

import { useActionState } from "react";
import { saveSettings } from "../actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Half-hour starts from 6:00 AM to 9:30 PM.
const TIMES = Array.from({ length: 32 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const ZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function label(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a" : "p";
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

export function SettingsForm({
  settings,
  slots,
}: {
  settings: {
    timezone: string;
    zoom_link: string;
    payment_instructions: string;
    booking_window_days: number;
    min_notice_hours: number;
  };
  slots: string[];
}) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const selected = new Set(slots);
  const zones = ZONES.includes(settings.timezone) ? ZONES : [settings.timezone, ...ZONES];

  return (
    <form action={action} className="flex flex-col gap-10">
      <section className="card grid gap-6 p-8 md:grid-cols-2">
        <h2 className="eyebrow md:col-span-2">Session details</h2>
        <label className="label md:col-span-2">
          Your Zoom meeting link
          <input className="field" name="zoom_link" type="url" defaultValue={settings.zoom_link} placeholder="https://zoom.us/j/…" />
        </label>
        <label className="label md:col-span-2">
          Payment instructions (shown after you clear a request)
          <textarea
            className="field resize-y"
            name="payment_instructions"
            rows={3}
            defaultValue={settings.payment_instructions}
            placeholder="e.g. Venmo @yourname or Zelle you@email.com. Please pay before the session."
          />
        </label>
        <label className="label">
          Your time zone
          <select className="field" name="timezone" defaultValue={settings.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="label">
            Book up to (days)
            <input className="field" name="booking_window_days" type="number" min={1} max={120} defaultValue={settings.booking_window_days} />
          </label>
          <label className="label">
            Min notice (hours)
            <input className="field" name="min_notice_hours" type="number" min={0} max={168} defaultValue={settings.min_notice_hours} />
          </label>
        </div>
      </section>

      <section className="card flex flex-col gap-5 p-8">
        <div className="flex flex-col gap-1">
          <h2 className="eyebrow">Weekly hours</h2>
          <p className="text-[15px] text-mute">
            Check every start time you&apos;re available, in your time zone. Students see them converted to theirs. Longer sessions
            automatically block the slots they overlap.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 font-mono text-[12px]">
            <thead>
              <tr>
                <th className="w-14" />
                {DAYS.map((d) => (
                  <th key={d} className="pb-2 font-normal uppercase text-dim">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((t) => (
                <tr key={t}>
                  <td className="pr-2 text-right text-dim">{label(t)}</td>
                  {DAYS.map((d, i) => (
                    <td key={d}>
                      <label className="block cursor-pointer">
                        <input
                          type="checkbox"
                          name="slot"
                          value={`${i}@${t}`}
                          defaultChecked={selected.has(`${i}@${t}`)}
                          className="peer sr-only"
                        />
                        <span className="block h-7 rounded-md bg-raised/60 transition-colors hover:bg-edge peer-checked:bg-cyan/80 peer-focus-visible:outline-2 peer-focus-visible:outline-cyan">
                          <span className="sr-only">
                            {d} {label(t)}
                          </span>
                        </span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-4 self-start rounded-full bg-card/90 p-2 pr-5 backdrop-blur">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state?.error && <span className="text-[15px] text-red">{state.error}</span>}
        {state?.message && <span className="text-[15px] text-green">{state.message}</span>}
      </div>
    </form>
  );
}
