-- Product view instrumentation: one row per storefront product-detail view.
-- Powers the admin Product & Customer Analytics surface (views per product over
-- time). Best-effort telemetry written by POST /api/products/view — no auth, no
-- foreign key on product_id so a product delete never blocks or errors an
-- ingest, and the table is deliberately append-only.
create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  session_id text,
  customer_id uuid,
  created_at timestamptz not null default now()
);

-- Hot path for the analytics aggregation: per-product, time-ordered scans.
create index if not exists product_views_product_created_idx
  on public.product_views (product_id, created_at);

-- RLS on with no policies (mirrors public.wishlists): only the service-role
-- client — used by the server-side ingest + aggregation — can read/write.
alter table public.product_views enable row level security;

comment on table public.product_views is
  'Append-only storefront PDP view pings (best-effort telemetry for admin analytics).';
comment on column public.product_views.session_id is
  'Opaque anonymous client session id for coarse de-duplication; nullable.';
comment on column public.product_views.customer_id is
  'Signed-in customer id when known; nullable for anonymous views.';
