-- Leave admin accounts out of sign-up counts; send days as plain dates.
create or replace function public.admin_stats(days int default 30)
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
      'signups', (select count(*) from public.profiles where created_at >= w.since and role <> 'admin'),
      'scores', (select count(*) from public.scores where updated_at >= w.since),
      'requests', (select count(*) from public.bookings where created_at >= w.since)
    )) as v from windows w
  ),
  days_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', to_char(d.day, 'YYYY-MM-DD'),
      'visitors', (select count(distinct visitor) from e where (created_at at time zone tz)::date = d.day),
      'players', (select count(distinct visitor) from e where kind = 'game_start' and (created_at at time zone tz)::date = d.day),
      'runs', (select count(*) from e where kind = 'run_end' and (created_at at time zone tz)::date = d.day),
      'signups', (select count(*) from public.profiles p where (p.created_at at time zone tz)::date = d.day and p.role <> 'admin')
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
