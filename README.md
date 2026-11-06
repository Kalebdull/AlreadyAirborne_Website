# AlreadyAirborne

The link-in-bio site for the AlreadyAirborne Instagram: 30-second explainers on the topics student pilots struggle with, plus 1-on-1 Zoom tutoring ($50/hr) and mock oral exams ($175).

Next.js 16 · Tailwind 4 · Supabase (auth, Postgres, storage). Design notes and mockups: [design/](design/).

## What's here

| Page | What it does |
| --- | --- |
| `/` | Homepage: hero, offers, library topics, how it works, about |
| `/library`, `/library/[id]` | Clip library by topic; vertical player with watch tracking (free account required to watch) |
| `/book` | Request a Zoom session or mock oral in an open slot; shown in the student's time zone |
| `/dashboard` | Next session + Zoom link + payment status, library progress, request history |
| `/admin` | Clear / decline requests, mark paid |
| `/admin/clips` | Upload clips (straight to Supabase Storage), publish, reorder, topics |
| `/admin/settings` | Zoom link, payment instructions, time zone, weekly hours |

Booking is **request first, pay later**: the database sets the price, checks the slot is one you offered, and refuses overlapping bookings, so none of that can be tampered with from the browser.

## Setup

1. **Database.** In Supabase, open *SQL Editor*, paste all of `supabase/migrations/20261106000000_init.sql`, and run it.
2. **Keys.** `cp .env.example .env.local` and fill in the URL and publishable/anon key from *Project Settings → API*.
3. **Auth URLs.** In *Authentication → URL Configuration*, set *Site URL* to your domain and add `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` to *Redirect URLs*.
4. **Run it.** `npm install && npm run dev`, then create your account at `/signup`.
5. **Make yourself admin.** In the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
6. **Fill in your details** in `src/lib/site.ts` (name, Instagram handle, ratings, bio, photo), then go to `/admin/settings` for your Zoom link, payment instructions and hours.

## Deploy

Import the GitHub repo into Vercel, add the three env vars from `.env.example`, deploy, then update the Supabase Site URL / Redirect URLs to the live domain.
