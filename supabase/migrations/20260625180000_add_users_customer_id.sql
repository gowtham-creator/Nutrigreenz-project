-- Customer Identity & De-duplication — Milestone 2, Task T2 (backlink).
--
-- ADDITIVE + IDEMPOTENT. Adds a nullable `customer_id` backlink from the live
-- `public.users` table to the canonical `public.customers` model introduced in
-- T1. It does NOT modify or delete any existing data, does NOT change any
-- sign-in behaviour, and does NOT add any NOT NULL / DEFAULT that would rewrite
-- existing rows — every current `users` row simply keeps `customer_id = NULL`
-- until the next sign-in best-effort backfills it. Safe to run repeatedly.
--
-- ON DELETE SET NULL: deleting a canonical customer must never cascade-delete a
-- live user row; it just clears the (best-effort) backlink.

alter table public.users
  add column if not exists customer_id uuid
  references public.customers (id) on delete set null;

-- Lookup helper for "which user(s) point at this customer" (admin/merge views).
create index if not exists users_customer_id_idx
  on public.users (customer_id);
