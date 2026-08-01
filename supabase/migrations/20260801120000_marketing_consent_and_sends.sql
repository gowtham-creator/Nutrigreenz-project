-- Marketing consent + a record of what was actually sent.
--
-- broadcastCampaign() sent to every customer row it could find: no consent
-- check, no unsubscribe, and no record afterwards. Pressing send twice sent
-- twice, and nobody could answer "who did we message, and did they agree to it".
--
-- ADDITIVE + IDEMPOTENT.

-- ---------------------------------------------------------------------------
-- Per-channel marketing preference.
-- ---------------------------------------------------------------------------
-- Stored as OPT-OUT (default false = may be messaged). These are customers with
-- an existing order relationship, and the storefront's privacy policy already
-- promises a working unsubscribe rather than a prior opt-in. Modelling it as
-- opt-out keeps that promise honest: the flag exists, the unsubscribe link sets
-- it, and the sender respects it.
--
-- SMS carries a second gate in code: promotional SMS in India needs a
-- DLT-registered PROMOTIONAL template, and sending campaign copy on the
-- transactional header gets the sender ID blocked. The sender refuses SMS
-- entirely until that template id is configured.
alter table public.customers
  add column if not exists marketing_email_opt_out boolean not null default false;

alter table public.customers
  add column if not exists marketing_sms_opt_out boolean not null default false;

-- When they opted out, so a re-subscribe or an audit has a date to point at.
alter table public.customers
  add column if not exists marketing_opt_out_at timestamptz;

-- Unsubscribe link secret. Random per customer, so a link cannot be guessed and
-- one customer cannot unsubscribe another. Backfilled for existing rows.
alter table public.customers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists customers_unsubscribe_token_key
  on public.customers (unsubscribe_token);

-- ---------------------------------------------------------------------------
-- What was sent, to whom, on which channel.
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  -- The coupon code / campaign key this send belongs to. Text, not an FK: a
  -- campaign may be sent for something that is not a coupon, and the record
  -- must outlive a deleted coupon.
  campaign_key text not null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  channel text not null,
  -- The address actually used, snapshotted. A customer can change their email
  -- later; this row must still say where the message went.
  destination text not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now(),
  constraint campaign_sends_channel_chk check (channel in ('email', 'sms', 'whatsapp')),
  constraint campaign_sends_status_chk check (status in ('sent', 'failed', 'skipped'))
);

alter table public.campaign_sends enable row level security;

-- Idempotency: one successful send per customer per channel per campaign.
-- Partial, so a failed attempt can be retried but a delivered one cannot be
-- duplicated by pressing the button again.
create unique index if not exists campaign_sends_once_idx
  on public.campaign_sends (campaign_key, customer_id, channel)
  where status = 'sent';

create index if not exists campaign_sends_campaign_idx
  on public.campaign_sends (campaign_key, created_at desc);

create index if not exists campaign_sends_customer_idx
  on public.campaign_sends (customer_id, created_at desc);
