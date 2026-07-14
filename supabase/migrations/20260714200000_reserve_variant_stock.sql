-- Atomic variant stock reservation for order placement (anti-oversell).
--
-- Milestone-2 Phase-I stock lock. Order placement previously never touched
-- inventory, so two concurrent orders for the last unit could both succeed and
-- oversell. Availability is defined as `stock - reserved` EVERYWHERE in the app
-- (src/lib/catalog.ts `variantStats`, src/lib/storefront-catalog.ts), so a hold
-- is taken by INCREMENTING `reserved` under a `stock - reserved >= qty` guard
-- rather than mutating physical `stock` — keeping placement consistent with how
-- sold-out is read on the cards, PDP and admin rollups.
--
-- The whole reservation for an order happens inside ONE function call (one
-- transaction): if a single line is short the function RAISEs, which rolls back
-- every reservation already made in that call — so an order is never persisted
-- with a partial hold. Each `update ... where stock - reserved >= qty` is atomic
-- at the row level, so two concurrent placements for the last unit cannot both
-- succeed (whichever commits second sees the other's `reserved` and fails).
--
-- ADDITIVE + IDEMPOTENT (`create or replace`). Service-role only: EXECUTE is
-- revoked from PUBLIC and granted solely to `service_role`, so only the server
-- (which calls these via the service-role client) can reserve/release stock —
-- the anon / authenticated PostgREST roles cannot invoke them.

-- ---------------------------------------------------------------------------
-- reserve_variant_stock(p_items) — p_items is a JSON array of objects shaped
--   { "variant_id": "<uuid>", "qty": <positive int> }.
-- Reserves every line atomically. On the FIRST line that cannot be fully held it
-- RAISEs 'out_of_stock:<variant_id>' (SQLSTATE P0001), rolling back the call so
-- nothing is reserved. A missing/inactive variant is treated as unavailable.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_variant_stock(p_items jsonb)
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_variant_id uuid;
  v_qty integer;
  v_updated uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  -- Aggregate duplicate lines for the same variant so their COMBINED demand is
  -- checked against availability (two cart lines of one SKU can't jointly oversell).
  for v_variant_id, v_qty in
    select (elem->>'variant_id')::uuid, sum((elem->>'qty')::integer)
    from jsonb_array_elements(p_items) as elem
    where nullif(elem->>'variant_id', '') is not null
    group by (elem->>'variant_id')::uuid
  loop
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    update public.product_variants
      set reserved = reserved + v_qty
      where id = v_variant_id
        and is_active = true
        and stock - reserved >= v_qty
      returning id into v_updated;

    if v_updated is null then
      raise exception 'out_of_stock:%', v_variant_id using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_variant_stock(p_items) — compensating action: give a previously-made
-- reservation back (clamped at zero) when order persistence fails AFTER a
-- successful reserve, so a failed insert never leaks a permanent hold.
-- ---------------------------------------------------------------------------
create or replace function public.release_variant_stock(p_items jsonb)
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_variant_id uuid;
  v_qty integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for v_variant_id, v_qty in
    select (elem->>'variant_id')::uuid, sum((elem->>'qty')::integer)
    from jsonb_array_elements(p_items) as elem
    where nullif(elem->>'variant_id', '') is not null
    group by (elem->>'variant_id')::uuid
  loop
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;
    update public.product_variants
      set reserved = greatest(0, reserved - v_qty)
      where id = v_variant_id;
  end loop;
end;
$$;

-- Lock execution down to the server (service role) only. Supabase grants EXECUTE
-- directly to `anon` / `authenticated` (via ALTER DEFAULT PRIVILEGES), not merely
-- through PUBLIC, so those roles must be revoked EXPLICITLY — revoking from PUBLIC
-- alone would leave the anon / authenticated PostgREST roles able to inflate or
-- release `reserved` over RPC.
revoke all on function public.reserve_variant_stock(jsonb) from public, anon, authenticated;
revoke all on function public.release_variant_stock(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_variant_stock(jsonb) to service_role;
grant execute on function public.release_variant_stock(jsonb) to service_role;
