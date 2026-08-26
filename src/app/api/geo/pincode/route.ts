import {
  isValidIndianPincode,
  resolveOffline,
  stateForPincode,
  type PincodeLocation,
} from "@/lib/india-pincodes";
import { isServiceable } from "@/lib/commerce-rules";

export const runtime = "nodejs";

/**
 * GET /api/geo/pincode?pincode=400069 — recognise ANY Indian pincode.
 *
 * Answers two separate questions in one round trip, because the storefront
 * needs both and asking twice doubles the latency on the critical path:
 *
 *   `location`    what place this is — true for every valid Indian pincode
 *   `serviceable` whether we deliver there — the Super Admin's decision
 *
 * Keeping them apart is the point. The previous behaviour treated an
 * unserviceable pincode as an unrecognised one, so a customer in Mumbai saw a
 * dead form and could not tell a typo from "not yet in your city".
 *
 * ── Resolution order ──────────────────────────────────────────────────────
 *
 * 1. Offline prefix table — instant, always succeeds for a valid pincode.
 * 2. India Post's public API — refines to the actual locality/district.
 *
 * Step 2 is allowed to fail. A slow or unreachable upstream degrades the label
 * from "Maharashtra" to "Andheri East, Mumbai" being unavailable; it never
 * fails the request, because a customer who typed a real pincode must never be
 * told it does not exist just because a third party timed out.
 */

/** India Post is unauthenticated and occasionally slow; keep it off the tail. */
const UPSTREAM_TIMEOUT_MS = 3500;

/**
 * Process-lifetime cache. Pincode→locality is effectively immutable, so there
 * is nothing to invalidate, and this keeps a customer editing a pincode field
 * from issuing one upstream call per keystroke-completed value.
 */
const cache = new Map<string, PincodeLocation>();

interface PostOffice {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
}

/** Ask India Post for the locality. Returns null on any failure — never throws. */
async function lookupUpstream(pincode: string): Promise<PincodeLocation | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    const first = Array.isArray(body) ? (body[0] as Record<string, unknown>) : null;
    if (!first || first.Status !== "Success") return null;
    const offices = first.PostOffice;
    if (!Array.isArray(offices) || offices.length === 0) return null;

    /*
     * A pincode covers several post offices. Prefer the one whose name is not
     * a bare "<District> H.O"/"S.O" administrative entry, since the customer
     * recognises "Andheri East" and not "Mumbai H.O". Falls back to the first.
     */
    const po = (offices as PostOffice[]);
    const district = po[0]?.District?.trim() || "";
    const named =
      po.find((o) => {
        const n = (o.Name ?? "").trim();
        return n && district && !n.toLowerCase().startsWith(district.toLowerCase());
      }) ?? po[0];

    const area = (named?.Name ?? "").trim() || district || stateForPincode(pincode);
    return {
      pincode,
      area,
      district,
      state: (named?.State ?? "").trim() || stateForPincode(pincode),
    };
  } catch {
    return null; // timeout, DNS, malformed body — all the same to the caller
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<Response> {
  const pincode = (new URL(request.url).searchParams.get("pincode") ?? "").trim();

  if (!isValidIndianPincode(pincode)) {
    return Response.json(
      { ok: false, error: "invalid-pincode" },
      { status: 400 },
    );
  }

  // Offline resolution first, so `location` is never null for a valid pincode.
  let location = cache.get(pincode) ?? resolveOffline(pincode)!;

  if (!cache.has(pincode)) {
    const upstream = await lookupUpstream(pincode);
    if (upstream) {
      cache.set(pincode, upstream);
      location = upstream;
    }
  }

  // Serviceability is independent of recognition and must not fail the lookup.
  let serviceable = false;
  try {
    serviceable = await isServiceable(pincode);
  } catch {
    serviceable = false;
  }

  return Response.json(
    { ok: true, location, serviceable },
    {
      // Pincode→locality does not change. Cache hard at the edge; the
      // serviceable flag rides along and is re-derived within the minute.
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=86400" },
    },
  );
}
