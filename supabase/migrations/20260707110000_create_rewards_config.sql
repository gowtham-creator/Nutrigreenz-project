-- Rewards & config persistence — Slice 1 (LOYALTY / REFERRAL / FEATURE-FLAG config).
--
-- ADDITIVE + IDEMPOTENT. Moves three admin-editable config surfaces off the
-- per-browser localStorage / React-state demos and onto server-owned tables so
-- the checkout points engine, the referral engine and the storefront can read a
-- single authoritative source instead of trusting the client:
--   * public.loyalty_config   — a SINGLETON row (id = 1) holding the loyalty
--                               programme economics: earn / redeem rates, the
--                               min-redeem floor, the max-redeem % cap, points
--                               expiry and the earn on/off switch. `rewards.ts`
--                               reads this in place of its hardcoded constants.
--   * public.referral_config  — a SINGLETON row (id = 1) mirroring the Super
--                               Admin referral form: reward values, the
--                               confirmed-order qualifier, monthly cap, reward
--                               expiry and the three anti-abuse guards. Money is
--                               integer paise; `referrer_points` is whole points.
--   * public.feature_flags    — one row per storefront capability toggle
--                               (key text PK). The storefront reads these to
--                               gate Subscriptions / Referrals / Community
--                               bundles / Captain network.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Money is integer paise (₹1 = 100 paise); loyalty amounts are whole points.
--
-- Access: service-role only, mirroring `public.commerce_rules` / `public.orders`
-- — RLS is enabled with NO policies, so anon / authenticated browser roles get
-- nothing and only the server (service role, which bypasses RLS) can read/write.
-- Admin edits go through the super-admin-gated /api/admin/config routes; the
-- storefront reads the public /api/loyalty-config and /api/feature-flags routes.

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
-- loyalty_config — SINGLETON. The whole table is one row (id = 1); a check
-- constraint forbids any other id so there can only ever be one config. The
-- column defaults ARE the shipped defaults (mirror LOYALTY_CONFIG in
-- src/lib/loyalty-config), so seeding the row leaves behaviour unchanged.
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_config (
  id integer primary key default 1,
  -- Points credited per ₹1 of the payable order total.
  earn_points_per_rupee integer not null default 1,
  -- Points needed to redeem ₹1 off (10 points = ₹1).
  redeem_points_per_rupee integer not null default 10,
  -- Floor: a redemption needs at least this many points banked.
  min_redeem_points integer not null default 100,
  -- Cap: a redemption may cover at most this % of the order subtotal.
  max_redeem_percent integer not null default 20,
  -- Months until earned points expire (from last activity).
  expiry_months integer not null default 12,
  -- Master switch for points accrual on orders.
  earn_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint loyalty_config_singleton check (id = 1)
);

alter table public.loyalty_config enable row level security;

drop trigger if exists loyalty_config_set_updated_at on public.loyalty_config;
create trigger loyalty_config_set_updated_at
  before update on public.loyalty_config
  for each row execute function public.set_updated_at();

-- Seed the one and only config row (defaults supply every value).
insert into public.loyalty_config (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- referral_config — SINGLETON. Mirrors the Super Admin referral form's draft
-- fields. Column defaults match the form's DEFAULTS (referral-config.tsx) so
-- seeding the row leaves the programme configured exactly as advertised today.
-- Money fields are integer paise; `referrer_points` is whole loyalty points.
-- ---------------------------------------------------------------------------
create table if not exists public.referral_config (
  id integer primary key default 1,
  -- Loyalty points credited to the referrer after the referee's confirmed order.
  referrer_points integer not null default 200,
  -- ₹ off the referee's first order, in integer paise (₹100 = 10000).
  referee_discount_paise integer not null default 10000,
  -- Subtotal the referee must place to qualify, in integer paise (₹499 = 49900).
  min_qualifying_order_paise integer not null default 49900,
  -- Cap on rewarded referrals per referrer per calendar month.
  max_per_month integer not null default 10,
  -- Referral link / reward validity window, in days.
  expiry_days integer not null default 30,
  -- Master switch for the whole referral programme.
  enabled boolean not null default true,
  -- Anti-abuse guards (§3.7).
  block_same_device boolean not null default true,
  dedupe_mobile boolean not null default true,
  block_address_cluster boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint referral_config_singleton check (id = 1)
);

alter table public.referral_config enable row level security;

drop trigger if exists referral_config_set_updated_at on public.referral_config;
create trigger referral_config_set_updated_at
  before update on public.referral_config
  for each row execute function public.set_updated_at();

-- Seed the one and only config row (defaults supply every value).
insert into public.referral_config (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- feature_flags — one row per storefront capability toggle, keyed by a stable
-- string. The storefront reads these to switch capabilities on/off platform-wide.
-- ---------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Seed the four shipped bundles with their current default states
-- (idempotent: guarded by key so re-runs never flip an operator's edits).
insert into public.feature_flags (key, enabled)
values
  ('subscriptions', true),
  ('referrals', true),
  ('community_bundles', true),
  ('captain_network', false)
on conflict (key) do nothing;
