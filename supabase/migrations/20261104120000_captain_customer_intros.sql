-- Offline customers a captain introduces, registered by an operator.
--
-- A captain's stall sales already record the buyer's mobile. This adds the other
-- way a captain brings someone in: an operator registers the person in Super
-- Admin with the captain who introduced them. Conversion tracking then matches
-- both against online orders by mobile number, so the store can see which
-- captain's customers went on to buy online.
--
-- Kept apart from public.customers on purpose. A customer record created by an
-- operator would carry an unverified phone that sign-in and welcome coupons
-- would treat as the customer's own. This table only remembers who introduced
-- whom; the person becomes a customer when they sign in themselves.
--
-- One row per mobile: the first captain to introduce someone keeps the credit.
-- Additive and idempotent.

create table if not exists public.captain_customer_intros (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.captains(id) on delete cascade,
  -- Normalized 10-digit Indian mobile, the same form captain sales store.
  mobile text not null,
  name text,
  registered_by text,
  created_at timestamptz not null default now(),
  constraint captain_customer_intros_mobile_chk check (mobile ~ '^[6-9][0-9]{9}$')
);

create unique index if not exists captain_customer_intros_mobile_key
  on public.captain_customer_intros (mobile);

create index if not exists captain_customer_intros_captain_idx
  on public.captain_customer_intros (captain_id, created_at desc);

-- Service role only, like the other captain tables.
alter table public.captain_customer_intros enable row level security;
