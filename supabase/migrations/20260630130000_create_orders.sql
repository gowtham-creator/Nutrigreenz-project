-- Persistent Orders — Phase C (ORDERS backend).
--
-- ADDITIVE + IDEMPOTENT. Introduces the persistent order model that replaces the
-- client-only sessionStorage "receipt": a real order is written at checkout and
-- read back by both the customer (order history) and the admin Orders Portal.
--   * public.orders              — one row per placed order. All money is integer
--                                  paise (₹1 = 100 paise). Linked to the CANONICAL
--                                  `public.customers` row (nullable for guest /
--                                  pre-dedup checkouts) plus an email/phone
--                                  snapshot so an order is always attributable.
--   * public.order_items         — the line items (product + variant snapshot).
--   * public.order_status_events — an append-only audit trail of every status
--                                  transition (who moved it, when, and an optional
--                                  note), powering the admin activity timeline.
--
-- It does NOT drop or alter any existing table and is safe to run repeatedly.
--
-- No-cancellation policy (§3.9): the order status set is forward-only —
-- placed → confirmed → packed → shipped → delivered. There is deliberately NO
-- "cancelled" / "refunded" status; the lifecycle never moves backward.
--
-- Payment is decoupled from fulfilment: `payment_status` (pending | paid |
-- failed) tracks the gateway independently. Orders are created `pending` and the
-- payment seam (src/lib/payments-razorpay.ts) flips it to `paid` only when a real
-- gateway verification lands — we never fabricate a paid state.
--
-- Access: service-role only, mirroring `public.customers` / `public.addresses` /
-- `public.commerce_rules` — RLS is enabled with NO policies, so anon /
-- authenticated browser roles get nothing and only the server (service role,
-- which bypasses RLS) can read/write. Every customer-facing API call scopes to
-- the signed-in customer's own `customer_id`; admin reads go through the
-- admin-gated routes.

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
-- orders — one row per placed order. Money is integer paise throughout.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Human-facing order number, e.g. "NG-26-1042" (NG-YY-XXXX). Server-generated
  -- and unique; this is what the customer and admin see and search by.
  order_number text not null unique,
  -- Canonical customer linkage. Nullable so a guest / pre-dedup checkout still
  -- persists; ON DELETE SET NULL keeps the order as an audit record if the
  -- canonical customer is ever removed. The email/phone snapshot below means an
  -- order is always attributable even without the FK.
  customer_id uuid references public.customers (id) on delete set null,
  user_email text,
  user_phone text,
  -- Fulfilment lifecycle — forward-only, NO cancelled/refunded (§3.9).
  status text not null default 'placed',
  -- Payment lifecycle — decoupled from fulfilment.
  payment_status text not null default 'pending',
  payment_provider text not null default 'razorpay',
  payment_ref text,
  -- Server-recomputed totals (never trust the client). All integer paise.
  subtotal_paise integer not null default 0,
  discount_paise integer not null default 0,
  shipping_paise integer not null default 0,
  tax_paise integer not null default 0,
  total_paise integer not null default 0,
  coupon_code text,
  loyalty_redeemed_paise integer not null default 0,
  currency text not null default 'INR',
  -- Snapshots taken at place-order time (immutable record of what was agreed).
  address_snapshot jsonb,
  slot_snapshot jsonb,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_chk
    check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered')),
  constraint orders_payment_status_chk
    check (payment_status in ('pending', 'paid', 'failed'))
);

alter table public.orders enable row level security;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Customer order history is scoped + sorted by (customer, newest-first).
create index if not exists orders_customer_id_idx
  on public.orders (customer_id);
create index if not exists orders_placed_at_idx
  on public.orders (placed_at desc);
-- Admin Orders Portal filters by fulfilment + payment status.
create index if not exists orders_status_idx
  on public.orders (status);
create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

-- ---------------------------------------------------------------------------
-- order_items — the line items of an order. Product/variant are referenced for
-- traceability but the title/sku/price are SNAPSHOT at order time so the line
-- never changes when the catalog later does.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Soft references: keep the order line even if the product/variant is removed.
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  variant_sku text,
  title text not null,
  qty integer not null default 1,
  unit_price_paise integer not null default 0,
  line_total_paise integer not null default 0,
  -- Full line snapshot (unit label, image, lot, subscribe flag, etc.).
  snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id);
create index if not exists order_items_variant_id_idx
  on public.order_items (variant_id);

-- ---------------------------------------------------------------------------
-- order_status_events — append-only audit of every status transition. The first
-- row (status = 'placed', by = 'system') is written when the order is created;
-- each admin advance appends another. Powers the operator activity timeline.
-- ---------------------------------------------------------------------------
create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  at timestamptz not null default now(),
  -- Actor: an admin email, or 'system' for automated transitions.
  by text not null default 'system',
  constraint order_status_events_status_chk
    check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered'))
);

alter table public.order_status_events enable row level security;

create index if not exists order_status_events_order_id_idx
  on public.order_status_events (order_id, at);
