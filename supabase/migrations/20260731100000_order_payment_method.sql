-- Record HOW an order is being paid, and the gateway's own reference.
--
-- Until now the orders table carried `payment_status` but nothing about the
-- method, so a cash-on-delivery order and an unpaid online order were
-- indistinguishable: both simply read "pending". An operator could not tell
-- which ones were waiting on a courier collecting cash and which were failed
-- card attempts, and revenue reporting could not separate the two.
--
--   payment_method  'upi'  — paid online through the gateway
--                   'cod'  — cash collected on delivery
--
--   paid_at         when payment was actually confirmed. Distinct from
--                   updated_at, which moves for any edit. Needed to reconcile a
--                   settlement window against the gateway's own report.
--
--   payment_ref     the gateway's transaction reference. This is the value that
--                   ties our order to a line in SBI's settlement file, so it is
--                   what any payment dispute is resolved with. NULL for COD.
alter table public.orders
  add column if not exists payment_method text not null default 'cod',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_ref text;

-- Constrain the method rather than leaving it free text: a typo here would
-- silently drop orders out of whichever report filters on it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_payment_method_check'
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method in ('upi', 'cod'));
  end if;
end $$;

-- Backfill paid_at for anything already marked paid, so the column is not
-- misleadingly empty on historical rows. updated_at is the closest honest
-- approximation we have; there is no better source for orders paid before this
-- column existed.
update public.orders
set paid_at = updated_at
where payment_status = 'paid' and paid_at is null;

create index if not exists orders_payment_method_idx on public.orders (payment_method);
create index if not exists orders_paid_at_idx on public.orders (paid_at desc);

comment on column public.orders.payment_method is
  'How the order is paid: ''upi'' (online, via the gateway) or ''cod'' (cash on delivery). Defaults to cod because that is the only method that works without a live gateway.';
comment on column public.orders.paid_at is
  'When payment was actually confirmed — gateway callback for UPI, operator confirmation for COD. NULL until then.';
comment on column public.orders.payment_ref is
  'Gateway transaction reference, used to reconcile against the settlement file. NULL for COD.';
