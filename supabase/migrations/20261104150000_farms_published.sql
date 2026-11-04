-- Farms: a "Live on website" switch.
--
-- A farm can be added and finished in the admin before it shows on the store.
-- Hidden farms are left out of /farms, the farm page, the sitemap and the
-- traceability page. Existing farms stay live (default true).

alter table public.farms add column if not exists published boolean not null default true;
