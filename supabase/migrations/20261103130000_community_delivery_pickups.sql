-- Community deliveries: an admin assigns a captain, a date and a slot to a
-- community's orders, and the captain delivers them door to door.
--
-- captain_pickups existed with a screen on top of it, but nothing ever created a
-- row and orders had no link to one. delivery_slots hold a time of day and no
-- date, so the date lives here.
--
-- Additive and idempotent. No existing row changes meaning. Deleting a pickup
-- unlinks its orders instead of touching them.

alter table public.captain_pickups
  add column if not exists delivery_date date,
  add column if not exists window_text text,
  add column if not exists assigned_by text;

alter table public.orders
  add column if not exists pickup_id uuid references public.captain_pickups(id) on delete set null;

create index if not exists orders_pickup_id_idx
  on public.orders (pickup_id)
  where pickup_id is not null;
