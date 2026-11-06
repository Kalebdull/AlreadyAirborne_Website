// Everything about you that appears on the site lives here.
// Replace the bracketed values; nothing else needs to change.
export const site = {
  name: "AlreadyAirborne",
  instructor: {
    name: "[Your Name]",
    firstName: "[Name]",
    ratings: ["CFI", "[Other ratings]"],
    bio: "[A few sentences in your own voice: why you started making 30-second videos, and what a session with you feels like.]",
    photo: null as string | null, // e.g. "/instructor.jpg" placed in /public
  },
  instagram: {
    handle: "[handle]",
    url: "https://instagram.com/[handle]",
  },
  // Optional short, compressed (<10 MB) vertical reel for the homepage phone,
  // placed in /public, e.g. "/hero-reel.mp4".
  heroReel: null as string | null,
  email: "alreadyairborne@gmail.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
