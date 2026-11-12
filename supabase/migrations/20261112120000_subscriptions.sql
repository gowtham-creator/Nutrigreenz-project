-- Subscriptions: recurring deliveries the customer sets up once.
--
-- ADDITIVE + IDEMPOTENT. Three tables plus one nullable column on orders.
--
--   * public.subscriptions            one row per customer subscription: what
--                                     cadence, where, which slot, how it is paid,
--                                     and the date of the next delivery.
--   * public.subscription_items       the products on it (variant + qty). Prices are
--                                     NOT stored: every delivery is priced from the
--                                     live catalogue when its order is created.
--   * public.subscription_deliveries  one row per scheduled date. A delivery is
--                                     'due' until an order exists for it, then
--                                     'ordered'. 'skipped' is the customer's choice,
--                                     'missed' means a pay-online delivery was never
--                                     paid before its date.
--
-- Payment is per delivery, never autopay (terms §subscriptions). Cash on delivery
-- subscriptions get their order created by the daily cron. Pay-online deliveries
-- get a reminder, and the order is created when the customer pays, through the
-- same createOrder + SBIePay path checkout uses, so stock is held only for a
-- delivery someone is actually paying for.
--
-- Access: service role only, like orders/addresses. RLS on, no policies.

create extension if not exists pgcrypto;

-- Identical to every earlier copy, including the pinned search_path, so
-- re-declaring it changes nothing on a database that already has it.
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

/* ── subscriptions ─────────────────────────────────────────────────────── */

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'active',
  frequency_days integer not null,
  next_delivery_on date not null,
  paused_until date,
  payment_method text not null default 'upi',
  address_snapshot jsonb not null,
  slot_id uuid,
  slot_snapshot jsonb,
  discount_bps integer not null default 800,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_chk check (status in ('active', 'paused', 'cancelled')),
  constraint subscriptions_frequency_chk check (frequency_days in (7, 14, 30)),
  constraint subscriptions_payment_chk check (payment_method in ('upi', 'cod')),
  constraint subscriptions_discount_chk check (discount_bps between 0 and 5000)
);

create index if not exists subscriptions_customer_idx on public.subscriptions (customer_id);
create index if not exists subscriptions_due_idx on public.subscriptions (status, next_delivery_on);

alter table public.subscriptions enable row level security;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

/* ── subscription_items ───────────────────────────────────────────────── */

create table if not exists public.subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  variant_sku text,
  title text not null,
  qty integer not null,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_items_qty_chk check (qty between 1 and 20)
);

create index if not exists subscription_items_sub_idx on public.subscription_items (subscription_id);

alter table public.subscription_items enable row level security;

/* ── subscription_deliveries ──────────────────────────────────────────── */

create table if not exists public.subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  scheduled_on date not null,
  status text not null default 'due',
  order_id uuid references public.orders (id) on delete set null,
  note text,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_deliveries_status_chk
    check (status in ('due', 'processing', 'ordered', 'skipped', 'missed', 'failed')),
  constraint subscription_deliveries_unique unique (subscription_id, scheduled_on)
);

create index if not exists subscription_deliveries_status_idx
  on public.subscription_deliveries (status, scheduled_on);

alter table public.subscription_deliveries enable row level security;

drop trigger if exists subscription_deliveries_set_updated_at on public.subscription_deliveries;
create trigger subscription_deliveries_set_updated_at
  before update on public.subscription_deliveries
  for each row execute function public.set_updated_at();

/* ── orders: which subscription an order delivers ─────────────────────── */

alter table public.orders
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

create index if not exists orders_subscription_idx on public.orders (subscription_id)
  where subscription_id is not null;
