-- Commerce rules config — Phase B (COMMERCE-RULES backend).
--
-- ADDITIVE + IDEMPOTENT. Introduces three config tables that back the Super
-- Admin "Commerce Rules" control center and the public storefront read:
--   * public.commerce_rules    — a SINGLETON row (id = 1) holding the global
--     order/delivery/tax economics (all money in integer paise).
--   * public.delivery_slots    — the selectable delivery windows at checkout.
--   * public.serviceable_areas — the pincode → area serviceability list.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Access: service-role only, mirroring `public.products` / `public.inventory` —
-- RLS is enabled with NO policies, so anon / authenticated browser roles get
-- nothing and only the server (service role, which bypasses RLS) can read/write.
-- The storefront reads these through a server route (`/api/commerce-rules`),
-- never directly from the browser.

create extension if not exists pgcrypto;

-- Shared updated_at trigger function (already present from earlier migrations).
-- Re-declared identically here so this migration is self-contained + idempotent.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- commerce_rules — SINGLETON. The whole table is one row (id = 1); a check
-- constraint forbids any other id so there can only ever be one config.
-- All monetary fields are stored as integer paise (₹1 = 100 paise).
-- ---------------------------------------------------------------------------
create table if not exists public.commerce_rules (
  id integer primary key default 1,
  min_order_paise integer not null default 30000,            -- ₹300
  free_delivery_threshold_paise integer not null default 59900, -- ₹599
  shipping_type text not null default 'flat',                -- flat | slab | zero
  shipping_flat_paise integer not null default 4000,         -- ₹40
  shipping_slabs jsonb not null default '[]'::jsonb,         -- [{ uptoPaise, feePaise }]
  tax_mode text not null default 'inclusive',                -- inclusive | exclusive
  tax_rate_bps integer not null default 0,                   -- basis points (e.g. 500 = 5%)
  currency text not null default 'INR',
  updated_at timestamptz not null default now(),
  constraint commerce_rules_singleton check (id = 1),
  constraint commerce_rules_shipping_type_chk
    check (shipping_type in ('flat', 'slab', 'zero')),
  constraint commerce_rules_tax_mode_chk
    check (tax_mode in ('inclusive', 'exclusive'))
);

alter table public.commerce_rules enable row level security;

drop trigger if exists commerce_rules_set_updated_at on public.commerce_rules;
create trigger commerce_rules_set_updated_at
  before update on public.commerce_rules
  for each row execute function public.set_updated_at();

-- Seed the one and only config row (defaults supply every value).
insert into public.commerce_rules (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- delivery_slots — the delivery windows a customer can choose at checkout.
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  window_text text,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_slots enable row level security;

drop trigger if exists delivery_slots_set_updated_at on public.delivery_slots;
create trigger delivery_slots_set_updated_at
  before update on public.delivery_slots
  for each row execute function public.set_updated_at();

create index if not exists delivery_slots_active_sort_idx
  on public.delivery_slots (active, sort);

-- Seed ~3 default slots (idempotent: guarded by label so re-runs are no-ops).
insert into public.delivery_slots (label, window_text, sort, active)
select v.label, v.window_text, v.sort, true
from (values
  ('Morning',   '7:00 AM – 10:00 AM',  0),
  ('Afternoon', '12:00 PM – 3:00 PM',  1),
  ('Evening',   '5:00 PM – 8:00 PM',   2)
) as v(label, window_text, sort)
where not exists (
  select 1 from public.delivery_slots d where d.label = v.label
);

-- ---------------------------------------------------------------------------
-- serviceable_areas — pincode → area serviceability lookup.
-- ---------------------------------------------------------------------------
create table if not exists public.serviceable_areas (
  id uuid primary key default gen_random_uuid(),
  pincode text not null,
  area text,
  community text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.serviceable_areas enable row level security;

-- Fast serviceability checks key off the pincode.
create index if not exists serviceable_areas_pincode_idx
  on public.serviceable_areas (pincode);
