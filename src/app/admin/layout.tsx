import type { ReactNode } from "react";
import { IdleTimeout } from "@/components/ng/admin/idle-timeout";
import { AuthenticatorEnrollPrompt } from "@/components/ng/admin/authenticator-enroll-prompt";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // `.ng-admin` scopes the darker secondary/tertiary ink tokens (see
  // globals.css) to the whole operator surface — including the auth
  // screens — without touching the storefront's lighter typography.
  //
  // `IdleTimeout` is a client child mounted across the portal; it self-disables
  // on the auth screens and signs idle operators out (Feature #51).
  return (
    <div className="ng-admin">
      <IdleTimeout />
      <AuthenticatorEnrollPrompt />
      {children}
    </div>
  );
}
