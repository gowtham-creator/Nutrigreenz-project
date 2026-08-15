import type { ReactNode } from "react";
import { AdminSessionProvider } from "@/components/ng/admin/session-timer";
import { AdminThemeProvider, AdminThemeScript } from "@/lib/admin-theme";
import { AuthenticatorEnrollPrompt } from "@/components/ng/admin/authenticator-enroll-prompt";
import { PageTransition } from "@/components/ng/page-transition";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // `.ng-admin` scopes the darker secondary/tertiary ink tokens (see
  // globals.css) to the whole operator surface — including the auth
  // screens — without touching the storefront's lighter typography.
  //
  // `AdminSessionProvider` owns the idle deadline, the heartbeat that slides
  // the server session while the operator works, and the automatic sign-out. It
  // also publishes the remaining time so the header can show a countdown that
  // is the SAME clock — a timer displaying a different deadline from the one
  // that signs you out would be worse than no timer.
  return (
    /* `suppressHydrationWarning` is required, not defensive. The script below
       sets `data-theme` on this element before React hydrates, so the server
       HTML and the client DOM genuinely differ on that attribute — which is
       the entire point of a pre-paint theme script. The flag scopes the
       exemption to this element's attributes; children still get checked. */
    <div className="ng-admin" suppressHydrationWarning>
      {/* Runs before paint, inside .ng-admin so it can set the attribute on its
          own parent. Without it an operator on dark gets a full cream console
          until hydration, then a hard flip. */}
      <AdminThemeScript />
      <AuthenticatorEnrollPrompt />
      {/* Fades each route in. Wraps only the page content, so the session
          provider and the enrol prompt are not torn down and remounted on every
          navigation — remounting would reset the countdown on each click. */}
      <AdminThemeProvider>
        <AdminSessionProvider>
          <PageTransition>{children}</PageTransition>
        </AdminSessionProvider>
      </AdminThemeProvider>
    </div>
  );
}
