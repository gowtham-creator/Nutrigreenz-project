-- Profile fields the account page collects but had nowhere to store.
--
-- The page has offered date of birth, gender, dietary preferences and four
-- notification toggles since it was written. None of them were persisted: the
-- save handler called a React state setter, so every value was discarded on
-- refresh while the toast said "your details and preferences have been updated".
--
-- Notification consent is deliberately NOT duplicated here. Email and SMS
-- already live in marketing_email_opt_out / marketing_sms_opt_out, which the
-- campaign sender reads. A second copy on this table would let a customer
-- switch SMS off in their profile and still receive campaign SMS, because the
-- sender would be reading the other column.
--
-- ADDITIVE + IDEMPOTENT.

alter table public.customers add column if not exists dob date;
alter table public.customers add column if not exists gender text;

-- Free-form list; the page offers a fixed set but the choice of set is
-- editorial and will change, and a check constraint would turn a copy edit
-- into a migration.
alter table public.customers add column if not exists diet_prefs text[] not null default '{}';

-- WhatsApp is a separate channel from SMS with its own consent basis, so it
-- gets its own flag rather than riding on the SMS opt-out.
alter table public.customers add column if not exists marketing_whatsapp_opt_out boolean not null default false;

-- Order updates are transactional, not marketing: a customer who opts out of
-- offers still needs to know their order shipped. Stored separately so the two
-- can never be conflated.
alter table public.customers add column if not exists notify_order_updates boolean not null default true;

alter table public.customers
  add constraint customers_gender_chk
  check (gender is null or gender in ('female','male','other','prefer_not_to_say'))
  not valid;
