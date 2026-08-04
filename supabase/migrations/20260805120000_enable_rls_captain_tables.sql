-- SECURITY FIX: captain_allocations and captain_capture_lines were created
-- without Row Level Security.
--
-- Supabase flagged this as critical, and it is: with RLS off, PostgREST exposes
-- the table to the anon key, which ships in the browser on every page load.
-- Anyone with the project URL could read, modify or delete every row.
--
-- What was exposed:
--   captain_allocations   — which captain may sell which SKU, and at what price
--   captain_capture_lines — every field sale line: SKU, quantity, amount
--
-- So: stall revenue was publicly readable, and publicly DELETABLE. A wiped
-- captain_capture_lines would have destroyed the sales history reconciliation
-- depends on, with no way to reconstruct it.
--
-- Both tables are reached only through the service-role client
-- (`supabaseAdmin()`), and the service role BYPASSES RLS. So enabling RLS with
-- no policies is the correct fix: the application keeps working exactly as it
-- does now, and anonymous access is refused.
--
-- No policy is added on purpose. A policy would grant somebody access; nobody
-- outside the server needs any. Deny-all is the right default here, and adding
-- a permissive policy "to be safe" is how tables end up open again.
--
-- IDEMPOTENT — safe to run more than once.

alter table public.captain_allocations   enable row level security;
alter table public.captain_capture_lines enable row level security;

-- Belt and braces: revoke the grants PostgREST relies on, so neither role can
-- reach these tables even if RLS is later disabled by accident. RLS is the
-- control; this is the second lock on the same door.
revoke all on public.captain_allocations   from anon, authenticated;
revoke all on public.captain_capture_lines from anon, authenticated;
