-- Per-admin authenticator (TOTP) enrollment: each admin gets their OWN secret
-- (scanned into Google/Microsoft Authenticator) instead of one shared env secret,
-- plus a snooze timestamp for the post-login "set up an authenticator" prompt.
alter table public.admin_security
  add column if not exists totp_secret text,
  add column if not exists totp_prompt_snooze_until timestamptz;

comment on column public.admin_security.totp_secret is
  'Per-admin base32 TOTP secret for their own authenticator app. Service-role only (no RLS policies on this table); may be encrypted-at-rest later.';
comment on column public.admin_security.totp_prompt_snooze_until is
  'When the post-login "set up an authenticator" prompt should next appear (Skip=+7d, Remind later=+2d).';
