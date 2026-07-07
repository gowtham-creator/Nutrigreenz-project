-- Wishlists — Slice 2 (Reporting / wishlists / bundles aggregation).
--
-- ADDITIVE + IDEMPOTENT. Promotes the wishlist from a per-browser localStorage
-- store (src/lib/wishlist.tsx) to a real, server-owned table so a signed-in
-- customer's saved products are durable across devices AND so the admin can
-- aggregate demand (top saved products + saver counts) over real rows instead
-- of mock data:
--   * public.wishlists — one row per (customer, product) save. `product_slug`
--                        is the storefront catalogue slug (public.products.slug);
--                        the pair is UNIQUE so a product is saved at most once
--                        per customer (a toggle re-add is a no-op / re-insert).
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- Access: service-role only, mirroring public.orders / public.customers — RLS is
-- enabled with NO policies, so anon / authenticated browser roles get nothing and
-- only the server (service role, which bypasses RLS) can read/write. Customer
-- reads/writes are scoped to the signed-in customer's own `customer_id` via the
-- /api/account/wishlist route; aggregation goes through the admin-gated
-- /api/admin/wishlists route.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- wishlists — one row per saved product, attached to the CANONICAL customer.
-- ---------------------------------------------------------------------------
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  -- Canonical customer linkage; ON DELETE CASCADE clears a customer's saves when
  -- the customer is removed. Wishlists are always customer-scoped (no guest rows).
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- The storefront catalogue slug (public.products.slug). Stored as text (a soft
  -- reference) so a save survives a catalogue row being renamed/removed and the
  -- aggregation can still count demand by slug.
  product_slug text not null,
  created_at timestamptz not null default now(),
  -- A product is saved at most once per customer; a re-save is idempotent.
  unique (customer_id, product_slug)
);

alter table public.wishlists enable row level security;

-- Customer's own list is scoped + sorted by (customer, newest-saved-first).
create index if not exists wishlists_customer_id_idx
  on public.wishlists (customer_id, created_at desc);
-- The admin aggregation groups by product to rank top saved products.
create index if not exists wishlists_product_slug_idx
  on public.wishlists (product_slug);
