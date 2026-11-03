-- SMS campaigns to offline customers, including ones that repeat.
--
-- Campaigns used to reach online customers only (public.customers). People who
-- buy at a captain's stall are known only by their mobile, so they need their
-- own send log, a do-not-message list, and a schedule for campaigns that go
-- out again every week, fortnight or month until the offer ends.
--
-- Additive and idempotent. Service role only, like the other marketing tables.

create table if not exists public.offline_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  -- One per run of a campaign (code@date), so a repeat sends again while a
  -- retried run never sends twice.
  run_key text not null,
  mobile text not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now(),
  constraint offline_campaign_sends_status_chk check (status in ('sent', 'failed'))
);

create unique index if not exists offline_campaign_sends_once_idx
  on public.offline_campaign_sends (run_key, mobile)
  where status = 'sent';

create table if not exists public.offline_contact_optouts (
  mobile text primary key,
  created_by text,
  created_at timestamptz not null default now(),
  constraint offline_contact_optouts_mobile_chk check (mobile ~ '^[6-9][0-9]{9}$')
);

create table if not exists public.campaign_schedules (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  -- { captainId?, community? }: who among the offline customers gets it.
  audience jsonb not null default '{}'::jsonb,
  -- The message variables: offer title, discount, valid till.
  vars jsonb not null default '{}'::jsonb,
  frequency text not null,
  next_run_at timestamptz not null,
  ends_at timestamptz,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_result jsonb,
  constraint campaign_schedules_frequency_chk check (frequency in ('once', 'weekly', 'fortnightly', 'monthly'))
);

create index if not exists campaign_schedules_due_idx
  on public.campaign_schedules (next_run_at)
  where active;

alter table public.offline_campaign_sends enable row level security;
alter table public.offline_contact_optouts enable row level security;
alter table public.campaign_schedules enable row level security;
