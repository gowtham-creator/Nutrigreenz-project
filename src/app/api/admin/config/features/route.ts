import { requireSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  listFeatureFlags,
  updateFeatureFlags,
  FEATURE_FLAGS,
  type FeatureFlagPatch,
} from "@/lib/feature-flags";

/** GET — every storefront feature flag with its metadata. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const flags = await listFeatureFlags();
  return Response.json({ ok: true, flags });
}

/**
 * PUT — toggle one or more feature flags. Super-admin only. Accepts either a
 * flat `{ subscriptions: true, ... }` body or a nested `{ flags: { ... } }`;
 * only known keys carrying a boolean are applied.
 */
export async function PUT(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const source =
    body.flags && typeof body.flags === "object"
      ? (body.flags as Record<string, unknown>)
      : body;

  const patch: FeatureFlagPatch = {};
  for (const meta of FEATURE_FLAGS) {
    const val = source[meta.key];
    if (typeof val === "boolean") patch[meta.key] = val;
  }

  try {
    const flags = await updateFeatureFlags(patch);
    return Response.json({ ok: true, flags });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
