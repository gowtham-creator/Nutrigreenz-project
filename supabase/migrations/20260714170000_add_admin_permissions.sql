-- Per-admin portal section/feature permissions.
--
-- A super admin decides, per admin, exactly which portal sections that admin
-- may open. The grant is stored as an array of permission keys (the catalogue
-- lives in `src/lib/admin-permissions.ts`).
--
-- NULL or an EMPTY array means "use the default admin set", so every EXISTING
-- admin keeps working with no lockout and no backfill required. Super admins
-- are unaffected: they always hold every permission, enforced in application
-- code and never read from this column.
alter table public.admins
  add column if not exists permissions text[];

comment on column public.admins.permissions is
  'Granted admin portal section keys (see src/lib/admin-permissions.ts). NULL/empty = default admin set. Ignored for superadmins, who always have full access.';
