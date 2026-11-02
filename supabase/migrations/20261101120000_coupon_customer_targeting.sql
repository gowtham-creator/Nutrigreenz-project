-- Coupon customer targeting, loyalty stacking and description
--
-- The campaign builder offered three things that were never stored:
--
--   * "Specific customers". The numbers typed in went nowhere, so a coupon meant
--     for a named list worked for everybody.
--   * "Stack with loyalty". The toggle did nothing: points always stacked.
--   * "Description". Dropped on save, so it could not head a campaign message.
--
-- Semantics:
--
--   customer_phones  NULL = anyone. When set, the code works only for a customer
--                    who owns one of these E.164 numbers as an OTP-verified phone.
--   stack_loyalty    True keeps today's behaviour for every existing coupon. False
--                    means an order using this code redeems no points.
--   description      The offer's headline in campaign messages. NULL = none.
--
-- Additive and idempotent. No existing row changes meaning, and the column
-- defaults need no table rewrite on the Postgres versions Supabase runs.
--
-- No index on customer_phones: a coupon is always read by its code and the list
-- is compared in the application, so nothing would ever use one.
--
-- These columns hold customers' phone numbers. `public.coupons` has RLS enabled
-- with no policies, so only the service role can read them.

-- requires_verified_phone has been read by every coupon query since July, but no
-- migration in this repo creates it. If production lacks it, every coupon lookup
-- fails. `if not exists` makes this line a no-op where the column is already there.

alter table public.coupons
  add column if not exists requires_verified_phone boolean not null default false,
  add column if not exists customer_phones text[],
  add column if not exists stack_loyalty boolean not null default true,
  add column if not exists description text;

comment on column public.coupons.customer_phones is
  'E.164 mobiles this coupon is limited to, matched against OTP-verified phones. NULL/empty = any customer.';
comment on column public.coupons.stack_loyalty is
  'Whether loyalty points may be redeemed on the same order as this coupon.';
comment on column public.coupons.description is
  'Offer headline used in campaign messages. NULL = none.';
