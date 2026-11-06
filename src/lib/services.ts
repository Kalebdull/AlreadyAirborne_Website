// Must match the price trigger in supabase/migrations (the database is the
// source of truth for what a booking costs; this copy is for display).
export type ServiceId = "zoom" | "oral_ppl" | "oral_cpl";

export type Service = {
  id: ServiceId;
  eyebrow: string;
  label: string;
  readback: string;
  priceLabel: string;
  accent: "cyan" | "magenta";
};

export const SERVICES: Service[] = [
  {
    id: "zoom",
    eyebrow: "Session · Zoom",
    label: "1-on-1 Tutoring",
    readback: "1-ON-1 ZOOM SESSION",
    priceLabel: "$50 / hour",
    accent: "cyan",
  },
  {
    id: "oral_ppl",
    eyebrow: "Mock oral",
    label: "Private Pilot",
    readback: "PRIVATE PILOT MOCK ORAL",
    priceLabel: "$175",
    accent: "magenta",
  },
  {
    id: "oral_cpl",
    eyebrow: "Mock oral",
    label: "Commercial",
    readback: "COMMERCIAL MOCK ORAL",
    priceLabel: "$175",
    accent: "magenta",
  },
];

export const ZOOM_HOURLY_CENTS = 5000;
export const ORAL_CENTS = 17500;
export const ORAL_HOURS = 2;
export const ZOOM_LENGTHS = [1, 1.5, 2] as const;

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function isOral(id: ServiceId) {
  return id !== "zoom";
}

export function hoursFor(id: ServiceId, zoomHours: number) {
  return isOral(id) ? ORAL_HOURS : zoomHours;
}

export function priceCents(id: ServiceId, hours: number) {
  return isOral(id) ? ORAL_CENTS : Math.round(ZOOM_HOURLY_CENTS * hours);
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function formatHours(hours: number) {
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
