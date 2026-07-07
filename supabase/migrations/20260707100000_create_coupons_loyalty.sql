-- Coupons + Loyalty — Phase D (LOYALTY + COUPONS backend).
--
-- ADDITIVE + IDEMPOTENT. Moves coupons and loyalty points from the client-side
-- demo catalogue (src/components/ng/data.ts) to server-owned tables so the
-- create-order path can validate and record rewards authoritatively instead of
-- trusting client-asserted discount amounts:
--   * public.coupons        — the coupon catalogue. `kind` is 'percent' (value =
--                             whole percent, e.g. 10 = 10%) or 'flat' (value =
--                             integer paise). `cap_paise` bounds a percent
--                             discount; `usage_limit` bounds total redemptions;
--                             `per_customer_limit` bounds redemptions per
--                             customer (NULL = unlimited, default single-use).
--   * public.coupon_uses    — one row per redemption (which customer used which
--                             coupon on which order). Backs `per_customer_limit`
--                             enforcement and keeps `used_count` honest.
--   * public.loyalty_ledger — append-only points ledger per CANONICAL customer.
--                             Earn rows are positive, redemptions negative; the
--                             balance is always SUM(delta_points), never a
--                             mutable counter.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Money is integer paise (₹1 = 100 paise); loyalty amounts are whole points.
--
-- Access: service-role only, mirroring `public.orders` / `public.commerce_rules`
-- — RLS is enabled with NO policies, so anon / authenticated browser roles get
-- nothing and only the server (service role, which bypasses RLS) can read/write.
-- Customer-facing reads are scoped to the signed-in customer's own
-- `customer_id`; coupon administration goes through the super-admin-gated
-- /api/admin/marketing routes.

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
-- coupons — the server-owned coupon catalogue. Checkout and the create-order
-- path validate against these rows; the old client-side list becomes display
-- data only.
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Stored UPPERCASE; lookups normalise the requested code before matching.
  code text not null unique,
  kind text not null default 'flat',
  -- 'percent' → whole percent (10 = 10%); 'flat' → discount in integer paise.
  value integer not null default 0,
  min_order_paise integer not null default 0,
  -- Max discount in paise for a percent coupon; NULL = uncapped.
  cap_paise integer,
  active boolean not null default true,
  -- Validity window; a NULL bound is open-ended on that side.
  starts_at timestamptz,
  ends_at timestamptz,
  -- Total redemptions allowed across all customers; NULL = unlimited.
  usage_limit integer,
  -- Redemptions allowed per customer; NULL = unlimited. Defaults to single-use.
  per_customer_limit integer default 1,
  -- Denormalised redemption counter, kept in step with coupon_uses.
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_kind_chk check (kind in ('percent', 'flat'))
);

alter table public.coupons enable row level security;

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- The admin coupon list filters on live vs retired campaigns.
create index if not exists coupons_active_idx
  on public.coupons (active);

-- ---------------------------------------------------------------------------
-- coupon_uses — one append-only row per successful redemption. This is the
-- source of truth for per-customer limits; `coupons.used_count` is derived.
-- ---------------------------------------------------------------------------
create table if not exists public.coupon_uses (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- Soft reference: keep the redemption record even if the order is removed.
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.coupon_uses enable row level security;

-- Per-customer usage counts (enforces per_customer_limit at validation time).
create index if not exists coupon_uses_coupon_customer_idx
  on public.coupon_uses (coupon_id, customer_id);
create index if not exists coupon_uses_order_id_idx
  on public.coupon_uses (order_id);

-- ---------------------------------------------------------------------------
-- loyalty_ledger — append-only points ledger. Earn rows (order_earn) are
-- positive, redemptions (order_redeem) negative, manual corrections use
-- 'adjust'. The balance is SUM(delta_points) per customer — no running-balance
-- column to drift out of sync.
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- Soft reference: keep the ledger history even if the order is removed.
  order_id uuid references public.orders (id) on delete set null,
  delta_points integer not null default 0,
  reason text not null default 'adjust',
  created_at timestamptz not null default now(),
  constraint loyalty_ledger_reason_chk
    check (reason in ('order_earn', 'order_redeem', 'adjust'))
);

alter table public.loyalty_ledger enable row level security;

-- Balance + recent-activity reads are scoped by (customer, newest-first).
create index if not exists loyalty_ledger_customer_id_idx
  on public.loyalty_ledger (customer_id, created_at desc);
create index if not exists loyalty_ledger_order_id_idx
  on public.loyalty_ledger (order_id);

-- ---------------------------------------------------------------------------
-- Seed the coupon the storefront already advertises (PDP best-price strip +
-- checkout placeholder) so the existing UI keeps working against real data:
-- HARVEST10 — 10% off up to ₹150 (15000 paise) on orders above ₹599, active,
-- reusable per customer (NULL per_customer_limit mirrors the demo behaviour).
-- ---------------------------------------------------------------------------
insert into public.coupons
  (code, kind, value, min_order_paise, cap_paise, active, per_customer_limit)
values
  ('HARVEST10', 'percent', 10, 59900, 15000, true, null)
on conflict (code) do nothing;
