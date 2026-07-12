-- Announcements — the storefront top-marquee evergreen lines.
--
-- ADDITIVE + IDEMPOTENT. Moves the always-on marquee notices (free shipping /
-- new arrivals / membership) off a hardcoded array in the PromoBar and into a
-- single server-owned table so an operator can edit them from the Marketing
-- desk without a deploy:
--   * public.announcements — one row per evergreen line. `sort` orders the lines
--                            in the bar (ascending); `active` is the show/hide
--                            switch. Any LIVE promotion line is still prepended
--                            ahead of these by the PromoBar at render time.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Access: service-role only, mirroring `public.promotions` / `public.coupons` —
-- RLS is enabled with NO policies, so anon / authenticated browser roles get
-- nothing and only the server (service role, which bypasses RLS) can read/write.
-- The public storefront reads the active lines through the unauthenticated
-- /api/announcements route; administration goes through the super-admin-gated
-- /api/admin/marketing/announcements routes.

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
-- announcements — the evergreen marquee lines. The PromoBar fetches the active
-- rows (in `sort` order) and renders them after any live promotion line.
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- The storefront reads active lines in display order; the admin lists all in the
-- same order. A single composite index serves both.
create index if not exists announcements_active_sort_idx
  on public.announcements (active, sort);

-- ---------------------------------------------------------------------------
-- Seed the three lines the storefront already scrolls (previously hardcoded in
-- the PromoBar) so the marquee keeps working against real data. Seeded ONLY when
-- the table is empty, so re-running never duplicates rows or resurrects lines an
-- operator has since removed.
-- ---------------------------------------------------------------------------
insert into public.announcements (text, sort, active)
select v.line, v.ord, true
from (
  values
    ('Free shipping on orders over ₹599 · Across India', 0),
    ('New arrivals · Anantapur cold-pressed groundnut oil — now in 1L glass', 1),
    ('Members get 5% back on every order · Join free', 2)
) as v(line, ord)
where not exists (select 1 from public.announcements);
