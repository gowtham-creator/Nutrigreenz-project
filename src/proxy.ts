import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";

/**
 * Host-aware admin guard + subdomain router (Next.js 16 Proxy).
 *
 * Two ways to reach the operator portal, ONE codebase:
 *   1. Path-based on the main domain — `store.com/admin/*`.
 *   2. Subdomain — `admin.store.com/*`, where every clean path is rewritten to
 *      the underlying `/admin/*` route (e.g. `admin.store.com/orders` →
 *      `/admin/orders`, `admin.store.com/` → `/admin`).
 *
 * Either way the route is protected by the SIGNED, httpOnly session cookie
 * (`ng_admin`), verified with Web Crypto HMAC (`verifyToken`) so a forged or
 * presence-only cookie cannot grant access. `verifyToken` is pure Web Crypto
 * (no `next/headers` / `node:crypto`), safe on the Edge runtime. It now returns
 * the decoded `{ email, role }` session (or null), so the role is enforced from
 * the tamper-proof signed token, never from the readable role cookie.
 *
 * Role gate: the global config / control center at `/admin/config` (and any
 * sub-path) is SUPER-ADMIN ONLY. Authenticated non-superadmins are redirected
 * to the dashboard (`/admin`, or `/` on the admin subdomain).
 *
 * `/api/*`, `/_next/*` and any path with a file extension are excluded by the
 * matcher, so API routes (incl. `/api/admin/login`) and static assets are
 * served directly on every host.
 */
const ADMIN_HOST_PREFIX = "admin.";

/** Super-admin-only route prefix (the global config / control center). */
const SUPERADMIN_ROUTE_PREFIX = "/admin/config";

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = req.headers.get("host") ?? "";
  const isAdminHost = host.startsWith(ADMIN_HOST_PREFIX);

  // Resolve the underlying /admin/* route this request maps to (if any).
  let adminRoute: string | null = null;
  if (isAdminHost) {
    adminRoute =
      path === "/" ? "/admin" : path.startsWith("/admin") ? path : `/admin${path}`;
  } else if (path.startsWith("/admin")) {
    adminRoute = path;
  }

  // Not an admin request → leave the storefront completely untouched.
  if (!adminRoute) return NextResponse.next();

  const isLogin = adminRoute === "/admin/login";
  // Pre-login pages reachable WITHOUT a session (sign-in + password recovery).
  const isPublicAdmin = isLogin || adminRoute === "/admin/forgot";
  const session = await verifyToken(req.cookies.get(ADMIN_COOKIE)?.value);

  // Unauthenticated → bounce to login on the SAME host, remembering the target.
  if (!isPublicAdmin && !session) {
    const url = new URL(isAdminHost ? "/login" : "/admin/login", req.nextUrl);
    url.searchParams.set("next", isAdminHost ? path : adminRoute);
    return NextResponse.redirect(url);
  }

  // Already authed and sitting on a pre-login page → send to the dashboard.
  if (isPublicAdmin && session) {
    return NextResponse.redirect(new URL(isAdminHost ? "/" : "/admin", req.nextUrl));
  }

  // Role gate: the config / control center is super-admin only. An authenticated
  // non-superadmin hitting /admin/config (or a sub-path) is sent to the dashboard.
  if (
    session &&
    session.role !== "superadmin" &&
    (adminRoute === SUPERADMIN_ROUTE_PREFIX ||
      adminRoute.startsWith(`${SUPERADMIN_ROUTE_PREFIX}/`))
  ) {
    return NextResponse.redirect(new URL(isAdminHost ? "/" : "/admin", req.nextUrl));
  }

  // On the subdomain, rewrite the clean URL to the real /admin/* route.
  if (isAdminHost) {
    const rewritten = req.nextUrl.clone();
    rewritten.pathname = adminRoute;
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
}

export const config = {
  // Run on page routes for every host (needed so the admin subdomain can
  // rewrite `/`, `/orders`, … to `/admin/*`). Excludes API routes, Next
  // internals, and any path with a file extension (static assets).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
