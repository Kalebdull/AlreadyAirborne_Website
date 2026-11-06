# AlreadyAirborne — design handoff

Live canvas: https://claude.ai/artifact/NgpdoNieYaTUSuj8HB37Va (the `.dc.html` files here are copies of its boards).

## The business
- CFI posting 30-second Instagram reels on hard student-pilot topics; this site is the link-in-bio.
- **1-on-1 Zoom tutoring — $50/hr** (1, 1.5 or 2 hr)
- **Mock oral exam — $175** (Private Pilot, Commercial)
- Booking is **request first, pay later**: student requests → CFI approves (CLEARED) or declines (UNABLE) → confirmation email with the personal Zoom link + payment details.
- Clips hosted on the site (Supabase Storage), free with an account, watch progress tracked.

## Design direction: Apple Pro × Glass Cockpit
- Black page, `#111214` rounded cards (20–28px radius), pill buttons, frosted sticky nav.
- Type: Inter Tight 700 (headlines, -3.5% tracking), Inter (body), JetBrains Mono caps (labels, statuses, readbacks).
- Color only with avionics meaning: cyan `#22D3EE` selectable · magenta `#F048C8` active · green `#4ADE80` cleared · amber `#FBBF24` pending · red `#F87171` unable.
- Logo: green flight-path-marker symbol + "AlreadyAirborne".

## Status (2026-11-06)
- [x] Next.js 16 + Tailwind scaffold
- [x] Design approved as a "good start"
- [x] Built: auth, clip library + progress, booking requests, dashboard, admin (requests / clips / settings), 404 + loading pages
- [ ] Content from owner: name, IG handle, ratings, bio, photo, Zoom link, time zone + weekly hours, clip files/titles/topics
- [ ] Supabase project URL + anon key; re-run `gh auth login` and `supabase login`
- [ ] Later: email notifications to you on new requests / to students on clear (e.g. Resend)
