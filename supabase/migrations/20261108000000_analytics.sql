-- Site activity: page views and flight-game runs, so the admin can see who's
-- visiting and playing even when they never sign up or submit a score.
-- Anonymous by design: a random per-browser id, no IP addresses.

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('pageview', 'game_start', 'run_end')),
  visitor text not null check (char_length(visitor) between 8 and 64),
  session text not null check (char_length(session) between 8 and 64),
  user_id uuid references auth.users on delete set null,
  path text check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 300),
  source text check (char_length(source) <= 60),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  country text check (char_length(country) <= 2),
  city text check (char_length(city) <= 80),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 2000)
);
create index events_created on public.events (created_at desc);
create index events_session on public.events (session, created_at);
create index events_visitor on public.events (visitor, created_at);

-- Written only by the server (service role). Only the admin can read.
alter table public.events enable row level security;
create policy "events: admin reads" on public.events
  for select to authenticated using (public.is_admin());

-- Everything the overview needs, in one round trip.
create function public.admin_stats(days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
  tz text := coalesce((select timezone from public.settings where id = 1), 'America/Los_Angeles');
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  with e as (
    select * from public.events where created_at >= since
  ),
  windows as (
    select w.name, w.since from (values
      ('today', date_trunc('day', now() at time zone tz) at time zone tz),
      ('week', now() - interval '7 days'),
      ('range', since)
    ) as w(name, since)
  ),
  totals as (
    select jsonb_object_agg(w.name, jsonb_build_object(
      'visitors', (select count(distinct visitor) from e where created_at >= w.since),
      'pageviews', (select count(*) from e where kind = 'pageview' and created_at >= w.since),
      'players', (select count(distinct visitor) from e where kind = 'game_start' and created_at >= w.since),
      'runs', (select count(*) from e where kind = 'run_end' and created_at >= w.since),
      'landings', (select coalesce(sum((data ->> 'cleared')::int), 0) from e where kind = 'run_end' and created_at >= w.since),
      'signups', (select count(*) from public.profiles where created_at >= w.since),
      'scores', (select count(*) from public.scores where updated_at >= w.since),
      'requests', (select count(*) from public.bookings where created_at >= w.since)
    )) as v from windows w
  ),
  days_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'visitors', (select count(distinct visitor) from e where (created_at at time zone tz)::date = d.day),
      'players', (select count(distinct visitor) from e where kind = 'game_start' and (created_at at time zone tz)::date = d.day),
      'runs', (select count(*) from e where kind = 'run_end' and (created_at at time zone tz)::date = d.day),
      'signups', (select count(*) from public.profiles p where (p.created_at at time zone tz)::date = d.day)
    ) order by d.day), '[]'::jsonb) as v
    from generate_series((since at time zone tz)::date, (now() at time zone tz)::date, interval '1 day') as d(day)
  ),
  first_hits as (
    select distinct on (session) session, source, device, country, city
    from e order by session, created_at
  ),
  sources as (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) order by n desc), '[]'::jsonb) as v
    from (select coalesce(source, 'direct') as name, count(*) as n from first_hits group by 1 order by 2 desc limit 8) s
  ),
  devices as (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) order by n desc), '[]'::jsonb) as v
    from (select coalesce(device, 'unknown') as name, count(*) as n from first_hits group by 1) s
  ),
  places as (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) order by n desc), '[]'::jsonb) as v
    from (
      select concat_ws(', ', nullif(city, ''), country) as name, count(*) as n
      from first_hits where country is not null group by 1 order by 2 desc limit 8
    ) s
  ),
  pages as (
    select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n, 'visitors', v) order by n desc), '[]'::jsonb) as v
    from (
      select path, count(*) as n, count(distinct visitor) as v
      from e where kind = 'pageview' group by path order by 2 desc limit 10
    ) s
  ),
  levels as (
    -- How far hand-flown runs got: index = levels landed (0-10).
    select coalesce(jsonb_agg(n order by lvl), '[]'::jsonb) as v
    from (
      select g.lvl, (select count(*) from e where kind = 'run_end' and (data ->> 'cleared')::int = g.lvl) as n
      from generate_series(0, 10) as g(lvl)
    ) s
  ),
  best as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'visitor', visitor, 'score', score, 'cleared', cleared, 'runs', runs, 'last', last, 'email', email
    ) order by score desc), '[]'::jsonb) as v
    from (
      select r.visitor,
        max((r.data ->> 'score')::int) as score,
        max((r.data ->> 'cleared')::int) as cleared,
        count(*) as runs,
        max(r.created_at) as last,
        max(p.email) as email
      from e r left join public.profiles p on p.id = r.user_id
      where r.kind = 'run_end'
      group by r.visitor
      order by 2 desc nulls last
      limit 10
    ) s
  )
  select jsonb_build_object(
    'since', since,
    'totals', (select v from totals),
    'days', (select v from days_series),
    'sources', (select v from sources),
    'devices', (select v from devices),
    'places', (select v from places),
    'pages', (select v from pages),
    'levels', (select v from levels),
    'pilots', (select v from best),
    'live', (select count(distinct visitor) from public.events where created_at >= now() - interval '5 minutes')
  ) into result;
  return result;
end;
$$;

-- One row per visit, newest first: where they came from, what they did.
create function public.admin_sessions(max_rows int default 40)
returns table (
  session text,
  visitor text,
  started timestamptz,
  last_seen timestamptz,
  email text,
  source text,
  device text,
  place text,
  pages int,
  page_list text[],
  runs int,
  best_score int,
  best_cleared int,
  is_returning boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
  with recent as (
    select ev.session as s, min(ev.created_at) as started, max(ev.created_at) as last_seen
    from public.events ev
    where ev.created_at >= now() - interval '30 days'
    group by ev.session
    order by max(ev.created_at) desc
    limit greatest(1, least(max_rows, 200))
  )
  select
    r.s,
    min(ev.visitor),
    r.started,
    r.last_seen,
    max(p.email),
    (array_agg(ev.source order by ev.created_at))[1],
    (array_agg(ev.device order by ev.created_at))[1],
    (array_agg(concat_ws(', ', nullif(ev.city, ''), ev.country) order by ev.created_at))[1],
    (count(*) filter (where ev.kind = 'pageview'))::int,
    (array_agg(distinct ev.path) filter (where ev.kind = 'pageview'))[1:6],
    (count(*) filter (where ev.kind = 'run_end'))::int,
    max((ev.data ->> 'score')::int) filter (where ev.kind = 'run_end'),
    max((ev.data ->> 'cleared')::int) filter (where ev.kind = 'run_end'),
    exists (
      select 1 from public.events old
      where old.visitor = min(ev.visitor) and old.created_at < r.started - interval '30 minutes'
    )
  from recent r
  join public.events ev on ev.session = r.s
  left join public.profiles p on p.id = ev.user_id
  group by r.s, r.started, r.last_seen
  order by r.last_seen desc;
end;
$$;

-- Students with what they've done on the site.
create function public.admin_students()
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  joined timestamptz,
  last_seen timestamptz,
  clips_watched int,
  requests int,
  sessions_done int,
  best_cleared int
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
  select
    p.id, p.email, p.full_name, p.role, p.created_at,
    (select max(ev.created_at) from public.events ev where ev.user_id = p.id),
    (select count(*) from public.clip_progress cp where cp.user_id = p.id)::int,
    (select count(*) from public.bookings b where b.user_id = p.id)::int,
    (select count(*) from public.bookings b where b.user_id = p.id and b.status = 'cleared' and b.ends_at < now())::int,
    (select max((ev.data ->> 'cleared')::int) from public.events ev where ev.user_id = p.id and ev.kind = 'run_end')
  from public.profiles p
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_stats(int) from public, anon;
revoke all on function public.admin_sessions(int) from public, anon;
revoke all on function public.admin_students() from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
grant execute on function public.admin_sessions(int) to authenticated;
grant execute on function public.admin_students() to authenticated;
