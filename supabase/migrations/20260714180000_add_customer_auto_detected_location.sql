-- Auto-detected delivery location for the storefront "Deliver to" control.
--
-- Best-effort GPS hint captured when a SIGNED-IN customer who has not yet saved
-- a delivery address grants browser geolocation. Written by POST /api/geo/detect
-- and surfaced read-only on the admin Customers detail page. A single nullable
-- JSONB blob keeps it privacy-safe: it can be cleared in one statement and is
-- superseded the moment the customer saves a real address.
--
-- Shape: { area, pincode, city, lat, lng, detectedAt }

alter table public.customers
  add column if not exists auto_detected_location jsonb;

comment on column public.customers.auto_detected_location is
  'Best-effort GPS-derived delivery hint {area,pincode,city,lat,lng,detectedAt} captured from the storefront "Deliver to" auto-detect for a signed-in customer without a saved address. Read-only admin surface; superseded once the customer saves a real address.';
