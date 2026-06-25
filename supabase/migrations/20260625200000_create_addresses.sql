-- Customer Identity & De-duplication — Milestone 2, Task T4 (address book).
--
-- ADDITIVE + IDEMPOTENT. Introduces a delivery-address book attached to the
-- CANONICAL `public.customers` row, so a person's saved addresses are shared
-- across every sign-in identity (Google + phone) that resolves to the same
-- canonical customer. It does NOT touch or migrate any existing data and does
-- NOT change any sign-in or checkout behaviour. Safe to run repeatedly.
--
-- Structured M1 schema (per docs/Customer-Identity-Dedup-Plan.md §3.10):
-- Building/Floor/Flat, Road/Street, Area/Landmark, City, Pincode, Region,
-- State, Country (locked to 'India'); labels Home/Work/Other (+ custom label).
--
-- Access: service-role only, mirroring `public.customers` /
-- `public.customer_identities` — RLS is enabled with NO policies, so anon /
-- authenticated browser roles get nothing and only the server (service role,
-- which bypasses RLS) can read/write. Every API call scopes to the signed-in
-- customer's own `customer_id`.

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
-- Delivery addresses, owned by a canonical customer (shared across identities).
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- Recipient contact for this drop-off (may differ from the account owner).
  full_name text,
  phone text,
  -- Structured Indian address fields (M1).
  label text,                 -- 'home' | 'work' | 'other'
  custom_label text,          -- free text shown when label = 'other'
  building_floor_flat text,
  road_street text,
  area_landmark text,
  city text,
  pincode text,
  region text,
  state text,
  country text not null default 'India',
  is_default boolean not null default false,
  -- Optional geocode for future map-based delivery.
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.addresses enable row level security;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Primary lookup: every read/write is scoped by the owning customer.
create index if not exists addresses_customer_id_idx
  on public.addresses (customer_id);
