"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { Card } from "@/components/ng/admin/admin-shell";
import { SectionHeader } from "@/components/ng/admin/super/command-center";
import { AdminsManagement } from "@/components/ng/admin/super/admins-management";

/**
 * Super Admin · Roles & system activity (§3.1 / §3.2 access matrix).
 *
 * A read-only-ish governance view: the two platform roles and what each can
 * reach, the current admin roster, and a recent system activity log (config
 * changes + sign-ins). All rows are mocked for the demo — a real audit trail
 * and role mutations are not yet connected.
 */

/* ----------------------------------------------------------------------- */
/* Role definitions + capability matrix.                                    */
/* ----------------------------------------------------------------------- */
type RoleKey = "admin" | "superadmin";

const ROLES: {
  key: RoleKey;
  label: string;
  icon: string;
  blurb: string;
  tone: "forest" | "clay";
  can: string[];
}[] = [
  {
    key: "admin",
    label: "Admin",
    icon: "shield-keyhole-bold",
    blurb: "Day-to-day operations",
    tone: "forest",
    can: [
      "Orders, fulfilment & dispatch",
      "Catalogue & inventory",
      "Customers & offline onboarding",
      "Reports (view & CSV export)",
    ],
  },
  {
    key: "superadmin",
    label: "Super Admin",
    icon: "admin",
    blurb: "Full platform control",
    tone: "clay",
    can: [
      "Everything an Admin can do",
      "Global commerce rules, loyalty & coupons",
      "Referral settings & feature toggles",
      "Role management & system logs",
    ],
  },
];

/* ----------------------------------------------------------------------- */
/* System activity feed (real — sourced from /api/admin/activity).          */
/* ----------------------------------------------------------------------- */

/** One activity row, as returned by the activity API. */
interface ActivityRow {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

type LogKind = "auth" | "create" | "update" | "remove";

/** Visual treatment per activity kind, reusing the existing log styling. */
const LOG_META: Record<LogKind, { icon: string; label: string; cls: string }> = {
  auth: { icon: "signin", label: "Sign-in", cls: "bg-ng-clay/15 text-ng-clay-deep" },
  create: { icon: "user-plus-bold", label: "Admin", cls: "bg-ng-forest/12 text-ng-forest" },
  update: { icon: "settings", label: "Admin", cls: "bg-ng-forest/12 text-ng-forest" },
  remove: { icon: "trash-bin-trash-bold", label: "Admin", cls: "bg-ng-clay/15 text-ng-clay-deep" },
};

/** Map a stored `action` to its display kind. */
function logKind(action: string): LogKind {
  if (action === "admin.signin") return "auth";
  if (action === "admin.create") return "create";
  if (action === "admin.delete") return "remove";
  return "update";
}

/** A short, human-readable summary for an activity row. */
function describe(row: ActivityRow): string {
  const method = typeof row.meta?.method === "string" ? row.meta.method : null;
  switch (row.action) {
    case "admin.signin":
      return method ? `Signed in (${method})` : "Signed in";
    case "admin.create":
      return `Added admin ${row.target ?? ""}`.trim();
    case "admin.update":
      return `Updated admin ${row.target ?? ""}`.trim();
    case "admin.reset_password":
      return `Reset password for ${row.target ?? ""}`.trim();
    case "admin.delete":
      return `Removed admin ${row.target ?? ""}`.trim();
    default:
      return row.target ? `${row.action} · ${row.target}` : row.action;
  }
}

/** Compact relative time (e.g. "Just now", "12m ago", "2h ago", "3d ago"). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function RolesAndLogs() {
  const [log, setLog] = React.useState<ActivityRow[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/activity");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { activity?: ActivityRow[] };
        if (alive) setLog(Array.isArray(data.activity) ? data.activity : []);
      } catch {
        if (alive) setLog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="access" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="shield-user-bold"
          tone="clay"
          title="Roles & activity"
          caption="What each role can access, the admin roster and recent system activity."
          badge={<span className="ng-eyebrow">§3.1</span>}
        />

        {/* ---- Role capability matrix ------------------------------------ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {ROLES.map((r) => (
            <div
              key={r.key}
              className={cn(
                "h-full rounded-2xl border p-4",
                r.tone === "clay"
                  ? "border-ng-clay/30 bg-ng-clay/[0.05]"
                  : "border-ng-line-soft bg-ng-cream/40",
              )}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className={cn(
                    "grid place-items-center size-9 rounded-xl ring-1",
                    r.tone === "clay"
                      ? "bg-ng-clay/15 text-ng-clay-deep ring-ng-clay/25"
                      : "bg-ng-forest/12 text-ng-forest ring-ng-forest/15",
                  )}
                >
                  {/* The role list holds Solar names for the lesser roles and a
                      UiIcon name for super admin. Rendering everything through
                      <Icon> would leave the super-admin badge blank — the name
                      resolves to no Solar glyph and fails silently. */}
                  {r.icon === "admin" ? (
                    <UiIcon name="admin" size={18} />
                  ) : (
                    <Icon name={r.icon} size={18} />
                  )}
                </span>
                <div>
                  <div className="font-display text-[15.5px] text-ng-forest-deep leading-tight">{r.label}</div>
                  <div className="text-[11.5px] font-medium text-ng-ink-muted">{r.blurb}</div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {r.can.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-[12.5px] font-medium text-ng-ink-muted">
                    <UiIcon
                      name="verified"
                      size={14}
                      className={cn("mt-0.5 shrink-0", r.tone === "clay" ? "text-ng-clay-deep" : "text-ng-forest")}
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---- Admin roster (interactive) — invite + per-row actions ----- */}
        <AdminsManagement />

        {/* ---- System activity log (real feed) --------------------------- */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] font-semibold text-ng-ink-muted flex items-center gap-2">
              <UiIcon name="audit" size={16} className="text-ng-forest" />
              System activity
            </span>
            <span className="text-[11.5px] font-medium text-ng-ink-soft font-mono">Recent · sign-ins &amp; admin changes</span>
          </div>

          {log === null ? (
            <p className="py-6 text-center text-[12.5px] font-medium text-ng-ink-soft">Loading activity…</p>
          ) : log.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] font-medium text-ng-ink-soft">
              No activity recorded yet.
            </p>
          ) : (
            <ol className="relative pl-1">
              {log.map((e) => {
                const meta = LOG_META[logKind(e.action)];
                return (
                  <li key={e.id} className="flex items-start gap-3 py-2.5 border-b border-ng-line-soft last:border-0">
                    <span className={cn("grid place-items-center size-8 rounded-lg shrink-0 mt-0.5", meta.cls)}>
                      {meta.icon === "admin" ? (
                        <UiIcon name="admin" size={15} />
                      ) : (
                        <Icon name={meta.icon} size={15} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted font-mono">{meta.label}</span>
                        <span className="font-mono text-[11.5px] font-medium text-ng-ink-muted truncate">{e.actorEmail ?? "—"}</span>
                      </div>
                      <p className="text-[13px] font-medium text-ng-ink mt-0.5">{describe(e)}</p>
                    </div>
                    <span className="text-[11.5px] font-medium text-ng-ink-soft tabular-nums shrink-0 mt-0.5">{relativeTime(e.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="text-[11.5px] font-medium text-ng-ink-soft mt-4 flex items-center gap-1.5">
            <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
            Live log of admin sign-ins and roster changes.
          </p>
        </div>
      </Card>
    </section>
  );
}
