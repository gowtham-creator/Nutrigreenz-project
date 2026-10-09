-- Track when a failed online order's reservations were given back, and tidy the
-- provider label on orders that went through the gateway.
--
-- An online (UPI) order takes three things when it is created, before the
-- customer has paid: a stock reservation (product_variants.reserved), a coupon
-- use (coupon_uses) and the loyalty points it redeems (loyalty_ledger). If the
-- order is then never paid - the gateway refuses the handoff, the customer
-- abandons it, the bank declines - the application now releases all three.
--
--   holds_released_at  when that release happened. NULL means the order still
--                      holds its reservations (or never released them).
--
-- It does two jobs:
--   * ONCE-ONLY. Releasing stock subtracts from `reserved`, which is not
--     idempotent, so the release claims this column with a compare-and-set
--     (update ... where holds_released_at is null) and only the winner proceeds.
--   * RECOVERY. A failed order can still be paid later (the bank is the
--     authority). When that happens the application takes the reservations
--     again, but only for an order whose marker is set - an order that was
--     failed before this existed, or left held on purpose (a short capture),
--     still holds everything and must not be reserved twice.
--
-- Until this migration is applied the application degrades safely: the claim
-- errors, nothing is released, and behaviour is what it was before.
--
-- ADDITIVE + IDEMPOTENT.

alter table public.orders
  add column if not exists holds_released_at timestamptz;

comment on column public.orders.holds_released_at is
  'When a failed online order''s stock reservation, coupon use and redeemed points were given back. NULL while it still holds them. Set by a compare-and-set so the release happens exactly once; cleared if the order is later recovered to paid and the reservations are taken again.';

-- Receipts and invoices print the payment provider ("Paid - sbiepay"). Orders
-- paid through the gateway before the provider was recorded at handoff carry the
-- column default 'none'. A paid online order was by definition settled by the
-- gateway (the admin "mark paid" action refuses UPI orders), so the label is
-- corrected. COD orders and unpaid orders are left alone.
update public.orders
   set payment_provider = 'sbiepay'
 where payment_method = 'upi'
   and payment_status = 'paid'
   and payment_provider = 'none';
