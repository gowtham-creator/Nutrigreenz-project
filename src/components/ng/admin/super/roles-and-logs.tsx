"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { SectionHeader } from "@/components/ng/admin/super/command-center";

/**
 * Super Admin · Roles & system activity (§3.1 / §3.2 access matrix).
 *
 * A read-only-ish governance view: the two platform roles and what each can
 * reach, the current admin roster, and a recent system activity log (config
 * changes + sign-ins). All rows are mocked for the demo — a real audit trail
 * and role mutations land in Milestone 2.
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
    icon: "crown-bold",
    blurb: "Full platform control",
    tone: "clay",
    can: [
      "Everything an Admin can do",
      "Global commerce rules, loyalty & coupons",
      "Referral config & feature toggles",
      "Role management & system logs",
    ],
  },
];

/* ----------------------------------------------------------------------- */
/* Mock admin roster.                                                       */
/* ----------------------------------------------------------------------- */
const ADMINS: { name: string; email: string; role: RoleKey; lastActive: string; status: "active" | "invited" }[] = [
  { name: "Owner", email: "admin@nutrigreenz.in", role: "superadmin", lastActive: "Just now", status: "active" },
  { name: "Priya Nair", email: "priya@nutrigreenz.in", role: "admin", lastActive: "2h ago", status: "active" },
  { name: "Rahul Verma", email: "rahul@nutrigreenz.in", role: "admin", lastActive: "Yesterday", status: "active" },
  { name: "Ops Desk", email: "ops@nutrigreenz.in", role: "admin", lastActive: "—", status: "invited" },
];

/* ----------------------------------------------------------------------- */
/* Mock activity log.                                                       */
/* ----------------------------------------------------------------------- */
type LogKind = "config" | "auth" | "campaign" | "toggle";

const LOG: { kind: LogKind; actor: string; action: string; when: string }[] = [
  { kind: "config", actor: "admin@nutrigreenz.in", action: "Updated commerce rules — free-delivery ≥ ₹599", when: "Just now" },
  { kind: "campaign", actor: "admin@nutrigreenz.in", action: "Created coupon campaign FRESH50 (specific customers)", when: "12m ago" },
  { kind: "config", actor: "admin@nutrigreenz.in", action: "Set loyalty earn ratio to 1 pt/₹", when: "1h ago" },
  { kind: "auth", actor: "priya@nutrigreenz.in", action: "Signed in from Hyderabad", when: "2h ago" },
  { kind: "toggle", actor: "admin@nutrigreenz.in", action: "Enabled Referrals feature toggle", when: "Yesterday" },
  { kind: "auth", actor: "rahul@nutrigreenz.in", action: "Signed in from Madhapur, Hyderabad", when: "Yesterday" },
];

const LOG_META: Record<LogKind, { icon: string; label: string; cls: string }> = {
  config: { icon: "tuning-2-bold", label: "Config", cls: "bg-ng-forest/12 text-ng-forest" },
  auth: { icon: "login-3-bold", label: "Sign-in", cls: "bg-ng-clay/15 text-ng-clay-deep" },
  campaign: { icon: "ticket-sale-bold", label: "Campaign", cls: "bg-ng-forest/12 text-ng-forest" },
  toggle: { icon: "bolt-bold", label: "Toggle", cls: "bg-ng-clay/15 text-ng-clay-deep" },
};

export function RolesAndLogs() {
  return (
    <section id="access" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="shield-user-bold"
          tone="clay"
          title="Roles & activity"
          caption="Who can reach what, the admin roster, and a recent system activity trail."
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
                  <Icon name={r.icon} size={18} />
                </span>
                <div>
                  <div className="font-display text-[15.5px] text-ng-forest-deep leading-tight">{r.label}</div>
                  <div className="text-[11.5px] text-ng-ink-soft">{r.blurb}</div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {r.can.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-[12.5px] text-ng-ink-muted">
                    <Icon
                      name="check-circle-bold"
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

        {/* ---- Admin roster ---------------------------------------------- */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] font-semibold text-ng-ink-muted flex items-center gap-2">
              <Icon name="users-group-rounded-bold" size={16} className="text-ng-forest" />
              Admin users
            </span>
            <span className="text-[11px] text-ng-ink-soft font-mono">{ADMINS.length} accounts · read-only</span>
          </div>
          <div className="grid grid-cols-[1.4fr_1.8fr_1fr_0.9fr] gap-3 px-1 pb-2 mb-1 border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span className="text-right">Last active</span>
          </div>
          <ul>
            {ADMINS.map((a) => (
              <li
                key={a.email}
                className="grid grid-cols-[1.4fr_1.8fr_1fr_0.9fr] gap-3 px-1 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="grid place-items-center size-7 rounded-full bg-ng-forest/10 text-ng-forest text-[11px] font-bold shrink-0">
                    {a.name.charAt(0)}
                  </span>
                  <span className="font-medium truncate">{a.name}</span>
                  {a.status === "invited" ? <Pill tone="neutral">Invited</Pill> : null}
                </span>
                <span className="font-mono text-[12px] text-ng-ink-muted truncate">{a.email}</span>
                <span>
                  {a.role === "superadmin" ? (
                    <Pill tone="warn">Super Admin</Pill>
                  ) : (
                    <Pill tone="info">Admin</Pill>
                  )}
                </span>
                <span className="text-right text-[12px] text-ng-ink-soft tabular-nums">{a.lastActive}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- System activity log --------------------------------------- */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] font-semibold text-ng-ink-muted flex items-center gap-2">
              <Icon name="history-bold" size={16} className="text-ng-forest" />
              System activity
            </span>
            <span className="text-[11px] text-ng-ink-soft font-mono">Recent · mock trail</span>
          </div>
          <ol className="relative pl-1">
            {LOG.map((e, i) => {
              const meta = LOG_META[e.kind];
              return (
                <li key={i} className="flex items-start gap-3 py-2.5 border-b border-ng-line-soft last:border-0">
                  <span className={cn("grid place-items-center size-8 rounded-lg shrink-0 mt-0.5", meta.cls)}>
                    <Icon name={meta.icon} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-ng-ink-soft font-mono">{meta.label}</span>
                      <span className="font-mono text-[11.5px] text-ng-ink-muted truncate">{e.actor}</span>
                    </div>
                    <p className="text-[13px] text-ng-ink mt-0.5">{e.action}</p>
                  </div>
                  <span className="text-[11.5px] text-ng-ink-soft tabular-nums shrink-0 mt-0.5">{e.when}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-[11.5px] text-ng-ink-soft mt-4 flex items-center gap-1.5">
            <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
            Read-only demo — a persisted audit trail &amp; role editing ship in Milestone 2.
          </p>
        </div>
      </Card>
    </section>
  );
}
