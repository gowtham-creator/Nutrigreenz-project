-- Promotions: allow a campaign to target a single VARIANT.
--
-- Until now `scope` was all | category | product, so a markdown always hit
-- every size and pack of a product at once. Real campaigns are not that blunt:
-- a 1L glass bottle goes on offer to clear a slow-moving pack size while the
-- 5L tin stays at list, and the whole point is that the shopper sees WHICH
-- size the offer belongs to.
--
-- `scope_values` carries variant SKUs for this scope, matching the way the
-- 'product' scope already carries product slugs. SKU rather than variant id
-- because `product_variants.sku` is UNIQUE and an operator can actually read
-- and type it; a uuid in an admin text field is not a usable contract.
--
-- Variants with a NULL sku cannot be targeted. That is deliberate — the SKU is
-- the handle, and a variant without one has no stable name to aim at.

alter table public.promotions
  drop constraint if exists promotions_scope_chk;

alter table public.promotions
  add constraint promotions_scope_chk
  check (scope = any (array['all'::text, 'category'::text, 'product'::text, 'variant'::text]));
