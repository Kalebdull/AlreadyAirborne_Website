// What each library topic covers. Shown on the homepage so the library reads
// as a real curriculum even before every clip is uploaded. Slugs match the
// `topics` table.
export const TOPICS = [
  {
    slug: "instrument",
    name: "Instrument 101",
    blurb: "The scan, holds and approaches, one idea at a time.",
    covers: ["The instrument scan", "Holding entries", "Approach briefings", "Partial panel"],
    featured: true,
  },
  { slug: "airspace", name: "Airspace", covers: ["Class B, C and D entry", "VFR weather minimums", "Special use airspace"] },
  { slug: "weather", name: "Weather", covers: ["Reading METARs and TAFs", "Fronts and stability", "Icing and fog"] },
  { slug: "regulations", name: "Regulations", covers: ["Currency and recency", "Required documents", "Right-of-way rules"] },
  { slug: "aerodynamics", name: "Aerodynamics", covers: ["Stalls and spins", "Load factor in turns", "Left-turning tendencies"] },
  { slug: "navigation", name: "Navigation", covers: ["Reading a sectional", "VOR navigation", "Planning a cross-country"] },
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
