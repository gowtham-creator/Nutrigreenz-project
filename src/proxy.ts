import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

/**
 * Admin route guard (Next.js 16 Proxy — formerly Middleware).
 *
 * Protects every `/admin/*` route behind the demo admin session cookie
 * (`ng_admin`), while always allowing `/admin/login` so an unauthenticated
 * operator can reach the sign-in screen. Unauthenticated visits to a guarded
 * route are redirected to `/admin/login?next=<path>` so we can bounce back
 * after sign-in. Visiting `/admin/login` while already authed sends the
 * operator straight to the dashboard.
 */
export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdmin = path.startsWith("/admin");
  const isLogin = path === "/admin/login";
  const authed = req.cookies.get(ADMIN_COOKIE)?.value;

  if (isAdmin && !isLogin && !authed) {
    const url = new URL("/admin/login", req.nextUrl);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isLogin && authed) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
