-- Journals & Farms — move the storefront Journal + Farms content off the static
-- `src/components/ng/data.ts` arrays and into server-owned tables so an operator
-- can add / edit / delete them from the admin without a deploy.
--
-- ADDITIVE + IDEMPOTENT. Creates two tables, seeds them from the exact static
-- content the storefront ships today (so the live site looks identical after the
-- pages switch to reading the DB), and is safe to run repeatedly (seed only when
-- empty, so re-running never duplicates rows or resurrects deleted content).
--
-- Access: service-role only, mirroring `public.announcements` / `public.promotions`
-- — RLS is ENABLED with NO policies, so anon / authenticated browser roles get
-- nothing; only the server (service role, which bypasses RLS) can read/write.
-- The storefront reads through server components (service role); administration
-- goes through the admin-gated /api/admin/journal + /api/admin/farms routes.

create extension if not exists pgcrypto;

-- Shared updated_at trigger (already present from earlier migrations; re-declared
-- identically so this migration is self-contained + idempotent).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- journals — one row per long-form Journal article.
-- ---------------------------------------------------------------------------
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_url text,
  author text not null default 'Nutrigreenz Field Desk',
  category text not null default 'science',
  read_minutes integer not null default 5,
  tags text[] not null default '{}',
  published_at date not null default current_date,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journals enable row level security;

drop trigger if exists journals_set_updated_at on public.journals;
create trigger journals_set_updated_at
  before update on public.journals
  for each row execute function public.set_updated_at();

create index if not exists journals_sort_published_idx
  on public.journals (sort, published_at desc);

-- ---------------------------------------------------------------------------
-- farms — one row per partner farm. `id` is a stable text slug so /farms/[id]
-- URLs stay identical to the current static ids.
-- ---------------------------------------------------------------------------
create table if not exists public.farms (
  id text primary key,
  name text not null,
  region text not null default '',
  hectares numeric,
  practices text[] not null default '{}',
  partnered_since date,
  farmer_name text,
  story text,
  image_url text,
  gallery text[] not null default '{}',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farms enable row level security;

drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at
  before update on public.farms
  for each row execute function public.set_updated_at();

create index if not exists farms_sort_idx on public.farms (sort);

-- ---------------------------------------------------------------------------
-- Seed journals from the current static JOURNAL array. The long-form `body` is
-- the exact HTML the article detail page renders today (shared across articles),
-- so the switch to DB is visually identical. Seeded ONLY when the table is empty.
-- ---------------------------------------------------------------------------
insert into public.journals (slug, title, excerpt, body, cover_url, category, read_minutes, tags, published_at, sort)
select v.slug, v.title, v.excerpt, $body$<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. The slow pace of bilona — three days of churning, two days of resting — is not a marketing line; it's a chemical reality that nothing in modern dairy technology has been able to shortcut.</p>
<h2>The science underneath the slowness</h2>
<p>When milk is cultured at low temperature for 48 hours, the lactic-acid bacteria break down lactose more thoroughly. The resulting curd, churned by hand at the right rhythm, releases butter with a fundamentally different fatty-acid profile — shorter-chain triglycerides, more conjugated linoleic acid, and a richer aromatic compound bouquet.</p>
<blockquote>"I learned from my grandmother. The butter tells you when it's done — you don't tell it."<footer>— Hetal Pateel, Junagadh</footer></blockquote>
<h2>Why we will not industrialise this</h2>
<p>Several large dairies have asked us about white-labeling our ghee using continuous-flow centrifuge methods. We've politely declined. The yield is higher, the cost-per-jar is lower, but the result is not the same product. We'd rather sell fewer jars of the real thing than more jars of something we couldn't stand behind.</p>
<p>If you scan the lot code on your jar, you can see Hetal's name, the exact day the milk was set, and the day the ghee was bottled. That receipt is the contract. It's the reason we exist.</p>$body$,
  v.cover_url, v.category, v.read_minutes, v.tags::text[], v.published_at::date, v.sort
from (
  values
    ('why-bilona-matters', 'Why bilona is the only ghee method we''ll ever use', 'Three days of hand-churning. Eleven liters of milk per liter of ghee. The science behind why slow makes everything better.', '/images/journal/why-bilona-matters.webp', 'science', 8, '{ghee,bilona,science}', '2026-04-12', 0),
    ('anantapur-rains', 'Field notes: the rains came late this year', 'Climate volatility is changing how our partner farms plan. A dispatch from our agronomist after a visit to the groundnut belt.', '/images/journal/anantapur-rains.webp', 'field-notes', 6, '{climate,field-notes}', '2026-03-28', 1),
    ('millet-pongal', 'Foxtail millet pongal — Subbaiah''s mother''s recipe', 'A staple from the Anantapur kitchen, captured between harvests. Twenty minutes start to finish.', '/images/journal/millet-pongal.webp', 'recipes', 5, '{millet,recipe}', '2026-03-15', 2),
    ('what-lab-tests-mean', 'What our lab tests actually tell you', 'Heavy metals, aflatoxin, pesticide residue — the three numbers every honest brand should put on the label.', '/images/journal/what-lab-tests-mean.webp', 'guides', 10, '{lab,guides,quality}', '2026-02-20', 3)
) as v(slug, title, excerpt, cover_url, category, read_minutes, tags, published_at, sort)
where not exists (select 1 from public.journals);

-- ---------------------------------------------------------------------------
-- Seed farms from the current static FARMS array. Seeded ONLY when empty.
-- ---------------------------------------------------------------------------
insert into public.farms (id, name, region, hectares, practices, partnered_since, farmer_name, story, image_url, sort)
select v.id, v.name, v.region, v.hectares, v.practices::text[], v.partnered_since::date, v.farmer_name, v.story, v.image_url, v.sort
from (
  values
    ('f-anantapur', 'Mallika & Subbaiah Farm', 'Anantapur, Andhra Pradesh', 14::numeric, '{organic,"rainwater harvesting",intercropping}', '2019-04-12', 'K. Subbaiah', 'Three generations of dryland farming. We helped them transition 9 acres from groundnut monoculture to mixed cropping in 2021.', '/images/farm/dryland-farm.webp', 0),
    ('f-junagadh', 'Hetal Dairy', 'Junagadh, Gujarat', 6::numeric, '{"A2 dairy","bilona churning",biodynamic}', '2020-08-22', 'Hetal Pateel', '18 Gir cows, no synthetic feed, hand-milking only. Bilona ghee made the same day milk is collected.', '/images/farm/gir-farm.webp', 1),
    ('f-nilgiri', 'Periyar Bee Co-op', 'Nilgiris, Tamil Nadu', null::numeric, '{"wild honey",co-operative,forest-adjacent}', '2021-01-15', '23-member co-op', 'Honey harvested without smoke or queen-killing. Each lot tested for purity at our Hyderabad lab.', '/images/farm/bee-coop.webp', 2)
) as v(id, name, region, hectares, practices, partnered_since, farmer_name, story, image_url, sort)
where not exists (select 1 from public.farms);
