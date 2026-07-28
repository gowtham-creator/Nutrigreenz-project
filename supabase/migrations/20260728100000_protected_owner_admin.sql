-- Protected (owner) admin
--
-- Marks an admin account as the OWNER: it keeps every super-admin power over
-- everyone else, but no other operator -- including another super-admin -- may
-- edit, demote, suspend, reset the password of, or delete it.
--
-- Deliberately NOT settable through any API surface. The flag is granted and
-- revoked here, at the database, so a compromised or malicious super-admin
-- session cannot strip another account's protection or self-promote into it.
--
-- Enforcement lives in src/app/api/admin/admins/[id]/route.ts (PATCH / POST /
-- DELETE), which refuses any mutation whose TARGET is protected unless the
-- actor is that same account.

alter table public.admins
  add column if not exists is_protected boolean not null default false;

comment on column public.admins.is_protected is
  'Owner account. Only the account itself may modify or delete it; every other operator, including other super-admins, is refused. Grant/revoke via SQL only -- never exposed through the admin API.';

-- Fast lookup for the guard and for the "is there an owner?" audit query.
create index if not exists admins_is_protected_idx
  on public.admins (is_protected) where is_protected;
