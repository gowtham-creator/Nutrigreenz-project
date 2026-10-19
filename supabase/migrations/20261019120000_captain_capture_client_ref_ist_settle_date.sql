-- Captain module fixes. ADDITIVE + IDEMPOTENT, safe to run more than once.
--
-- 1. captain_captures.client_ref — the captain app's id for a sale (its offline
--    outbox temp id). The app retries a capture whose response was lost; without
--    a key the retry recorded the same sale twice. The partial unique index lets
--    the server return the stored row instead. The app code works before this
--    runs (it just cannot dedupe), so deploy order does not matter.
--
-- 2. captain_settlements.settle_date defaulted to current_date, which is the UTC
--    date on Supabase. Staff work in IST, so a row written without an explicit
--    date between 00:00 and 05:30 IST would land on the previous day. The app
--    always sends the IST date; this makes the default agree with it.

alter table public.captain_captures add column if not exists client_ref text;

create unique index if not exists captain_captures_captain_client_ref_uniq
  on public.captain_captures (captain_id, client_ref)
  where client_ref is not null;

alter table public.captain_settlements
  alter column settle_date set default ((now() at time zone 'Asia/Kolkata')::date);
