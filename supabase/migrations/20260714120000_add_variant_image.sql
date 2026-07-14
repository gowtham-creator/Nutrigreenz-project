-- Per-variant (SKU/size) product image. Optional: when set, the PDP gallery
-- leads with this image for the selected variant; otherwise it falls back to
-- the parent product's image(s). Stores a public storage URL (same bucket the
-- product image upload endpoint writes to).
alter table public.product_variants
  add column if not exists image_url text;

comment on column public.product_variants.image_url is
  'Optional per-variant image URL (Supabase Storage public URL). NULL falls back to the product image on the storefront/PDP.';
