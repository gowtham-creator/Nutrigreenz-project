-- Admin order cancellation.
--
-- Orders were forward-only (§3.9 no-cancellation). The owner asked for a cancel
-- action in the admin on 25 Oct 2026, so 'cancelled' becomes a terminal status
-- an order can reach from placed, confirmed, packed or shipped. A delivered
-- order is a return, not a cancellation, and stays out of reach.
--
-- 'order_cancel' is the loyalty-ledger row that takes back the points an order
-- earned when it is cancelled. It is its own reason so it never mixes with the
-- 'adjust' rows that give back points an order redeemed.

alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'));

alter table public.order_status_events drop constraint if exists order_status_events_status_chk;
alter table public.order_status_events add constraint order_status_events_status_chk
  check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'));

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_reason_chk;
alter table public.loyalty_ledger add constraint loyalty_ledger_reason_chk
  check (reason in ('order_earn', 'order_redeem', 'adjust', 'order_cancel'));
