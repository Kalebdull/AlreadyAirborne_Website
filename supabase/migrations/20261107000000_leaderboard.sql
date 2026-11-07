-- Flight game leaderboard and contests.
-- Scores are written only by the server (service role) after it re-flies
-- the recorded run, so there is no insert policy for anyone else.

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.contests enable row level security;
create policy "contests: public read" on public.contests
  for select to anon, authenticated using (true);
create policy "contests: admin write" on public.contests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests on delete cascade,
  callsign text not null check (callsign ~ '^[A-Za-z0-9 ._-]{2,16}$'),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  marketing_opt_in boolean not null default false,
  score int not null check (score >= 0),
  breakdown jsonb not null,
  distance int,
  sink int,
  replay text not null, -- the recorded inputs, kept for audit
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, email) -- one entry per person per contest; best score counts
);
create index scores_contest_score on public.scores (contest_id, score desc, updated_at);
create index scores_ip_recent on public.scores (ip_hash, updated_at desc);

alter table public.scores enable row level security;
create policy "scores: admin read" on public.scores
  for select to authenticated using (public.is_admin());
create policy "scores: admin delete" on public.scores
  for delete to authenticated using (public.is_admin());

-- The public board: callsigns and scores only, never emails. Runs as the
-- view owner on purpose, so it can read past the admin-only table policy.
create view public.leaderboard with (security_invoker = false) as
select
  s.id,
  s.contest_id,
  s.callsign,
  s.score,
  s.distance,
  s.updated_at,
  rank() over (partition by s.contest_id order by s.score desc, s.updated_at asc) as place
from public.scores s;

revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;

-- A first contest to launch with (edit it in /admin/contest).
insert into public.contests (title, prize, starts_at, ends_at)
values ('Launch Contest', 'A free 1-hour 1-on-1 Zoom lesson', now(), now() + interval '30 days');
