/**
 * Per-admin portal permissions — the single source of truth for WHICH admin
 * portal sections an operator may access.
 *
 * This module is intentionally PURE and isomorphic: no `server-only`, no DB, no
 * `next/*` imports. It is safe to import from BOTH the Edge/client (the admin
 * shell filters its nav with it) and Node server code (the `/api/admin/me`
 * route and the per-page guard resolve effective permissions with it).
 *
 * Model
 * -----
 *  · One permission KEY per portal section (they mirror the `admin-shell` NAV).
 *  · A super-admin ALWAYS holds every permission — never editable, never stored.
 *  · A plain admin holds either the STORED set (from `admins.permissions`) or,
 *    when nothing is stored (NULL / empty — the back-compat case), the DEFAULT
 *    admin set below.
 *  · `overview` is ALWAYS granted, so no admin is ever locked out of the portal.
 */

import type { AdminRole } from "@/lib/admin-session";

/** Every portal section key, in nav order. The tuple drives the `PermissionKey`
 *  union AND the stable ordering used when persisting / rendering the catalogue. */
export const ADMIN_PERMISSION_KEYS = [
  "overview",
  "catalog",
  "orders",
  "marketing",
  "reports",
  "analytics",
  "referrals",
  "customers",
  "captains",
  "people",
  "wishlists",
  "journal",
  "farms",
  "audit",
  "config",
] as const;

export type PermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

/** The overview dashboard is always reachable — it is the safe redirect target
 *  for a denied section, so it can never itself be gated (no lockouts). */
export const ALWAYS_GRANTED: PermissionKey = "overview";

/** One catalogue entry per section: the key, a human label + description for the
 *  permissions UI, the nav icon (reused so the picker matches the sidebar), and
 *  two UI hints — `sensitive` (defaults OFF for plain admins) and `superOnly`
 *  (the section is additionally gated to super-admins by the Edge proxy). */
export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  icon: string;
  /** Defaults OFF for a plain admin (must be granted explicitly). */
  sensitive?: boolean;
  /** Also hard-gated to super-admins by the Edge proxy / API guards. */
  superOnly?: boolean;
}

/** The permission catalogue — the one place sections are defined. */
export const ADMIN_PERMISSIONS: readonly PermissionDef[] = [
  {
    key: "overview",
    label: "Overview",
    description: "The operator dashboard — KPIs, the order pipeline and recent activity. Always available.",
    icon: "widget-5-bold",
  },
  {
    key: "catalog",
    label: "Catalog",
    description: "Products, pricing, stock levels and variants.",
    icon: "bag-4-bold",
  },
  {
    key: "orders",
    label: "Orders",
    description: "View and advance customer orders and bundles.",
    icon: "clipboard-list-bold",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Coupons, promotions and storefront announcements.",
    icon: "speaker-bold",
    superOnly: true,
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales, revenue and coupon reporting.",
    icon: "chart-2-bold",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Product demand signals and the customer sign-in mix.",
    icon: "chart-square-bold",
  },
  {
    key: "referrals",
    label: "Referrals",
    description: "The referral programme — who referred whom, and the rewards paid out.",
    icon: "users-group-rounded-bold",
  },
  {
    key: "customers",
    label: "Customers",
    description: "The deduped customer directory.",
    icon: "user-rounded-bold",
  },
  {
    key: "captains",
    label: "Captains",
    description: "Field-sales captains — the roster, their stall sales, settlements and pickups.",
    icon: "map-point-bold",
  },
  {
    key: "people",
    label: "People & access",
    description: "The admin roster and role/capability matrix. Managing admins stays super-admin only.",
    icon: "users-group-rounded-bold",
    sensitive: true,
    superOnly: true,
  },
  {
    key: "wishlists",
    label: "Wishlists",
    description: "Customer-saved products as a restock / demand signal.",
    icon: "heart-bold",
  },
  {
    key: "journal",
    label: "Journal",
    description: "The storefront Journal editorial content.",
    icon: "notebook-bold",
  },
  {
    key: "farms",
    label: "Farms",
    description: "The storefront Farms directory.",
    icon: "leaf-bold",
  },
  {
    key: "audit",
    label: "Audit log",
    description: "The completed-action trail for the whole team.",
    icon: "history-2-bold",
  },
  {
    key: "config",
    label: "Config",
    description: "The Super Admin control center — commerce rules, delivery, loyalty. Stays super-admin only.",
    icon: "settings-bold",
    sensitive: true,
    superOnly: true,
  },
];

/**
 * The default grant for a plain admin: EVERY section except the sensitive ones
 * (`people`, `config`), which must be granted explicitly. `overview` is always
 * present. This is the set applied when an admin has nothing stored (back-compat
 * for every admin that predates the permissions column).
 */
export const DEFAULT_ADMIN_PERMISSIONS: readonly PermissionKey[] = ADMIN_PERMISSION_KEYS.filter(
  (k) => {
    const def = ADMIN_PERMISSIONS.find((p) => p.key === k);
    return !def?.sensitive;
  },
);

/** Narrow an arbitrary value to a known permission key. */
export function isPermissionKey(value: unknown): value is PermissionKey {
  return (
    typeof value === "string" &&
    (ADMIN_PERMISSION_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Resolve the EFFECTIVE permission set for an operator.
 *  · super-admin  → ALL keys (stored value is irrelevant).
 *  · admin        → the stored keys, or the DEFAULT set when nothing is stored
 *                   (NULL / empty — the back-compat case).
 * `overview` is always included, so the result can never lock an admin out.
 */
export function resolvePermissions(
  role: AdminRole,
  stored: readonly string[] | null | undefined,
): Set<PermissionKey> {
  if (role === "superadmin") return new Set(ADMIN_PERMISSION_KEYS);
  const base =
    stored && stored.length > 0
      ? stored.filter(isPermissionKey)
      : DEFAULT_ADMIN_PERMISSIONS;
  const set = new Set<PermissionKey>(base);
  set.add(ALWAYS_GRANTED);
  return set;
}

/** Whether the operator may access a given section. */
export function hasPermission(
  role: AdminRole,
  stored: readonly string[] | null | undefined,
  key: PermissionKey,
): boolean {
  return resolvePermissions(role, stored).has(key);
}

/** The effective permissions as a stable, catalogue-ordered array (for JSON). */
export function permissionList(
  role: AdminRole,
  stored: readonly string[] | null | undefined,
): PermissionKey[] {
  const set = resolvePermissions(role, stored);
  return ADMIN_PERMISSION_KEYS.filter((k) => set.has(k));
}

/**
 * Sanitise a client-supplied permissions payload down to known keys before it
 * is persisted — NEVER trust the request body. `overview` is always kept, so a
 * stored grant is self-describing and an admin is never left without the safe
 * landing section. Returned in stable catalogue order.
 */
export function sanitizePermissions(input: unknown): PermissionKey[] {
  const set = new Set<PermissionKey>();
  if (Array.isArray(input)) {
    for (const v of input) if (isPermissionKey(v)) set.add(v);
  }
  set.add(ALWAYS_GRANTED);
  return ADMIN_PERMISSION_KEYS.filter((k) => set.has(k));
}
