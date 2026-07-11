-- Promotions — occasion / seasonal discount engine.
--
-- ADDITIVE + IDEMPOTENT. Introduces a single server-owned table that drives the
-- storefront's festival / seasonal sale banners AND the price shoppers pay:
--   * public.promotions — one row per campaign. `banner_key` selects one of the
--                         nine ready-made banner backgrounds shipped under
--                         /images/banners/sale-<key>.webp. `discount_percent`
--                         (1..90) is the headline markdown. `scope` targets the
--                         whole catalogue ('all'), a set of category slugs / tags
--                         ('category'), or a set of product slugs ('product') via
--                         `scope_values`. `starts_at`/`ends_at` bound the run
--                         (NULL = open-ended on that side); `active` is the manual
--                         kill-switch; `priority` breaks ties when several are
--                         live (highest wins the hero slot). `auto_month` lets a
--                         reusable "{month} Sale" row re-title itself each month.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Money is never stored here — the percentage is applied to the catalogue's
-- integer-paise prices at read time (storefront cards) and at order time
-- (server-recomputed line prices), so there is a single source of truth.
--
-- Access: service-role only, mirroring `public.coupons` / `public.orders` — RLS
-- is enabled with NO policies, so anon / authenticated browser roles get nothing
-- and only the server (service role, which bypasses RLS) can read/write. The
-- public storefront reads the live hero promotion through the unauthenticated
-- /api/promotions/active route; administration goes through the super-admin-gated
-- /api/admin/marketing/promotions routes.

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
-- promotions — the occasion / seasonal sale catalogue. Storefront cards and the
-- create-order path resolve the best applicable row and mark the price down;
-- the hero row feeds the sale banner.
-- ---------------------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Human-stable identifier for the campaign; unique so admin edits are safe.
  slug text not null unique,
  -- One of the nine shipped banner backgrounds (/images/banners/sale-<key>.webp).
  banner_key text not null,
  headline text not null,
  subcopy text,
  -- Whole-percent markdown, 1..90 (guards against 0% no-ops and >90% giveaways).
  discount_percent integer not null,
  -- Targeting: 'all' → whole catalogue; 'category' → any slug/tag in scope_values;
  -- 'product' → any product slug in scope_values.
  scope text not null default 'all',
  scope_values text[] not null default '{}',
  -- Validity window; a NULL bound is open-ended on that side.
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  cta_label text not null default 'Shop the sale',
  cta_href text not null default '/shop',
  -- When true, a reusable row re-titles itself with the current month name.
  auto_month boolean not null default false,
  -- Highest priority wins the single hero slot when several promotions are live.
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_banner_key_chk check (
    banner_key in (
      'ganesh-chaturthi', 'diwali', 'ugadi', 'sankranti', 'dussehra',
      'summer-end', 'winter-end', 'end-of-season', 'end-of-month'
    )
  ),
  constraint promotions_discount_percent_chk
    check (discount_percent between 1 and 90),
  constraint promotions_scope_chk check (scope in ('all', 'category', 'product'))
);

alter table public.promotions enable row level security;

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

-- The active-promotion resolver reads live rows highest-priority first.
create index if not exists promotions_active_priority_idx
  on public.promotions (active, priority desc, created_at);

-- ---------------------------------------------------------------------------
-- Seed one INACTIVE example so the admin UI and the resolver have a real row to
-- work with without touching live pricing: Diwali Dhamaka — 15% off the whole
-- catalogue, inactive until a super-admin switches it on.
-- ---------------------------------------------------------------------------
insert into public.promotions
  (title, slug, banner_key, headline, subcopy, discount_percent, scope, active)
values
  (
    'Diwali Dhamaka', 'diwali-dhamaka', 'diwali', 'Diwali Dhamaka',
    'Festival of lights, festival of savings across every shelf.', 15, 'all', false
  )
on conflict (slug) do nothing;
