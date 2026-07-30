-- Per-product image gallery.
--
-- Until now a product carried exactly ONE image (`products.image_url`). The PDP
-- needs several — front of pack, the label, texture, in use — so it was filling
-- the extra slots from a CURATED SET SHARED ACROSS A WHOLE CATEGORY. That meant
-- a shopper on the groundnut oil page was shown photographs of a different oil,
-- which is misdescription, not decoration.
--
-- This gives every product its own ordered list. `image_url` stays the lead/
-- hero shot (it is what the shop grid, cart, order emails and invoices use, so
-- it must remain a single well-defined value); `gallery` is everything after it.
--
-- Modelled as text[] rather than a child table to match `journals.gallery` and
-- `farms.gallery`, which the admin GalleryField already reads and writes — the
-- array preserves the operator's ordering, which is the only relational
-- property the gallery actually needs.
alter table public.products
  add column if not exists gallery text[] not null default '{}';

comment on column public.products.gallery is
  'Ordered additional product photos (Supabase Storage public URLs). The lead/hero shot stays in image_url; this is everything shown after it on the PDP. Empty array = no extra photos, and the PDP falls back to captioned placeholders rather than borrowing another product''s images.';
