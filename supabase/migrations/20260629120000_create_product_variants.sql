-- Product variants (size × pack) — Catalog Milestone, Task: variant model.
--
-- ADDITIVE + IDEMPOTENT. Introduces `public.product_variants`, where a single
-- base `public.products` row fans out into purchasable SKUs that differ by size
-- (1L / 500g / 10kg …) and pack (glass / plastic / tin / bag). Going forward the
-- sellable PRICE and STOCK live on the variant; `products` stays the base
-- (name / slug / category / description / image / status). It does NOT drop or
-- alter `products` or `inventory`, and is safe to run repeatedly.
--
-- Access: service-role only, mirroring `public.products` / `public.inventory` —
-- RLS is enabled with NO policies, so anon / authenticated browser roles get
-- nothing and only the server (service role, which bypasses RLS) can read/write.

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
-- Variants — one base product → many size×pack SKUs.
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null,                 -- "1L", "500g", "10kg"
  pack text,                           -- glass | plastic | tin | bag | null
  size_value numeric,                  -- 1, 500, 10 …
  size_unit text,                      -- "L", "ml", "g", "kg"
  price_paise integer not null default 0,
  sku text unique,
  stock integer not null default 0,
  reserved integer not null default 0,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_variants enable row level security;

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Primary lookup: variants are almost always read by their owning product.
create index if not exists product_variants_product_id_idx
  on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- Migrate the existing base products → one "Standard" variant each.
-- Non-destructive: `products` + `inventory` are left exactly as-is; we only
-- copy the current price (from products) and stock/reserved (from inventory)
-- onto a single variant so the live shop keeps the same price & availability.
-- Guarded by `not exists`, so re-running (or running after later seeds) never
-- double-creates a Standard variant.
-- ---------------------------------------------------------------------------
insert into public.product_variants
  (product_id, label, pack, size_value, size_unit, price_paise, sku, stock, reserved, is_active, sort)
select
  p.id,
  'Standard',
  null,
  null,
  null,
  p.price_paise,
  p.sku,
  coalesce(i.stock, 0),
  coalesce(i.reserved, 0),
  true,
  0
from public.products p
left join public.inventory i on i.product_id = p.id
where not exists (
  select 1 from public.product_variants v where v.product_id = p.id
);
