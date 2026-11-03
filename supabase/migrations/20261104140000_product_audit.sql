-- Product audit log: every change to every product, field by field.
--
-- One row per change: who made it, when, and each field's old and new value.
-- product_id is deliberately NOT a foreign key, and the product's name is
-- snapshotted, so a deleted product keeps its full history.
--
-- Append-only and service-role only, like admin_activity.

create table if not exists public.product_audit (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  product_name text not null,
  variant_id uuid,
  variant_label text,
  action text not null,
  -- [{ "field": "pricePaise", "from": 25000, "to": 27000 }, ...]
  changes jsonb not null default '[]'::jsonb,
  actor_email text,
  actor_role text,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint product_audit_action_chk check (action in (
    'created', 'updated', 'deleted', 'stock',
    'variant_created', 'variant_updated', 'variant_deleted', 'variant_stock'
  )),
  constraint product_audit_source_chk check (source in ('admin', 'import'))
);

create index if not exists product_audit_product_idx on public.product_audit (product_id, created_at desc);
create index if not exists product_audit_created_idx on public.product_audit (created_at desc);

alter table public.product_audit enable row level security;
