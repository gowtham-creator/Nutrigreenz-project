-- Captain sale lines, tied to real catalogue variants.
--
-- captain_captures stores its lines as a jsonb blob with a free-text sku that
-- matched nothing in the catalogue. That made a stall sale unreconcilable: you
-- could total the cash, but not answer "how many 1L groundnut oils did we sell
-- through captains", or decrement the stock those bottles came out of.
--
-- The jsonb stays as the captured snapshot (what the captain saw and charged at
-- the time, which must not change if the catalogue later does). These rows are
-- the queryable, joinable version.
create table if not exists public.captain_capture_lines (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.captain_captures(id) on delete cascade,
  captain_id uuid not null references public.captains(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  title text not null,
  unit text,
  qty integer not null check (qty > 0),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Reached only through the service-role client, which bypasses RLS. Enabling
-- RLS with NO policy is therefore the correct lock: the app is unaffected and
-- anonymous access is refused. This was missing when the table was first
-- created, which left it readable and DELETABLE by anyone holding the anon key
-- — and that key ships in the browser.
alter table public.captain_capture_lines enable row level security;
revoke all on public.captain_capture_lines from anon, authenticated;

create index if not exists captain_capture_lines_captain_idx
  on public.captain_capture_lines (captain_id, captured_at desc);
create index if not exists captain_capture_lines_variant_idx
  on public.captain_capture_lines (variant_id);
create index if not exists captain_capture_lines_capture_idx
  on public.captain_capture_lines (capture_id);

comment on table public.captain_capture_lines is
  'One product line from a captain stall sale, joined to the real catalogue variant so captain sales can be counted per SKU and reconciled against stock. The parent capture keeps the jsonb snapshot of what was charged at the time.';
