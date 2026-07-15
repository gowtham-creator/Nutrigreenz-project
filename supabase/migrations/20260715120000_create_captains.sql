-- Captains — field-sales "captain" module (stall sales, settlements, pickups).
--
-- ADDITIVE + IDEMPOTENT. Introduces the server-owned tables behind the /captain
-- field tool and its admin management surface:
--   * public.captains            — one row per field agent. `phone` is the
--                                  normalized 10-digit OTP sign-in key (unique).
--                                  `communities` are the stalls they rotate;
--                                  `commission_percent` (0..100) is applied to
--                                  settled GMV; `active` is the sign-in gate.
--   * public.captain_captures    — one walk-up stall sale a captain recorded.
--                                  `items` is a jsonb array of line items with
--                                  integer-paise prices; `total_paise` is the
--                                  server-computed sum. `customer_mobile` is
--                                  cross-matched to public.customers and, when
--                                  found, `linked_customer_id` is stamped.
--   * public.captain_settlements — a captain's end-of-day cash-up. ONE row per
--                                  captain per day (unique (captain_id, settle_date))
--                                  so a re-submit UPSERTs. All money is paise.
--   * public.captain_pickups     — community pickups a captain advances through
--                                  due → collected → handed_over.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Money is INTEGER PAISE throughout (never rupees, never floats) — mirroring
-- public.orders / public.promotions. Conversion happens only at the UI edge.
--
-- Access: service-role only, mirroring public.orders / public.customers — RLS is
-- enabled with NO policies, so anon / authenticated browser roles get nothing and
-- only the server (service role, which bypasses RLS) can read/write. The captain
-- PWA reaches its own rows through the session-guarded /api/captain/* routes;
-- administration goes through the permission-gated /api/admin/captains routes.

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
-- captains — the field-agent roster. Admin-managed; a captain signs in to the
-- /captain tool by phone-OTP against the normalized 10-digit `phone`.
-- ---------------------------------------------------------------------------
create table if not exists public.captains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Normalized 10-digit mobile — the unique OTP sign-in key.
  phone text not null unique,
  area text,
  stall text,
  -- Communities this captain rotates stalls through.
  communities text[] not null default '{}',
  -- Whole-or-fractional percent (0..100) applied to settled GMV.
  commission_percent numeric not null default 0,
  -- Sign-in gate: an inactive captain is refused at login.
  active boolean not null default true,
  -- Email of the admin who created the row (audit breadcrumb; nullable).
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captains_commission_percent_chk
    check (commission_percent >= 0 and commission_percent <= 100)
);

alter table public.captains enable row level security;

drop trigger if exists captains_set_updated_at on public.captains;
create trigger captains_set_updated_at
  before update on public.captains
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- captain_captures — one walk-up stall sale a captain recorded during the day.
-- ---------------------------------------------------------------------------
create table if not exists public.captain_captures (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.captains(id) on delete cascade,
  customer_name text not null,
  -- Normalized 10-digit mobile — the cross-match key to public.customers.
  customer_mobile text not null,
  community text,
  -- Array of { sku, title, unit, price_paise, qty } — integer-paise prices.
  items jsonb not null default '[]',
  -- Server-computed sum of (price_paise * qty), integer paise.
  total_paise integer not null,
  pay_mode text not null,
  notes text,
  -- Stamped when `customer_mobile` matched a canonical customer.
  linked_customer_id uuid references public.customers(id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint captain_captures_pay_mode_chk check (pay_mode in ('cash', 'upi'))
);

alter table public.captain_captures enable row level security;

-- Today's-captures / captain-day reads hit this index (newest first per captain).
create index if not exists captain_captures_captain_captured_idx
  on public.captain_captures (captain_id, captured_at desc);

-- Cross-match / customer-history lookups by the captured mobile.
create index if not exists captain_captures_customer_mobile_idx
  on public.captain_captures (customer_mobile);

-- ---------------------------------------------------------------------------
-- captain_settlements — a captain's end-of-day cash-up. ONE row per captain per
-- day; a re-submit UPSERTs on (captain_id, settle_date). All money is paise.
-- ---------------------------------------------------------------------------
create table if not exists public.captain_settlements (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.captains(id) on delete cascade,
  settle_date date not null default current_date,
  expected_gmv_paise integer not null default 0,
  cash_expected_paise integer not null default 0,
  upi_expected_paise integer not null default 0,
  cash_counted_paise integer not null default 0,
  -- cash_counted - cash_expected (negative ⇒ short).
  variance_paise integer not null default 0,
  -- round(expected_gmv * commission_percent / 100), integer paise.
  commission_paise integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint captain_settlements_captain_date_uniq unique (captain_id, settle_date)
);

alter table public.captain_settlements enable row level security;

-- ---------------------------------------------------------------------------
-- captain_pickups — community pickups a captain advances due → collected →
-- handed_over during the day.
-- ---------------------------------------------------------------------------
create table if not exists public.captain_pickups (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.captains(id) on delete cascade,
  community text not null,
  address text,
  status text not null default 'due',
  due_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint captain_pickups_status_chk
    check (status in ('due', 'collected', 'handed_over'))
);

alter table public.captain_pickups enable row level security;

drop trigger if exists captain_pickups_set_updated_at on public.captain_pickups;
create trigger captain_pickups_set_updated_at
  before update on public.captain_pickups
  for each row execute function public.set_updated_at();

create index if not exists captain_pickups_captain_status_idx
  on public.captain_pickups (captain_id, status);

-- ---------------------------------------------------------------------------
-- Seed one INACTIVE example captain so the admin roster and the resolver have a
-- real row to work with without granting anyone sign-in access. A super-admin
-- flips `active` on (or edits the number) to make it usable.
-- ---------------------------------------------------------------------------
insert into public.captains (name, phone, area, stall, active)
values ('Sneha Kumar', '9999900001', 'HYD · West', 'My Home Avatar gate', false)
on conflict (phone) do nothing;
