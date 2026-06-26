"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";

/**
 * Admin · Customers — the DEDUPED canonical customer directory.
 *
 * One row per real person, read from `public.customers` (tombstones excluded)
 * via `/api/admin/customers`. A single human who signed in with both Google and
 * a phone number shows up ONCE here, with both providers as badges — unlike the
 * raw `public.users` table where they'd appear twice.
 *
 * The canonical table is populated by ongoing sign-ins plus the upcoming
 * backfill, so it may be empty for now; that is a friendly empty state, not an
 * error.
 */

type Provider = "google" | "phone";

interface CustomerRow {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  providers: Provider[];
  identityCount: number;
  addressCount: number;
  createdAt: string;
  lastActive: string | null;
}

interface IdentityRow {
  id: string;
  provider: Provider;
  email: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: string;
}

interface AddressRow {
  id: string;
  label: string | null;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isDefault: boolean;
}

interface LinkedUserRow {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  provider: string | null;
  lastLoginAt: string | null;
}

interface CustomerPage {
  ok: boolean;
  customers: CustomerRow[];
  total: number;
  identitiesTotal: number;
  customersTotal: number;
}

interface CustomerDetail {
  ok: boolean;
  customer: CustomerRow;
  identities: IdentityRow[];
  addresses: AddressRow[];
  linkedUsers: LinkedUserRow[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  phone: "Phone",
};

/** Provider badge tone — Google in forest/info, phone in success. */
function providerTone(p: Provider): "info" | "success" | "neutral" {
  if (p === "google") return "info";
  if (p === "phone") return "success";
  return "neutral";
}

function initialOf(c: CustomerRow): string {
  const src = c.displayName || c.primaryEmail || c.primaryPhone || "?";
  return src.trim().charAt(0).toUpperCase() || "?";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ProviderBadges({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) {
    return <span className="text-[12px] font-medium text-ng-ink-muted">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {providers.map((p) => (
        <Pill key={p} tone={providerTone(p)}>
          {PROVIDER_LABEL[p] ?? p}
        </Pill>
      ))}
    </span>
  );
}

export default function AdminCustomers() {
  const [data, setData] = useState<CustomerPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("request-failed");
      const json = (await res.json()) as CustomerPage;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounce the free-text search into the query that triggers a reload.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("detail-failed");
      const json = (await res.json()) as CustomerDetail;
      setDetail(json);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  const customers = data?.customers ?? [];
  const customersTotal = data?.customersTotal ?? 0;
  const identitiesTotal = data?.identitiesTotal ?? 0;
  const mergedAway = Math.max(identitiesTotal - customersTotal, 0);

  return (
    <AdminShell
      active="/admin/customers"
      title={
        <span>
          Customers <em className="italic text-ng-clay font-display">deduped</em>
        </span>
      }
      subtitle="One canonical row per real person — Google and phone sign-ins folded into a single customer"
      actions={
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
        >
          <Icon name="refresh-bold" size={15} className="text-ng-forest" />
          Refresh
        </button>
      }
    >
      {/* Dedup summary — makes the de-duplication visible at a glance. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Canonical customers" value={customersTotal.toLocaleString("en-IN")} />
        <StatTile label="Sign-in identities" value={identitiesTotal.toLocaleString("en-IN")} />
        <StatTile
          label="Identities merged away"
          value={mergedAway.toLocaleString("en-IN")}
          delta={mergedAway > 0 ? "folded into customers" : undefined}
          trend={mergedAway > 0 ? "down" : "flat"}
        />
        <StatTile label="Shown on this page" value={customers.length.toLocaleString("en-IN")} />
      </div>

      <p className="text-[12.5px] font-medium text-ng-ink-soft mb-5 leading-relaxed">
        <span className="font-semibold text-ng-forest-deep">
          {identitiesTotal.toLocaleString("en-IN")} sign-in identities
        </span>{" "}
        merged into{" "}
        <span className="font-semibold text-ng-forest-deep">
          {customersTotal.toLocaleString("en-IN")} customers
        </span>
        . Each person appears once below, no matter how many ways they sign in.
      </p>

      <Card
        title="Directory"
        action={
          <label className="relative flex items-center">
            <Icon
              name="magnifer-bold"
              size={15}
              className="absolute left-3 text-ng-ink-muted pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone"
              className="w-64 max-w-[60vw] rounded-full border border-ng-line bg-ng-cream pl-9 pr-3 py-2 text-[12.5px] font-medium text-ng-ink placeholder:text-ng-ink-muted focus:outline-none focus:border-ng-leaf transition-colors"
            />
          </label>
        }
        className="!p-0 overflow-hidden"
      >
        <div className="grid grid-cols-[2fr_1.8fr_1.2fr_1.3fr_0.8fr_1fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Providers</span>
          <span>Addresses</span>
          <span>Joined</span>
          <span></span>
        </div>

        {loading ? (
          <ul>
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="grid grid-cols-[2fr_1.8fr_1.2fr_1.3fr_0.8fr_1fr_0.5fr] gap-4 px-6 py-4 items-center border-b border-ng-line-soft last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-ng-line-soft animate-pulse shrink-0" />
                  <div className="h-3.5 w-28 rounded bg-ng-line-soft animate-pulse" />
                </div>
                <div className="h-3 w-32 rounded bg-ng-line-soft animate-pulse" />
                <div className="h-3 w-24 rounded bg-ng-line-soft animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-ng-line-soft animate-pulse" />
                <div className="h-3 w-8 rounded bg-ng-line-soft animate-pulse" />
                <div className="h-3 w-16 rounded bg-ng-line-soft animate-pulse" />
                <div />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <Icon name="danger-triangle-bold" size={28} className="text-ng-terracotta mx-auto" />
            <p className="mt-3 text-[14px] font-semibold text-ng-ink">Couldn&apos;t load customers</p>
            <p className="mt-1 text-[12.5px] font-medium text-ng-ink-muted">
              Please try again in a moment.
            </p>
            <button
              onClick={() => void load()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
            >
              <Icon name="refresh-bold" size={14} />
              Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="size-14 rounded-full bg-ng-sage/40 flex items-center justify-center mx-auto">
              <Icon name="users-group-two-rounded-bold" size={26} className="text-ng-forest" />
            </div>
            <p className="mt-4 text-[15px] font-display text-ng-forest-deep">
              {query ? "No customers match that search" : "No customers yet"}
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium text-ng-ink-muted max-w-md mx-auto leading-relaxed">
              {query
                ? "Try a different name, email or phone number."
                : "The canonical customer table fills as people sign in and the backfill runs. Deduped customers will appear here automatically."}
            </p>
          </div>
        ) : (
          <ul>
            {customers.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[2fr_1.8fr_1.2fr_1.3fr_0.8fr_1fr_0.5fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[14px] shrink-0">
                    {initialOf(c)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ng-ink truncate">
                      {c.displayName || "Unnamed customer"}
                    </div>
                    <div className="text-[11.5px] font-medium text-ng-ink-soft">
                      {c.identityCount} {c.identityCount === 1 ? "identity" : "identities"}
                    </div>
                  </div>
                </div>
                <span className="text-[12px] font-medium text-ng-ink-muted truncate">
                  {c.primaryEmail || "—"}
                </span>
                <span className="font-mono text-[12px] tabular-nums font-medium text-ng-ink">
                  {c.primaryPhone || "—"}
                </span>
                <ProviderBadges providers={c.providers} />
                <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">
                  {c.addressCount}
                </span>
                <span className="text-[12px] font-medium text-ng-ink-soft">{fmtDate(c.createdAt)}</span>
                <button
                  onClick={() => void openDetail(c.id)}
                  className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer text-right"
                >
                  View →
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selectedId ? (
        <CustomerDrawer
          loading={detailLoading}
          detail={detail}
          onClose={closeDetail}
        />
      ) : null}
    </AdminShell>
  );
}

/* ── Detail drawer ──────────────────────────────────────────────────────── */

function CustomerDrawer({
  loading,
  detail,
  onClose,
}: {
  loading: boolean;
  detail: CustomerDetail | null;
  onClose: () => void;
}) {
  const c = detail?.customer ?? null;
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-sm cursor-pointer"
      />
      <aside className="relative w-full max-w-md h-full bg-ng-cream border-l border-ng-line-soft overflow-y-auto shadow-2xl">
        <header className="sticky top-0 z-10 bg-ng-cream/90 backdrop-blur border-b border-ng-line-soft px-6 py-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] text-ng-forest-deep">Customer detail</h2>
          <button
            onClick={onClose}
            className="text-ng-ink-muted hover:text-ng-forest transition-colors cursor-pointer"
            aria-label="Close detail"
          >
            <Icon name="close-circle-bold" size={22} />
          </button>
        </header>

        <div className="px-6 py-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-full bg-ng-line-soft animate-pulse" />
              <div className="h-4 w-40 rounded bg-ng-line-soft animate-pulse" />
              <div className="h-3 w-56 rounded bg-ng-line-soft animate-pulse" />
            </div>
          ) : !c ? (
            <div className="text-center py-10">
              <Icon name="danger-triangle-bold" size={26} className="text-ng-terracotta mx-auto" />
              <p className="mt-3 text-[13px] font-medium text-ng-ink-muted">
                This customer could not be loaded.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[22px] shrink-0">
                  {initialOf(c)}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[18px] text-ng-forest-deep truncate">
                    {c.displayName || "Unnamed customer"}
                  </div>
                  <div className="mt-1.5">
                    <ProviderBadges providers={c.providers} />
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Field icon="letter-bold" label="Email" value={c.primaryEmail} />
                <Field icon="phone-bold" label="Phone" value={c.primaryPhone} />
                <Field icon="map-point-bold" label="Addresses" value={String(c.addressCount)} />
                <Field
                  icon="user-rounded-bold"
                  label="Joined"
                  value={fmtDate(c.createdAt)}
                />
              </dl>

              <Section
                icon="shield-user-bold"
                title={`Sign-in identities (${detail?.identities.length ?? 0})`}
              >
                {detail && detail.identities.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.identities.map((id) => (
                      <li
                        key={id.id}
                        className="rounded-xl border border-ng-line-soft bg-ng-paper p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Pill tone={providerTone(id.provider)}>
                              {PROVIDER_LABEL[id.provider] ?? id.provider}
                            </Pill>
                            {id.verified ? (
                              <span className="text-[10.5px] font-bold uppercase tracking-wider text-ng-success">
                                Verified
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1.5 text-[12px] font-medium text-ng-ink-muted truncate">
                            {id.email || id.phone || "—"}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-ng-ink-soft shrink-0">
                          {fmtDate(id.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No identities linked yet.</EmptyLine>
                )}
              </Section>

              <Section
                icon="map-point-wave-bold"
                title={`Saved addresses (${detail?.addresses.length ?? 0})`}
              >
                {detail && detail.addresses.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.addresses.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-xl border border-ng-line-soft bg-ng-paper p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold text-ng-ink capitalize">
                            {a.label || "Address"}
                          </span>
                          {a.isDefault ? (
                            <Pill tone="success">Default</Pill>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[12px] font-medium text-ng-ink-muted">
                          {[a.city, a.state, a.pincode].filter(Boolean).join(", ") || "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No saved addresses.</EmptyLine>
                )}
              </Section>

              <Section
                icon="users-group-two-rounded-bold"
                title={`Linked sign-in rows (${detail?.linkedUsers.length ?? 0})`}
              >
                {detail && detail.linkedUsers.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.linkedUsers.map((u) => (
                      <li
                        key={u.id}
                        className="rounded-xl border border-ng-line-soft bg-ng-paper p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-ng-ink truncate">
                            {u.fullName || u.email || u.phone || "—"}
                          </div>
                          <div className="text-[11.5px] font-medium text-ng-ink-muted capitalize">
                            {u.provider || "unknown"} · last login {fmtDate(u.lastLoginAt)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No live sign-in rows linked yet.</EmptyLine>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-ng-line-soft bg-ng-paper p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-muted">
        <Icon name={icon} size={13} className="text-ng-forest" />
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-ng-ink truncate">{value || "—"}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-2.5">
        <Icon name={icon} size={15} className="text-ng-forest" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium text-ng-ink-muted rounded-xl border border-dashed border-ng-line-soft px-3 py-3">
      {children}
    </p>
  );
}
