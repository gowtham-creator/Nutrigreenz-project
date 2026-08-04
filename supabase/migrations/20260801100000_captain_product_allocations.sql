-- Which products a captain may sell at their stall.
--
-- The captain app shipped with a hardcoded six-item list (STALL_CATALOG) whose
-- SKUs, products and prices matched NOTHING in the catalogue: two of the
-- products did not exist at all, and the prices were invented. A captain taking
-- cash against those lines was recording revenue the business could not tie to
-- a real SKU, and the sale could never reconcile against stock.
--
-- Allocation is per VARIANT, not per product, because that is what carries the
-- price and the stock. An empty allocation means the captain sells nothing —
-- deliberately fail-closed, so a newly created captain cannot sell until an
-- operator has decided what they may carry.
create table if not exists public.captain_allocations (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.captains(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price_paise integer check (price_paise is null or price_paise >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (captain_id, variant_id)
);

-- Reached only through the service-role client, which bypasses RLS. Enabling
-- RLS with NO policy is therefore the correct lock: the app is unaffected and
-- anonymous access is refused. This was missing when the table was first
-- created, which left it readable and DELETABLE by anyone holding the anon key
-- — and that key ships in the browser.
alter table public.captain_allocations enable row level security;
revoke all on public.captain_allocations from anon, authenticated;

create index if not exists captain_allocations_captain_idx
  on public.captain_allocations (captain_id) where active;

comment on table public.captain_allocations is
  'Products a captain may sell at their stall. Empty = sells nothing (fail-closed). Replaces the hardcoded STALL_CATALOG, whose SKUs matched no real product.';
comment on column public.captain_allocations.price_paise is
  'Optional stall price override in paise. NULL means use the variant price from the catalogue.';
