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

/**
 * The three distinct outcomes of asking India Post, which must NOT be
 * collapsed into one.
 *
 * The first version returned null for both "no such pincode" and "could not
 * reach the API", and fell back to the prefix table in either case. So typing
 * 310002 — which does not exist; the real Rajasthan codes in that series are
 * 311001, 312001, 313001 — was accepted and labelled "Rajasthan". A typo
 * looked like a valid delivery location.
 *
 * `not-found` is an answer and must be surfaced as one. `unreachable` is an
 * absence of an answer, where falling back to the state is right: a real
 * pincode must not be rejected because a third party timed out.
 */
type Lookup =
  | { status: "found"; location: PincodeLocation }
  | { status: "not-found" }
  | { status: "unreachable" };

/** Ask India Post for the locality. Never throws. */
async function lookupUpstream(pincode: string): Promise<Lookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { status: "unreachable" };
    const body = (await res.json()) as unknown;
    const first = Array.isArray(body) ? (body[0] as Record<string, unknown>) : null;
    if (!first) return { status: "unreachable" };

    const offices = first.PostOffice;
    /*
     * India Post answers a nonexistent pincode with
     * `{ Status: "Error", Message: "No records found", PostOffice: null }`.
     * That is a definitive NO, not a failure, and it is the whole reason
     * 310002 used to be accepted.
     */
    if (first.Status !== "Success" || !Array.isArray(offices) || offices.length === 0) {
      return { status: "not-found" };
    }

    /*
     * A pincode covers several post offices. Prefer one whose name is not a
     * bare "<District>" administrative entry, since the customer recognises
     * "Andheri East" rather than "Mumbai". Falls back to the first.
     */
    const po = offices as PostOffice[];
    const district = po[0]?.District?.trim() || "";
    const named =
      po.find((o) => {
        const n = (o.Name ?? "").trim();
        return n && district && !n.toLowerCase().startsWith(district.toLowerCase());
      }) ?? po[0];

    const area = (named?.Name ?? "").trim() || district || stateForPincode(pincode);
    return {
      status: "found",
      location: {
        pincode,
        area,
        district,
        state: (named?.State ?? "").trim() || stateForPincode(pincode),
        /* Every locality sharing this pincode. A pincode is an area, not a
           point — 110001 covers 21 post offices — and the customer may well
           recognise the third name rather than the first. */
        localities: po
          .map((o) => (o.Name ?? "").trim())
          .filter((n, i, all) => n && all.indexOf(n) === i),
      },
    };
  } catch {
    // Timeout, DNS, malformed body: we did not get an answer either way.
    return { status: "unreachable" };
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

  let location = cache.get(pincode) ?? null;

  if (!location) {
    const lookup = await lookupUpstream(pincode);

    if (lookup.status === "not-found") {
      /*
       * India Post says this pincode does not exist. Say so, rather than
       * falling back to the prefix table — that fallback is what let 310002
       * through as "Rajasthan" and made a typo look like a real address.
       */
      return Response.json(
        { ok: false, error: "unknown-pincode", pincode },
        { status: 404 },
      );
    }

    if (lookup.status === "found") {
      cache.set(pincode, lookup.location);
      location = lookup.location;
    } else {
      /*
       * Unreachable. We could not confirm the pincode either way, so fall back
       * to the prefix table and label it with its state. Deliberately NOT
       * cached: the next request should try the API again rather than being
       * served a degraded answer for the life of the process.
       */
      location = resolveOffline(pincode);
    }
  }

  if (!location) {
    return Response.json({ ok: false, error: "unknown-pincode", pincode }, { status: 404 });
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
