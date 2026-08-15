"use client";

/**
 * /admin/audit — the Audit Log.
 *
 * A clean, scannable trail of every COMPLETED admin operation, newest first and
 * grouped by day. Both Admin and Super Admin can open it (it is NOT super-admin
 * gated) to answer, at a glance, "did I actually make that change — or not?".
 *
 * Data is real: `GET /api/admin/activity` reads the `admin_activity` table via
 * the service-role client and returns `{ activity, viewer }`. The `viewer` is
 * the signed-in caller, so their own rows read as "You …". The feed stays live
 * without jarring reloads — it polls every ~20s (and on window focus/visibility)
 * and MERGES new rows in by id rather than replacing the list. Every stored row
 * is a finished action, so each carries a subtle green "Done" affirmation.
 *
 * Filtering (Mine/Everyone, action-type, text search) is client-side for instant
 * response; only the Mine/Everyone toggle and row limit hit the server.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import { getAdminEmail, getAdminRole, type AdminRole } from "@/lib/admin-auth";

/* ----------------------------------------------------------------------- */
/* Types                                                                    */
/* ----------------------------------------------------------------------- */

/** One activity row, as returned by `/api/admin/activity`. Kept local so this
 *  client component never imports the `server-only` activity-log module. */
interface AuditEntry {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityResponse {
  ok?: boolean;
  activity?: AuditEntry[];
  viewer?: { email: string | null; role: AdminRole | null };
}

type Tone = "forest" | "success" | "clay" | "terracotta" | "muted";
type GroupKey =
  | "signin"
  | "admins"
  | "account"
  | "announcements"
  | "promotions"
  | "coupons"
  | "broadcast"
  | "other";

interface ActionMeta {
  group: GroupKey;
  /** Short kind tag shown on the row, e.g. "Announcement". */
  kind: string;
  /** Solar icon name for the row chip. */
  icon: string;
  tone: Tone;
}

/* ----------------------------------------------------------------------- */
/* Action label + icon + tone map                                          */
/* Covers every `action:` string passed to logActivity() across the app.   */
/* Unknown actions fall back gracefully (humanised label + neutral chip).   */
/* ----------------------------------------------------------------------- */

const ACTION_META: Record<string, ActionMeta> = {
  // Authentication
  "admin.signin": { group: "signin", kind: "Sign-in", icon: "login-3-bold", tone: "clay" },
  // Admin-user management (Super Admin)
  "admin.create": { group: "admins", kind: "Admin", icon: "user-plus-bold", tone: "forest" },
  "admin.update": { group: "admins", kind: "Admin", icon: "pen-2-bold", tone: "forest" },
  "admin.reset_password": { group: "admins", kind: "Admin", icon: "key-minimalistic-bold", tone: "clay" },
  "admin.delete": { group: "admins", kind: "Admin", icon: "trash-bin-trash-bold", tone: "terracotta" },
  // The operator's own account & security
  "admin.profile_update": { group: "account", kind: "Account", icon: "customer", tone: "muted" },
  "admin.totp_enrolled": { group: "account", kind: "Security", icon: "shield-check-bold", tone: "forest" },
  "admin.photo_update": { group: "account", kind: "Account", icon: "camera-bold", tone: "muted" },
  "admin.photo_remove": { group: "account", kind: "Account", icon: "camera-bold", tone: "muted" },
  // Marketing · announcements
  "announcement.create": { group: "announcements", kind: "Announcement", icon: "bell-bold", tone: "forest" },
  "announcement.update": { group: "announcements", kind: "Announcement", icon: "bell-bold", tone: "forest" },
  "announcement.delete": { group: "announcements", kind: "Announcement", icon: "bell-bold", tone: "terracotta" },
  // Marketing · coupons
  "coupon.create": { group: "coupons", kind: "Coupon", icon: "ticket-sale-bold", tone: "forest" },
  "coupon.update": { group: "coupons", kind: "Coupon", icon: "ticket-sale-bold", tone: "forest" },
  "coupon.delete": { group: "coupons", kind: "Coupon", icon: "ticket-sale-bold", tone: "terracotta" },
  "coupon.deactivate": { group: "coupons", kind: "Coupon", icon: "ticket-sale-bold", tone: "clay" },
  // Marketing · promotions
  "promotion.create": { group: "promotions", kind: "Promotion", icon: "tag-price-bold", tone: "forest" },
  "promotion.update": { group: "promotions", kind: "Promotion", icon: "tag-price-bold", tone: "forest" },
  "promotion.delete": { group: "promotions", kind: "Promotion", icon: "tag-price-bold", tone: "terracotta" },
  // Marketing · broadcast
  "marketing.broadcast": { group: "broadcast", kind: "Broadcast", icon: "chat-round-dots-bold", tone: "forest" },
};

const FALLBACK_META: ActionMeta = {
  group: "other",
  kind: "Activity",
  icon: "audit",
  tone: "muted",
};

const TONE_CHIP: Record<Tone, string> = {
  forest: "bg-ng-forest/12 text-ng-forest",
  success: "bg-ng-success/15 text-ng-success",
  clay: "bg-ng-clay/25 text-ng-clay-deep",
  terracotta: "bg-ng-terracotta/15 text-ng-terracotta",
  muted: "bg-ng-line-soft text-ng-ink-muted",
};

const GROUP_ORDER: GroupKey[] = [
  "signin",
  "admins",
  "account",
  "announcements",
  "promotions",
  "coupons",
  "broadcast",
  "other",
];

const GROUP_LABELS: Record<GroupKey, string> = {
  signin: "Sign-ins",
  admins: "Admin users",
  account: "Account & security",
  announcements: "Announcements",
  promotions: "Promotions",
  coupons: "Coupons",
  broadcast: "Broadcasts",
  other: "Other",
};

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */

function metaOf(action: string): ActionMeta {
  return ACTION_META[action] ?? FALLBACK_META;
}

function metaStr(meta: Record<string, unknown> | null, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v : null;
}
function metaBool(meta: Record<string, unknown> | null, key: string): boolean | null {
  const v = meta?.[key];
  return typeof v === "boolean" ? v : null;
}
function metaArr(meta: Record<string, unknown> | null, key: string): string[] {
  const v = meta?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Derive a friendly first-name-ish subject from an email local part. */
function actorName(email: string | null): string {
  if (!email) return "Someone";
  const local = email.split("@")[0] ?? email;
  const words = local.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const cased = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return cased || email;
}

interface Described {
  meta: ActionMeta;
  subject: string;
  isSelf: boolean;
  /** Past-tense phrase WITHOUT the subject, e.g. "created a coupon". */
  phrase: string;
  /** Named object of the action (email / code / slug), or null. */
  target: string | null;
  /** Optional muted trailing detail, e.g. "via passcode". */
  detail: string | null;
}

/**
 * Turn a stored row into a human sentence: subject + past-tense verb phrase,
 * plus the named target and an optional detail. Every entry is a completed op.
 */
function describe(entry: AuditEntry, viewerEmail: string | null): Described {
  const meta = metaOf(entry.action);
  const isSelf = Boolean(
    viewerEmail && entry.actorEmail && entry.actorEmail.toLowerCase() === viewerEmail.toLowerCase(),
  );
  const subject = isSelf ? "You" : actorName(entry.actorEmail);
  // Surface the target only when it names something OTHER than the actor (own
  // sign-ins / profile / photo edits store the actor's own email as target).
  const namedTarget =
    entry.target && entry.target !== entry.actorEmail ? entry.target : null;

  let phrase: string;
  let detail: string | null = null;
  let target: string | null = namedTarget;

  switch (entry.action) {
    case "admin.signin": {
      const method = metaStr(entry.meta, "method");
      phrase = "signed in";
      detail = method ? `via ${method}` : null;
      target = null;
      break;
    }
    case "admin.create":
      phrase = "added an admin";
      break;
    case "admin.update": {
      const changed = metaArr(entry.meta, "changed").length;
      phrase = "updated an admin";
      detail = changed ? `${changed} field${changed === 1 ? "" : "s"}` : null;
      break;
    }
    case "admin.reset_password":
      phrase = "reset an admin’s password";
      break;
    case "admin.delete":
      phrase = "removed an admin";
      break;
    case "admin.profile_update":
      phrase = "updated their profile";
      target = null;
      break;
    case "admin.totp_enrolled":
      phrase = "turned on two-factor auth";
      target = null;
      break;
    case "admin.photo_update":
      phrase = "updated their photo";
      target = null;
      break;
    case "admin.photo_remove":
      phrase = "removed their photo";
      target = null;
      break;
    case "announcement.create":
      phrase = "posted an announcement";
      break;
    case "announcement.update":
      phrase = metaBool(entry.meta, "active") === false ? "paused an announcement" : "updated an announcement";
      break;
    case "announcement.delete":
      phrase = "deleted an announcement";
      break;
    case "coupon.create":
      phrase = "created a coupon";
      break;
    case "coupon.update":
      phrase = "updated a coupon";
      break;
    case "coupon.delete":
      phrase = "deleted a coupon";
      break;
    case "coupon.deactivate":
      phrase = "deactivated a coupon";
      break;
    case "promotion.create":
      phrase = "launched a promotion";
      break;
    case "promotion.update":
      phrase = metaBool(entry.meta, "active") === false ? "paused a promotion" : "updated a promotion";
      break;
    case "promotion.delete":
      phrase = "deleted a promotion";
      break;
    case "marketing.broadcast": {
      const type = metaStr(entry.meta, "type") ?? "message";
      const channels = metaArr(entry.meta, "channels");
      phrase = `broadcast a ${type}`;
      detail = channels.length ? `on ${channels.join(", ")}` : null;
      target = null;
      break;
    }
    default:
      phrase = entry.action.replace(/[._-]+/g, " ").trim() || "recorded activity";
      break;
  }

  return { meta, subject, isSelf, phrase, target, detail };
}

/** Compact relative time — "Just now", "12m ago", "2h ago", "3d ago", then date. */
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

/** Full timestamp for the `title` tooltip, e.g. "14 Jul 2026, 12:36 am". */
function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** Day bucket label: "Today" / "Yesterday" / "14 Jul 2026". */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface DaySection {
  key: string;
  label: string;
  items: AuditEntry[];
}

/** Group an already-sorted (desc) list into consecutive day sections. */
function groupByDay(items: AuditEntry[]): DaySection[] {
  const out: DaySection[] = [];
  let current: DaySection | null = null;
  for (const e of items) {
    const d = new Date(e.createdAt);
    const key = Number.isNaN(d.getTime()) ? "unknown" : d.toDateString();
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(e.createdAt), items: [] };
      out.push(current);
    }
    current.items.push(e);
  }
  return out;
}

/** Merge incoming rows into the existing list by id, newest first, capped. */
function mergeEntries(prev: AuditEntry[], incoming: AuditEntry[]): AuditEntry[] {
  const byId = new Map<string, AuditEntry>();
  for (const e of prev) byId.set(e.id, e);
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
}

/* ----------------------------------------------------------------------- */
/* Presentational pieces                                                    */
/* ----------------------------------------------------------------------- */

function RoleChip({ role }: { role: string | null }) {
  if (role !== "admin" && role !== "superadmin") return null;
  return <Pill tone={role === "superadmin" ? "warn" : "info"}>{role === "superadmin" ? "Super" : "Admin"}</Pill>;
}

function ActivityRow({ entry, viewerEmail }: { entry: AuditEntry; viewerEmail: string | null }) {
  const d = describe(entry, viewerEmail);
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-1 py-3 transition-colors",
        // Highlight the operator's own events with an inset left rule rather than
        // a real border. A bordered row with a negative margin sat 1px outside
        // its container, so the right edge overhung the card and the rounding
        // broke where consecutive rows met.
        d.isSelf &&
          "rounded-xl bg-ng-forest/[0.025] pl-3 shadow-[inset_2px_0_0_0_var(--ng-forest)]",
      )}
    >
      <span className={cn("grid place-items-center size-9 rounded-xl shrink-0 mt-0.5", TONE_CHIP[d.meta.tone])}>
        <Icon name={d.meta.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13.5px] leading-snug text-ng-ink">
            <span className={cn("font-semibold", d.isSelf ? "text-ng-forest-deep" : "text-ng-ink")}>{d.subject}</span>{" "}
            {d.phrase}
            {d.target ? (
              <span className="ml-1 inline-flex items-center rounded-md bg-ng-line-soft px-1.5 py-0.5 align-baseline font-mono text-[11.5px] text-ng-forest">
                {d.target}
              </span>
            ) : null}
          </p>
          <time
            dateTime={entry.createdAt}
            title={absoluteTime(entry.createdAt)}
            className="shrink-0 mt-0.5 text-[11.5px] font-medium text-ng-ink-soft tabular-nums cursor-default"
          >
            {relativeTime(entry.createdAt)}
          </time>
        </div>
        <div className="mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-ng-success/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ng-success">
            <Icon name="check-circle-bold" size={11} /> Done
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
            {d.meta.kind}
          </span>
          {!d.isSelf && entry.actorEmail ? (
            <span className="max-w-[180px] truncate font-mono text-[11.5px] text-ng-ink-soft">{entry.actorEmail}</span>
          ) : null}
          <RoleChip role={entry.actorRole} />
          {d.detail ? <span className="text-[11.5px] text-ng-ink-soft">· {d.detail}</span> : null}
        </div>
      </div>
    </li>
  );
}

function DayHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 px-1 pb-1 pt-5 first:pt-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{label}</h3>
      <span className="text-[11px] font-medium text-ng-ink-soft">
        {count} {count === 1 ? "event" : "events"}
      </span>
      <div className="h-px flex-1 bg-ng-line-soft" />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-1 py-3">
          <div className="size-9 shrink-0 rounded-xl bg-ng-line-soft" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-2/3 rounded bg-ng-line-soft" />
            <div className="h-3 w-1/3 rounded bg-ng-line-soft" />
          </div>
          <div className="h-3 w-12 rounded bg-ng-line-soft" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Page                                                                     */
/* ----------------------------------------------------------------------- */

const PILL_BTN =
  "inline-flex items-center gap-1.5 rounded-xl border border-ng-line-soft bg-ng-paper px-3 py-1.5 text-[12.5px] font-semibold text-ng-ink transition-colors hover:bg-ng-line-soft disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";
const SOLID_BTN =
  "inline-flex items-center gap-1.5 rounded-xl bg-ng-forest px-4 py-2 text-[12.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest-deep cursor-pointer";

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [viewer, setViewer] = useState<{ email: string | null; role: AdminRole | null }>({
    email: null,
    role: null,
  });
  const [mine, setMine] = useState(false);
  const [group, setGroup] = useState<"" | GroupKey>("");
  const [q, setQ] = useState("");
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [errored, setErrored] = useState(false);
  // A no-op counter whose only job is to re-render so relative times stay fresh
  // between network polls.
  const [, setTick] = useState(0);

  // Seed identity from the readable cookies for an instant "You" on first paint;
  // the API response then confirms it server-side.
  useEffect(() => {
    setViewer({ email: getAdminEmail(), role: getAdminRole() });
  }, []);

  const load = useCallback(
    async (mode: "replace" | "merge") => {
      setSyncing(true);
      try {
        const res = await fetch(`/api/admin/activity?limit=150${mine ? "&mine=1" : ""}`, {
          cache: "no-store",
        });
        const data: ActivityResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error("request failed");
        const incoming = Array.isArray(data.activity) ? data.activity : [];
        if (data.viewer && typeof data.viewer.email === "string") {
          setViewer({ email: data.viewer.email, role: data.viewer.role ?? null });
        }
        setEntries((prev) => (mode === "merge" && prev ? mergeEntries(prev, incoming) : incoming));
        setLastSynced(Date.now());
        setErrored(false);
      } catch {
        setErrored(true);
        setEntries((prev) => prev ?? null);
      } finally {
        setSyncing(false);
      }
    },
    [mine],
  );

  // Initial + on Mine/Everyone change: replace. Then poll every 20s and on focus
  // / tab-visibility, MERGING so the list never jarringly reloads. `load` is
  // keyed by `mine`, so switching scope re-runs this effect with fresh timers.
  useEffect(() => {
    void load("replace");
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load("merge");
    }, 20000);
    const onFocus = () => void load("merge");
    const onVisible = () => {
      if (document.visibilityState === "visible") void load("merge");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Keep relative timestamps ("2m ago") current even without a network poll.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const presentGroups = useMemo(() => {
    const s = new Set<GroupKey>();
    for (const e of entries ?? []) s.add(metaOf(e.action).group);
    return s;
  }, [entries]);

  const visible = useMemo(() => {
    let list = entries ?? [];
    if (group) list = list.filter((e) => metaOf(e.action).group === group);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((e) => {
        const d = describe(e, viewer.email);
        return [e.actorEmail, e.action, e.target, d.subject, d.phrase, d.detail, d.meta.kind]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    }
    return list;
  }, [entries, group, q, viewer.email]);

  const grouped = useMemo(() => groupByDay(visible), [visible]);

  const stats = useMemo(() => {
    const all = entries ?? [];
    const email = viewer.email?.toLowerCase() ?? null;
    const yours = email ? all.filter((e) => e.actorEmail?.toLowerCase() === email).length : 0;
    const people = new Set(all.map((e) => e.actorEmail).filter(Boolean)).size;
    return { total: all.length, yours, people };
  }, [entries, viewer.email]);

  const hasFilters = Boolean(group || q.trim() || mine);
  const clearFilters = () => {
    setGroup("");
    setQ("");
    setMine(false);
  };

  return (
    <AdminShell
      active="/admin/audit"
      title="Audit log"
      subtitle="Every completed admin action, newest first: confirm what went through, at a glance."
      actions={
        <div className="flex items-center gap-3">
          <span
            role="status"
            aria-live="polite"
            className="hidden text-[11.5px] font-medium text-ng-ink-soft tabular-nums sm:inline"
          >
            {syncing ? "Syncing…" : lastSynced ? `Synced ${relativeTime(new Date(lastSynced).toISOString())}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void load("merge")}
            disabled={syncing}
            aria-label="Refresh activity"
            className={PILL_BTN}
          >
            <Icon name="refresh-bold" size={15} className={cn(syncing && "animate-spin")} />
            Refresh
          </button>
        </div>
      }
    >
      {/* At-a-glance counts */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={mine ? "Your actions" : "Events loaded"} value={String(mine ? stats.yours : stats.total)} />
        <StatTile label="Your actions" value={String(stats.yours)} />
        <StatTile label={mine ? "Showing" : "People active"} value={String(mine ? visible.length : stats.people)} />
      </div>

      {/* Toolbar: scope · action type · search */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-3 md:flex-row md:items-center">
        <div
          role="group"
          aria-label="Whose activity to show"
          className="inline-flex rounded-xl border border-ng-line-soft bg-ng-cream/40 p-0.5"
        >
          {[
            { on: false, label: "Everyone", icon: "users-group-rounded-bold" },
            { on: true, label: "Mine only", icon: "customer" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={mine === opt.on}
              onClick={() => setMine(opt.on)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer",
                mine === opt.on ? "bg-ng-forest text-ng-cream" : "text-ng-ink-muted hover:text-ng-ink",
              )}
            >
              <Icon name={opt.icon} size={14} />
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            aria-label="Filter by action type"
            value={group}
            onChange={(e) => setGroup(e.target.value as "" | GroupKey)}
            className="w-full appearance-none rounded-xl border border-ng-line-soft bg-ng-paper py-2 pl-3 pr-9 text-[12.5px] font-semibold text-ng-ink transition-colors focus:border-ng-forest focus:outline-none cursor-pointer md:w-auto"
          >
            <option value="">All activity</option>
            {GROUP_ORDER.filter((g) => presentGroups.has(g)).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
          <Icon
            name="alt-arrow-down-bold"
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ng-ink-soft"
          />
        </div>

        <div className="relative flex-1 md:max-w-xs">
          <Icon
            name="magnifer-bold"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ng-ink-soft"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action or target…"
            aria-label="Search activity"
            className="w-full rounded-xl border border-ng-line-soft bg-ng-paper py-2 pl-9 pr-3 text-[13px] text-ng-ink transition-colors placeholder:text-ng-ink-soft focus:border-ng-forest focus:outline-none"
          />
        </div>
      </div>

      {/* The feed */}
      <Card
        title="Activity"
        action={<span className="text-[12px] font-medium text-ng-ink-soft">{visible.length} shown</span>}
      >
        {entries === null ? (
          <FeedSkeleton />
        ) : errored && entries.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-ng-cream text-ng-terracotta">
              <UiIcon name="caution" size={22} />
            </div>
            <p className="text-[14px] font-semibold text-ng-forest-deep">Couldn&rsquo;t load the audit trail</p>
            <p className="mt-1 text-[12.5px] text-ng-ink-soft">Check your connection and try again.</p>
            <button type="button" onClick={() => void load("replace")} className={cn(SOLID_BTN, "mt-4")}>
              <Icon name="refresh-bold" size={14} />
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-ng-forest/10 text-ng-forest">
              <UiIcon name="audit" size={22} />
            </div>
            <p className="text-[14px] font-semibold text-ng-forest-deep">
              {hasFilters ? "No activity matches your filters" : "No activity recorded yet"}
            </p>
            <p className="mt-1 text-[12.5px] text-ng-ink-soft">
              {hasFilters
                ? "Try a broader search, another action type, or switch to Everyone."
                : "Completed admin actions will appear here as they happen."}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className={cn(PILL_BTN, "mx-auto mt-4")}>
                <Icon name="restart-bold" size={14} />
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            {grouped.map((section) => (
              <section key={section.key}>
                <DayHeader label={section.label} count={section.items.length} />
                <ol className="divide-y divide-ng-line-soft">
                  {section.items.map((e) => (
                    <ActivityRow key={e.id} entry={e} viewerEmail={viewer.email} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        <p className="mt-5 flex items-center gap-1.5 border-t border-ng-line-soft pt-4 text-[11.5px] font-medium text-ng-ink-soft">
          <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
          Live trail. Refreshes automatically every 20 seconds and when you return to this tab.
        </p>
      </Card>
    </AdminShell>
  );
}
