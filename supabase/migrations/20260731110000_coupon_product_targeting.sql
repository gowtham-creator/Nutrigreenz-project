-- Product targeting for coupons.
--
-- The campaign builder has offered a "Product / SKU" targeting mode since it was
-- written, backed by a free-text box the operator typed product names into. That
-- text was never stored and nothing ever enforced it: a coupon marked as
-- product-targeted applied to every order exactly like an untargeted one. The
-- mode looked real in the UI and did nothing.
--
-- Product IDs rather than names or SKUs: a product can be renamed or re-SKU'd
-- without silently detargeting a live campaign, and the id is what the cart
-- carries on each line already.
alter table public.coupons
  add column if not exists product_ids uuid[];

comment on column public.coupons.product_ids is
  'Products this coupon applies to. NULL or empty = every product. When set, the order must contain at least one line for one of these products or the code is rejected.';

create index if not exists coupons_product_ids_idx on public.coupons using gin (product_ids);
