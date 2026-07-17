-- Admin password-reset tokens — single-use, expiring reset links for /admin/forgot.
--
-- Additive + idempotent. Service-role only: RLS is ENABLED with NO policies, so
-- only the Node route handlers (running with the service key) ever read/write it.
-- A row is created when an operator requests a reset; consuming a link stamps
-- `used_at` atomically so a given `jti` works exactly once.

-- Shared updated_at trigger (create-or-replace so re-running is safe).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  jti text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_password_resets_email_idx
  on public.admin_password_resets (email);
create index if not exists admin_password_resets_expires_idx
  on public.admin_password_resets (expires_at);

-- Service-role only: RLS on, deliberately NO policies (nothing but the service
-- key may touch reset tokens).
alter table public.admin_password_resets enable row level security;

drop trigger if exists admin_password_resets_set_updated_at on public.admin_password_resets;
create trigger admin_password_resets_set_updated_at
  before update on public.admin_password_resets
  for each row execute function public.set_updated_at();
