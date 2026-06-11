import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // `.ng-admin` scopes the darker secondary/tertiary ink tokens (see
  // globals.css) to the whole operator surface — including the auth
  // screens — without touching the storefront's lighter typography.
  return <div className="ng-admin">{children}</div>;
}
