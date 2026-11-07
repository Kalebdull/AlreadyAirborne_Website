// Everything about you that appears on the site lives here.
export const site = {
  name: "AlreadyAirborne",
  instructor: {
    name: "Kaleb Dull",
    ratings: ["CFI"],
    location: "San Jose, CA",
    bio: "I'm Kaleb, a flight instructor in San Jose, California. I started making these 30-second videos to get better at teaching: every one is me hunting for the relatable idea that makes a hard topic finally click. That's how I run sessions too. We keep trying new angles until it makes sense to you, not just to the textbook.",
    photo: null as string | null, // e.g. "/instructor.jpg" placed in /public
  },
  instagram: {
    handle: "[handle]",
    url: "https://instagram.com/[handle]",
  },
  email: "alreadyairborne@gmail.com",
  timezone: "America/Los_Angeles",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
