// Everything about you that appears on the site lives here.
export const site = {
  name: "AlreadyAirborne",
  instructor: {
    name: "Kaleb Dull",
    ratings: ["CFI"],
    location: "San Jose, CA",
    bio: "I'm Kaleb, a 24-year-old flight instructor in San Jose, California. I started making these 30-second videos to get better at teaching: every one is me hunting for the relatable idea that makes a hard topic finally click. That's how I run sessions too. We keep trying new angles until it makes sense to you, not just to the textbook.",
    photo: "/instructor.jpg" as string | null, // in /public
    photoAlt: "Kaleb Dull (right) shaking hands on the ramp in front of a Cessna 172",
  },
  instagram: {
    handle: "alreadyairborne",
    url: "https://www.instagram.com/alreadyairborne/",
  },
  email: "alreadyairborne@gmail.com",
  timezone: "America/Los_Angeles",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
