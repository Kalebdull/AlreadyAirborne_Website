-- Card payments through Stripe Checkout. The server (service role) marks a
-- booking paid once Stripe confirms the payment.

alter table public.bookings
  add column stripe_session_id text unique,
  add column paid_at timestamptz;

-- Same rules as before, plus: the server's service-role key may update
-- bookings (it only ever sets the payment fields, after verifying with Stripe).
create or replace function public.guard_booking_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if public.is_admin() or coalesce((select auth.role()), '') = 'service_role' then
    return new;
  end if;
  if old.status = 'pending' and new.status = 'cancelled'
     and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end $$;
