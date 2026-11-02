-- Let the loyalty ledger accept referral rewards.
--
-- referrals.ts writes `referral_referrer` and `referral_referee`, but the reason
-- check has never allowed them, so every referral credit was refused while the
-- attribution still moved to `rewarded`. Nobody was paid.
--
-- Additive and idempotent: it only widens the allowed list.

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_reason_chk;
alter table public.loyalty_ledger add constraint loyalty_ledger_reason_chk
  check (reason in ('order_earn', 'order_redeem', 'adjust', 'order_cancel', 'referral_referrer', 'referral_referee'));
