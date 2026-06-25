-- Customer Identity & De-duplication — Milestone 2, Task T1 (foundation).
--
-- ADDITIVE + IDEMPOTENT. Introduces the canonical customer model that later
-- tasks (T2 phone sign-in, T3 Google merge, T4 address book, T5 admin views)
-- build on. It does NOT touch the live `public.users` table, does NOT modify or
-- delete any existing data, and does NOT change any sign-in behaviour. Safe to
-- run repeatedly.
--
-- Model: one canonical `customers` row <-> many `customer_identities` (one per
-- auth provider). The dedup key is a normalized E.164 mobile; email is a
-- secondary key. Both canonical uniqueness constraints are PARTIAL (only over
-- non-null values) so multiple phone-less / email-less customers can coexist.
--
-- Access: service-role only, mirroring `public.admins` and `public.users` —
-- RLS is enabled with NO policies, so anon/authenticated browser roles get
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
-- Canonical customer (one record per real person).
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  primary_email text,
  primary_phone text, -- normalized E.164 (e.g. +9198...), nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Dedup keys: partial UNIQUE so only populated values must be unique. Safe on a
-- brand-new empty table; lets phone-only or email-only customers coexist freely.
create unique index if not exists customers_primary_phone_key
  on public.customers (primary_phone)
  where primary_phone is not null;

create unique index if not exists customers_primary_email_key
  on public.customers (primary_email)
  where primary_email is not null;

-- ---------------------------------------------------------------------------
-- Provider identities attached to a canonical customer.
-- ---------------------------------------------------------------------------
create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  provider text not null check (provider in ('google', 'phone')),
  provider_uid text,
  email text,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_uid)
);

alter table public.customer_identities enable row level security;

-- Lookup helpers for the resolver (find-by-customer, find-by-contact).
create index if not exists customer_identities_customer_id_idx
  on public.customer_identities (customer_id);
create index if not exists customer_identities_phone_idx
  on public.customer_identities (phone);
create index if not exists customer_identities_email_idx
  on public.customer_identities (email);
