-- Admin auth hardening (Milestone 2):
--   1. token_version columns on admins + users — a monotonic revocation counter
--      embedded in the signed session token; bumping it invalidates every
--      existing token for that principal ("log out everywhere" / password change).
--   2. admin_login_attempts — persisted failed-attempt counters + lockout windows,
--      keyed by `email:<addr>`, `ip:<addr>`, or `totp:<addr>`, so brute-force is
--      throttled across restarts.
--
-- Additive + idempotent. New table: RLS ENABLED with NO policies (service-role
-- only). Column adds default to 0 / null so existing rows and v0 tokens stay valid.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revocation counters. Default 0 so pre-existing sessions (token_version absent =
-- v0) validate against 0 and keep working until the counter is first bumped.
alter table if exists public.admins
  add column if not exists token_version integer not null default 0;
alter table if exists public.users
  add column if not exists token_version integer not null default 0;

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null unique,
  fail_count integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_locked_idx
  on public.admin_login_attempts (locked_until);

-- Service-role only: RLS on, deliberately NO policies.
alter table public.admin_login_attempts enable row level security;

drop trigger if exists admin_login_attempts_set_updated_at on public.admin_login_attempts;
create trigger admin_login_attempts_set_updated_at
  before update on public.admin_login_attempts
  for each row execute function public.set_updated_at();
