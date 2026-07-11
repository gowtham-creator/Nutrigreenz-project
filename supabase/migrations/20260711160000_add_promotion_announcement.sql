-- Add an optional storefront announcement-bar line to promotions.
-- When set, the top marquee shows this line while the promotion is live; when
-- null, the storefront derives a line from the title + discount percent.
alter table public.promotions
  add column if not exists announcement text;

comment on column public.promotions.announcement is
  'Optional short marquee line for the storefront top announcement bar (e.g. "Diwali Dhamaka - 15% OFF everything - Shop now"). Null -> derived from title + discount.';
