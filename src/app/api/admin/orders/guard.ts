/**
 * Admin gate for the Orders Portal API. Re-exports the shared inventory guard so
 * every admin route uses one cookie + `verifyToken` implementation. Any signed-in
 * admin OR superadmin may view and advance orders — the Orders Portal is not
 * super-admin-only (mirroring `/admin/orders` not being in the proxy's
 * SUPERADMIN_ROUTE_PREFIXES). Money-touching actions (e.g. a future refund) would
 * gate on {@link isSuperAdmin}.
 */
export { isSignedInAdmin, isSuperAdmin } from "@/app/api/admin/inventory/guard";
