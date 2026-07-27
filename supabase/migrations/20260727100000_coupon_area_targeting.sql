-- Coupon area targeting
--
-- Lets the super admin restrict a coupon to specific delivery pincodes and/or
-- specific gated communities (e.g. a launch offer for one apartment complex).
--
-- Semantics: NULL or an empty array means "no restriction on this dimension".
-- Both dimensions are ANDed — a coupon carrying both lists requires the delivery
-- address to satisfy both. The community is never taken from the client; it is
-- resolved server-side from `serviceable_areas` using the delivery pincode, so a
-- customer cannot claim a community they don't deliver to.

alter table public.coupons
  add column if not exists pincodes text[],
  add column if not exists communities text[];

comment on column public.coupons.pincodes is
  'Delivery pincodes this coupon is valid for. NULL/empty = valid in all pincodes.';
comment on column public.coupons.communities is
  'Gated-community names (matching serviceable_areas.community) this coupon is valid for. NULL/empty = valid in all communities.';

-- Containment lookups on the arrays stay fast as the coupon catalogue grows.
create index if not exists coupons_pincodes_gin on public.coupons using gin (pincodes);
create index if not exists coupons_communities_gin on public.coupons using gin (communities);
