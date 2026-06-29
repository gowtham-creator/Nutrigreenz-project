-- Seed the real Nutri Greenz range — Cold-Pressed Oils, Honey, Ghee + Rice cat.
--
-- ADDITIVE + IDEMPOTENT. Seeds the catalogue the client asked for as DRAFTS at
-- price 0 / stock 0, so NOTHING shows half-priced on the live storefront: the
-- base products are `status = 'draft'` (hidden from the shop, which only lists
-- ACTIVE products) while their variants are `is_active = true`. The client fills
-- real prices & stock from the Inventory Portal, then flips each product to
-- 'active' to publish it. Existing demo "greens" products are left untouched.
--
-- SKU scheme: OIL-<NAME>-<SIZE>-<PACK>, HONEY-<SIZE>-GLASS, GHEE-<SIZE>-GLASS.
-- Every insert is `where not exists`, so re-running changes nothing.
--
-- RICE: per the client, varieties are still pending — we create the CATEGORY
-- ONLY here and intentionally seed NO rice products. Add them via the portal
-- once the variety list arrives (do not invent rice SKUs).

-- ── Categories ─────────────────────────────────────────────────────────────
insert into public.categories (name, slug, sort)
select v.name, v.slug, v.sort
from (values
  ('Cold-Pressed Oils', 'oils',  10),
  ('Honey',             'honey', 20),
  ('Ghee',              'ghee',  30),
  ('Rice',              'rice',  40)
) as v(name, slug, sort)
where not exists (select 1 from public.categories c where c.slug = v.slug);

-- ── Oil base products (6) — draft, price 0 ─────────────────────────────────
insert into public.products (name, slug, category_id, description, price_paise, status)
select
  v.name,
  v.slug,
  (select id from public.categories where slug = 'oils'),
  v.description,
  0,
  'draft'
from (values
  ('Groundnut Cold-Pressed Oil', 'groundnut-cold-pressed-oil', 'Cold-pressed groundnut (peanut) oil — single-press, never refined.'),
  ('Sesame Cold-Pressed Oil',    'sesame-cold-pressed-oil',    'Cold-pressed sesame (til) oil — single-press, never refined.'),
  ('Safflower Cold-Pressed Oil', 'safflower-cold-pressed-oil', 'Cold-pressed safflower (kusum) oil — single-press, never refined.'),
  ('Olive Cold-Pressed Oil',     'olive-cold-pressed-oil',     'Cold-pressed olive oil — single-press, never refined.'),
  ('Mustard Cold-Pressed Oil',   'mustard-cold-pressed-oil',   'Cold-pressed mustard (sarson) oil — single-press, never refined.'),
  ('Coconut Cold-Pressed Oil',   'coconut-cold-pressed-oil',   'Cold-pressed coconut oil — single-press, never refined.')
) as v(name, slug, description)
where not exists (select 1 from public.products p where p.slug = v.slug);

-- ── Oil variants — 8 per oil (1/3/5L glass+plastic, 10/15L tin) = 48 SKUs ───
insert into public.product_variants
  (product_id, label, pack, size_value, size_unit, price_paise, sku, stock, reserved, is_active, sort)
select
  p.id,
  s.label,
  s.pack,
  s.size_value,
  'L',
  0,
  'OIL-' || o.key || '-' || s.token || '-' || upper(s.pack),
  0,
  0,
  true,
  s.sort
from (values
  ('groundnut-cold-pressed-oil', 'GROUNDNUT'),
  ('sesame-cold-pressed-oil',    'SESAME'),
  ('safflower-cold-pressed-oil', 'SAFFLOWER'),
  ('olive-cold-pressed-oil',     'OLIVE'),
  ('mustard-cold-pressed-oil',   'MUSTARD'),
  ('coconut-cold-pressed-oil',   'COCONUT')
) as o(slug, key)
join public.products p on p.slug = o.slug
cross join (values
  ('1L',  'glass',   '1L',   1,  10),
  ('1L',  'plastic', '1L',   1,  20),
  ('3L',  'glass',   '3L',   3,  30),
  ('3L',  'plastic', '3L',   3,  40),
  ('5L',  'glass',   '5L',   5,  50),
  ('5L',  'plastic', '5L',   5,  60),
  ('10L', 'tin',     '10L',  10, 70),
  ('15L', 'tin',     '15L',  15, 80)
) as s(label, pack, token, size_value, sort)
where not exists (
  select 1 from public.product_variants v
  where v.sku = 'OIL-' || o.key || '-' || s.token || '-' || upper(s.pack)
);

-- ── Honey base product (1) + 6 glass jars ──────────────────────────────────
insert into public.products (name, slug, category_id, description, price_paise, status)
select 'Raw Honey', 'raw-honey',
       (select id from public.categories where slug = 'honey'),
       'Raw, unheated honey in glass jars.', 0, 'draft'
where not exists (select 1 from public.products p where p.slug = 'raw-honey');

insert into public.product_variants
  (product_id, label, pack, size_value, size_unit, price_paise, sku, stock, reserved, is_active, sort)
select p.id, s.label, 'glass', s.size_value, 'g', 0,
       'HONEY-' || s.token || '-GLASS', 0, 0, true, s.sort
from public.products p
cross join (values
  ('100g', '100', 100, 10),
  ('150g', '150', 150, 20),
  ('250g', '250', 250, 30),
  ('300g', '300', 300, 40),
  ('400g', '400', 400, 50),
  ('500g', '500', 500, 60)
) as s(label, token, size_value, sort)
where p.slug = 'raw-honey'
  and not exists (
    select 1 from public.product_variants v where v.sku = 'HONEY-' || s.token || '-GLASS'
  );

-- ── Ghee base product (1) + 6 glass jars ───────────────────────────────────
insert into public.products (name, slug, category_id, description, price_paise, status)
select 'Pure Ghee', 'pure-ghee',
       (select id from public.categories where slug = 'ghee'),
       'Pure ghee in glass jars.', 0, 'draft'
where not exists (select 1 from public.products p where p.slug = 'pure-ghee');

insert into public.product_variants
  (product_id, label, pack, size_value, size_unit, price_paise, sku, stock, reserved, is_active, sort)
select p.id, s.label, 'glass', s.size_value, 'g', 0,
       'GHEE-' || s.token || '-GLASS', 0, 0, true, s.sort
from public.products p
cross join (values
  ('100g', '100', 100, 10),
  ('150g', '150', 150, 20),
  ('250g', '250', 250, 30),
  ('300g', '300', 300, 40),
  ('400g', '400', 400, 50),
  ('500g', '500', 500, 60)
) as s(label, token, size_value, sort)
where p.slug = 'pure-ghee'
  and not exists (
    select 1 from public.product_variants v where v.sku = 'GHEE-' || s.token || '-GLASS'
  );
