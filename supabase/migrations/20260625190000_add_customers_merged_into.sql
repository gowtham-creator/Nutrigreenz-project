-- Customer Identity & De-duplication — Milestone 2, Task T3 (merge audit link).
--
-- ADDITIVE + IDEMPOTENT. Adds a nullable self-FK `merged_into` to
-- `public.customers`. When two canonical customers turn out to be the same
-- person (a Google customer OTP-proves ownership of a phone that already belongs
-- to a phone-keyed customer), the loser row is RELINKED into the survivor and
-- stamped with `merged_into = <survivor id>`. The loser row is NEVER deleted —
-- it is kept as an audit breadcrumb and as a forwarding pointer, so the merge is
-- fully reversible and traceable.
--
-- It does NOT modify or delete any existing data, does NOT add any NOT NULL /
-- DEFAULT that would rewrite existing rows, and does NOT change any sign-in
-- behaviour. Safe to run repeatedly.
--
-- ON DELETE SET NULL: should a survivor ever be removed, a merged loser simply
-- loses its forwarding pointer rather than cascade-deleting.

alter table public.customers
  add column if not exists merged_into uuid
  references public.customers (id) on delete set null;

-- Lookup helper for "which rows were merged into this survivor" (admin/audit).
create index if not exists customers_merged_into_idx
  on public.customers (merged_into)
  where merged_into is not null;
