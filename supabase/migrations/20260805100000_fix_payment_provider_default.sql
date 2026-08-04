-- orders.payment_provider defaulted to 'razorpay'.
--
-- Razorpay was never wired: its module was a stub whose functions returned
-- null, and it has now been deleted. So every order placed to date carries the
-- name of a gateway that never touched it, and any reconciliation or reporting
-- that groups by provider is reading a value that means nothing.
--
-- The default becomes 'none', which is what the order-creation path already
-- passes explicitly. Existing rows are corrected only where the claim is
-- provably false — a pending or failed order cannot have been settled by a
-- gateway that was never configured.
--
-- Rows that are actually PAID are deliberately left alone. If any exist they
-- were settled as cash on delivery and marked by an operator, and rewriting a
-- historical payment record to fit a schema change is not a migration's job.
--
-- ADDITIVE + IDEMPOTENT.

alter table public.orders
  alter column payment_provider set default 'none';

update public.orders
   set payment_provider = 'none'
 where payment_provider = 'razorpay'
   and payment_status in ('pending', 'failed');
