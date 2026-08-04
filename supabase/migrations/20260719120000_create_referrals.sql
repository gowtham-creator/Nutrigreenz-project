-- Referral engine (Milestone 2).
--
-- Additive + idempotent. Introduces per-customer referral codes and an
-- attribution ledger that the storefront + order path drive:
--   * customers.referral_code   — a stable, unique share code minted on demand.
--   * customers.referred_by_code — the code a referee signed up with (audit).
--   * public.referral_attributions — ONE row per referee (unique). Starts
--     'pending' at signup; flips to 'rewarded' when the referee's first
--     qualifying order confirms (referrer credited loyalty points, referee
--     credited store-credit points worth the configured discount); 'void' if a
--     rewarded order is later refunded/cancelled. All economics come from the
--     singleton public.referral_config (referrer_points, referee_discount_paise,
--     min_qualifying_order_paise, max_per_month, expiry_days, anti-abuse flags).
--
-- Money is INTEGER PAISE. Access: service-role only — RLS ENABLED with NO
-- policies, so only the Node route handlers (service key) read/write. It does
-- NOT drop or alter any existing table destructively and is safe to re-run.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Per-customer share code + the code a referee arrived with. NULLs allowed
-- (unique permits many NULLs), so existing customers are untouched until they
-- first request their code.
alter table if exists public.customers
  add column if not exists referral_code text unique;
alter table if exists public.customers
  add column if not exists referred_by_code text;

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references public.customers (id) on delete cascade,
  -- One attribution per referee — the unique gate that blocks double-claims.
  referee_customer_id uuid not null unique references public.customers (id) on delete cascade,
  referee_code_used text,
  status text not null default 'pending'
    check (status in ('pending', 'rewarded', 'void')),
  qualifying_order_id uuid references public.orders (id) on delete set null,
  referrer_points_awarded integer not null default 0,
  referee_discount_paise_awarded integer not null default 0,
  -- Anti-abuse signals captured at signup.
  signup_ip text,
  signup_device_hash text,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists referral_attributions_referrer_idx
  on public.referral_attributions (referrer_customer_id);
create index if not exists referral_attributions_status_idx
  on public.referral_attributions (status);

alter table public.referral_attributions enable row level security;

drop trigger if exists referral_attributions_set_updated_at on public.referral_attributions;
create trigger referral_attributions_set_updated_at
  before update on public.referral_attributions
  for each row execute function public.set_updated_at();
