import type { BookingStatus } from "@/lib/data";

const STYLES: Record<string, string> = {
  pending: "bg-amber/15 text-amber",
  cleared: "bg-green/15 text-green",
  unable: "bg-red/15 text-red",
  cancelled: "bg-raised text-dim",
  due: "bg-amber/15 text-amber",
  paid: "bg-green/15 text-green",
};

const LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  cleared: "Cleared",
  unable: "Unable",
  cancelled: "Cancelled",
};

export function StatusChip({ status }: { status: BookingStatus }) {
  return <Chip tone={status}>{LABELS[status]}</Chip>;
}

export function Chip({ tone, children }: { tone: keyof typeof STYLES; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.08em] whitespace-nowrap ${STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
