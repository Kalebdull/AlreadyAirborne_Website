// What each library topic covers. Shown on the homepage so the library reads
// as a real curriculum even before every clip is uploaded. Slugs match the
// `topics` table.
export const TOPICS = [
  {
    slug: "instruments",
    name: "Flight Instruments",
    blurb: "What each instrument really tells you, and when it lies.",
    covers: ["Setting the altimeter", "Altimeter errors", "Pitot-static system", "Partial panel"],
    featured: true,
  },
  { slug: "airspace", name: "Airspace", covers: ["Class B, C and D entry", "VFR weather minimums", "Special use airspace"] },
  { slug: "weather", name: "Weather", covers: ["Reading METARs and TAFs", "Fronts and stability", "Icing and fog"] },
  { slug: "regulations", name: "Regulations", covers: ["Currency and recency", "Required documents", "Right-of-way rules"] },
  { slug: "aerodynamics", name: "Aerodynamics", covers: ["Stalls and spins", "Load factor in turns", "Left-turning tendencies"] },
  { slug: "navigation", name: "Navigation", covers: ["VOR navigation", "Holding patterns", "Planning a cross-country"] },
] as const;

// The ticker under the flight display: things students get stuck on.
export const STUCK_ON = [
  "Class B vs C entry",
  "Reading a METAR",
  "Holding pattern entries",
  "Density altitude",
  "Left-turning tendencies",
  "VFR weather minimums",
  "Crosswind landings",
  "Load factor in turns",
  "Lost comms procedures",
  "Required inspections",
  "Pitot-static errors",
  "Stall vs spin",
];
