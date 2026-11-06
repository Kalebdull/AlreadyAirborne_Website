-- AlreadyAirborne initial schema
-- Paste into Supabase Dashboard > SQL Editor and run, or `supabase db push`.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');
create type public.booking_service as enum ('zoom', 'oral_ppl', 'oral_cpl');
create type public.booking_status as enum ('pending', 'cleared', 'unable', 'cancelled');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Students may edit their name, never their role or email.
-- (Runs as the SQL editor / service role when auth.uid() is null, so the
-- first admin can be promoted from the dashboard.)
create function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.email is distinct from old.email or new.id <> old.id then
      raise exception 'Not allowed to change that field';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Library: topics and clips
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics on delete restrict,
  title text not null,
  summary text,
  video_path text,            -- object path in the "clips" storage bucket
  poster_path text,           -- optional thumbnail in the same bucket
  duration_seconds int,
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index clips_topic_position on public.clips (topic_id, position);

create table public.clip_progress (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  clip_id uuid not null references public.clips on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, clip_id)
);

alter table public.topics enable row level security;
alter table public.clips enable row level security;
alter table public.clip_progress enable row level security;

create policy "topics: public read" on public.topics
  for select to anon, authenticated using (true);
create policy "topics: admin write" on public.topics
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "clips: public read published" on public.clips
  for select to anon, authenticated using (published or public.is_admin());
create policy "clips: admin write" on public.clips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "progress: own" on public.clip_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Booking settings (admin only) and weekly availability (public read)
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  timezone text not null default 'America/New_York',
  zoom_link text,
  payment_instructions text,
  booking_window_days int not null default 21 check (booking_window_days between 1 and 120),
  min_notice_hours int not null default 12 check (min_notice_hours between 0 and 168),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

alter table public.settings enable row level security;
create policy "settings: admin" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The non-secret parts of settings, for the booking page.
create function public.booking_config()
returns table (timezone text, booking_window_days int, min_notice_hours int)
language sql stable security definer set search_path = '' as $$
  select s.timezone, s.booking_window_days, s.min_notice_hours from public.settings s where s.id = 1;
$$;

-- Start times you're available, in settings.timezone. 0 = Sunday.
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  unique (weekday, start_time)
);

alter table public.availability enable row level security;
create policy "availability: public read" on public.availability
  for select to anon, authenticated using (true);
create policy "availability: admin write" on public.availability
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bookings: request first, pay later
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  service public.booking_service not null,
  hours numeric(3, 1) not null check (hours in (1, 1.5, 2)),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text check (char_length(notes) <= 1000),
  status public.booking_status not null default 'pending',
  price_cents int not null,
  paid boolean not null default false,
  zoom_link text,
  payment_instructions text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No two live bookings may overlap.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'cleared'))
);
create index bookings_user on public.bookings (user_id, starts_at desc);
create index bookings_status on public.bookings (status, starts_at);

-- Server-side rules for every new request: price, length, and the slot must
-- be one you're actually available for. Clients can't set any of these.
create function public.prepare_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cfg public.settings;
  local_start timestamp;
begin
  select * into cfg from public.settings where id = 1;

  if not public.is_admin() then
    new.user_id := (select auth.uid());
  end if;

  if new.service <> 'zoom' then
    new.hours := 2;
    new.price_cents := 17500;
  else
    new.price_cents := round(5000 * new.hours);
  end if;

  new.ends_at := new.starts_at + make_interval(mins => (new.hours * 60)::int);
  new.status := 'pending';
  new.paid := false;
  new.zoom_link := null;
  new.payment_instructions := null;
  new.admin_note := null;

  if new.starts_at < now() + make_interval(hours => cfg.min_notice_hours) then
    raise exception 'That time is too soon to book' using errcode = 'P0001';
  end if;
  if new.starts_at > now() + make_interval(days => cfg.booking_window_days) then
    raise exception 'That time is too far out to book' using errcode = 'P0001';
  end if;

  local_start := new.starts_at at time zone cfg.timezone;
  if not exists (
    select 1 from public.availability a
    where a.weekday = extract(dow from local_start)
      and a.start_time = local_start::time
  ) then
    raise exception 'That time is not available' using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger bookings_prepare before insert on public.bookings
  for each row execute function public.prepare_booking();

-- Students can only cancel their own pending request; everything else is yours.
create function public.guard_booking_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if public.is_admin() then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'cancelled'
     and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end $$;

create trigger bookings_guard before update on public.bookings
  for each row execute function public.guard_booking_update();

alter table public.bookings enable row level security;

create policy "bookings: read own or admin" on public.bookings
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "bookings: insert own" on public.bookings
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "bookings: update own or admin" on public.bookings
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "bookings: admin delete" on public.bookings
  for delete to authenticated using (public.is_admin());

-- Taken time ranges, with no names attached, so the booking page can grey
-- out slots without exposing anyone's booking.
create function public.busy_slots(p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.starts_at, b.ends_at from public.bookings b
  where b.status in ('pending', 'cleared')
    and b.starts_at < p_to and b.ends_at > p_from;
$$;

grant execute on function public.booking_config() to anon, authenticated;
grant execute on function public.busy_slots(timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private "clips" bucket. Signed-in users can watch; admin uploads.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

create policy "clips bucket: signed-in read" on storage.objects
  for select to authenticated using (bucket_id = 'clips');
create policy "clips bucket: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'clips' and public.is_admin());
create policy "clips bucket: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'clips' and public.is_admin());
create policy "clips bucket: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'clips' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Starter data (edit freely in the admin pages)
-- ---------------------------------------------------------------------------
insert into public.topics (slug, name, position) values
  ('airspace', 'Airspace', 1),
  ('weather', 'Weather', 2),
  ('regulations', 'Regulations', 3),
  ('instrument', 'Instrument 101', 4),
  ('aerodynamics', 'Aerodynamics', 5),
  ('navigation', 'Navigation', 6);

-- Placeholder weekly hours: weekday evenings, weekend daytime.
insert into public.availability (weekday, start_time)
select d, t::time from generate_series(1, 5) d, unnest(array['18:00', '20:00']) t
union all
select d, t::time from unnest(array[0, 6]) d, unnest(array['09:00', '11:00', '13:00', '15:00']) t;
