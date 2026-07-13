-- Per-category visual: an admin-picked icon (Solar icon name) and/or an uploaded
-- image, both set from the Add/Edit category modal. The storefront prefers the
-- image, then the icon, then a hardcoded fallback.
alter table public.categories
  add column if not exists icon text,
  add column if not exists image_url text;

comment on column public.categories.icon is
  'Solar icon name for the category pill (e.g. "bottle-bold"). Fallback when no image_url.';
comment on column public.categories.image_url is
  'Uploaded category image URL (preferred over icon on the storefront).';
