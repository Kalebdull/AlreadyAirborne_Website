"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Slot } from "@/lib/slots";
import {
  SERVICES,
  ZOOM_LENGTHS,
  formatHours,
  formatPrice,
  hoursFor,
  isOral,
  priceCents,
  serviceById,
  type ServiceId,
} from "@/lib/services";
import { requestBooking } from "./actions";

const subscribe = () => () => {};

type LocalDay = { key: string; date: Date; slots: Slot[] };

// Group slots by the student's own calendar day, in their time zone.
function groupByLocalDay(slots: Slot[]): LocalDay[] {
  const map = new Map<string, LocalDay>();
  for (const slot of slots) {
    const date = new Date(slot.startsAt);
    const key = date.toLocaleDateString("en-CA");
    if (!map.has(key)) map.set(key, { key, date, slots: [] });
    map.get(key)!.slots.push(slot);
  }
  return [...map.values()];
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function BookingForm({
  slots,
  signedIn,
  studentName,
  initialService,
}: {
  slots: Slot[];
  signedIn: boolean;
  studentName: string | null;
  initialService: ServiceId | null;
}) {
  // Slot times depend on the browser's time zone, so render on the client.
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const [serviceId, setServiceId] = useState<ServiceId | null>(initialService);
  const [zoomHours, setZoomHours] = useState<number>(1);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  // On a phone the times are below the fold once a day is picked; bring them up.
  const timesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dayKey) timesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [dayKey]);
  const [state, formAction, pending] = useActionState(requestBooking, undefined);

  const days = useMemo(() => (isClient ? groupByLocalDay(slots) : []), [isClient, slots]);
  const tzName = isClient
    ? new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value
    : "";

  const service = serviceId ? serviceById(serviceId) : undefined;
  const hours = serviceId ? hoursFor(serviceId, zoomHours) : zoomHours;
  const day = days.find((d) => d.key === dayKey);
  const slot = slots.find((s) => s.startsAt === startsAt);
  const fits = (s: Slot) => s.maxHours >= hours;
  const ready = Boolean(service && slot && fits(slot));
  const total = service ? priceCents(service.id, hours) : null;

  const missing = [!service && "SERVICE", !day && "DAY", !slot && "TIME"].filter(Boolean).join(", ");
  const whenText = slot
    ? new Date(slot.startsAt)
        .toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        .toUpperCase()
    : "";
  const readback = ready
    ? `${(studentName ?? "STUDENT").toUpperCase()}, CLEARED AS REQUESTED: ${service!.readback}${
        isOral(service!.id) ? "" : `, ${hours} HR`
      }, ${whenText} ${tzName}. ZOOM LINK TO FOLLOW ON CONFIRMATION.`
    : `STANDING BY. SELECT ${missing || "A TIME THAT FITS"}.`;

  if (state?.ok) {
    return (
      <div className="card flex flex-col items-start gap-5 p-10" role="status">
        <span className="rounded-full bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-[.08em] text-amber">
          PENDING
        </span>
        <h2 className="headline text-[40px]">Request sent.</h2>
        <p className="max-w-[560px] font-mono text-[15px] leading-relaxed text-cyan">{readback}</p>
        <p className="text-mute">I&apos;ll confirm soon. Your dashboard updates the moment I do, with the Zoom link and how to pay.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-10">
      <input type="hidden" name="service" value={serviceId ?? ""} />
      <input type="hidden" name="hours" value={zoomHours} />
      <input type="hidden" name="starts_at" value={startsAt ?? ""} />

      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-11">
        <Step label="1 · Service">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="option p-4 md:p-[22px]"
                aria-pressed={serviceId === s.id}
                onClick={() => setServiceId(s.id)}
              >
                <span className={`block font-mono text-[11px] uppercase tracking-[.1em] ${s.accent === "cyan" ? "text-cyan" : "text-magenta"}`}>
                  {s.eyebrow}
                </span>
                <span className="mt-1.5 block font-display text-[20px] font-semibold md:mt-2.5 md:text-[22px]">{s.label}</span>
                <span className="mt-1 block text-[15px] text-mute">
                  {s.priceLabel}
                  {isOral(s.id) ? " · 2 hours" : ""}
                </span>
              </button>
            ))}
          </div>
        </Step>

        {serviceId === "zoom" && (
          <Step label="2 · Length">
            <div className="flex flex-wrap gap-2">
              {ZOOM_LENGTHS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="option !rounded-full px-5 py-3.5 text-[15px]"
                  aria-pressed={zoomHours === h}
                  onClick={() => setZoomHours(h)}
                >
                  {formatHours(h)} · {formatPrice(priceCents("zoom", h))}
                </button>
              ))}
            </div>
          </Step>
        )}

        <Step label={`${serviceId === "zoom" ? 3 : 2} · Day`}>
          {!isClient ? (
            <div className="h-[76px] animate-pulse rounded-2xl bg-card" />
          ) : days.length === 0 ? (
            <p className="rounded-2xl bg-card p-5 text-mute">No open times right now. Check back soon or message me on Instagram.</p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(78px,1fr))] sm:gap-2">
              {days.map((d) => {
                const open = d.slots.some(fits);
                return (
                  <button
                    key={d.key}
                    type="button"
                    className="option px-1 py-2.5 text-center sm:px-2 sm:py-3.5"
                    aria-pressed={dayKey === d.key}
                    disabled={!open}
                    onClick={() => {
                      setDayKey(d.key);
                      setStartsAt(null);
                    }}
                  >
                    <span className="block font-mono text-[11px] uppercase text-dim">
                      {d.date.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span className="block font-display text-[22px] font-semibold sm:mt-1 sm:text-[26px]">{d.date.getDate()}</span>
                    <span className="block font-mono text-[10px] uppercase text-dim">
                      {d.date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Step>

        <Step label={`${serviceId === "zoom" ? 4 : 3} · Start time${tzName ? ` (${tzName})` : ""}`}>
          {day ? (
            <div ref={timesRef} className="grid scroll-mb-6 grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]">
              {day.slots.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  className="option px-2 py-3.5 text-center font-mono text-[15px]"
                  aria-pressed={startsAt === s.startsAt}
                  disabled={!fits(s)}
                  title={fits(s) ? undefined : `Only ${formatHours(s.maxHours)} free here`}
                  onClick={() => setStartsAt(s.startsAt)}
                >
                  {timeLabel(s.startsAt)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-dim">Pick a day first.</p>
          )}
        </Step>

        <label className="label">
          What are you stuck on? (optional)
          <textarea
            name="notes"
            rows={3}
            maxLength={1000}
            className="field resize-y"
            placeholder="e.g. Class B vs C entry, reading a METAR, holding entries…"
          />
        </label>
      </div>

      <aside className="card sticky top-[76px] flex flex-[1_1_340px] flex-col gap-[22px] p-8">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Readback</span>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-bold tracking-[.08em] ${
              ready ? "bg-cyan/15 text-cyan" : "bg-raised text-dim"
            }`}
          >
            {ready ? "READY" : "STANDBY"}
          </span>
        </div>
        <p key={readback} className="teletype min-h-[140px] font-mono text-base leading-[1.75] text-cyan" aria-live="polite">
          {readback}
        </p>
        <dl className="flex flex-col gap-2.5 border-t border-line pt-[18px] text-[15px]">
          <Row k="Service" v={service ? `${service.label}${isOral(service.id) ? "" : ` · ${hours} hr`}` : "—"} />
          <Row k="When" v={slot ? `${new Date(slot.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${timeLabel(slot.startsAt)}` : "—"} />
          <Row k="Where" v="Zoom" />
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3.5">
            <dt className="text-mute">Total, due after confirmation</dt>
            <dd className="font-display text-[32px] font-bold">{total === null ? "—" : formatPrice(total)}</dd>
          </div>
        </dl>
        {state?.error && (
          <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-[15px] text-red">
            {state.error}
          </p>
        )}
        {signedIn ? (
          <button type="submit" className="btn btn-primary w-full !py-4" disabled={!ready || pending}>
            {pending ? "Transmitting…" : "Request clearance"}
          </button>
        ) : (
          <Link href="/signup?next=/book" className="btn btn-primary w-full !py-4">
            Create profile to request
          </Link>
        )}
        <span className="text-[13px] leading-normal text-dim">
          Once I confirm, your dashboard shows the Zoom link and payment details.
        </span>
      </aside>
    </form>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="eyebrow mb-4">{label}</legend>
      {children}
    </fieldset>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
