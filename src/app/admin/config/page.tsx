"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import {
  NumberField,
  Toggle,
  SaveBar,
} from "@/components/ng/admin/super/controls";
import {
  CommandCenterHero,
  SectionHeader,
  PrimarySection,
  type Kpi,
} from "@/components/ng/admin/super/command-center";
import { CouponCampaignBuilder } from "@/components/ng/admin/super/coupon-campaign-builder";
import { PaymentGatewayPanel } from "@/components/ng/admin/super/payment-gateway-panel";
import { CommerceConfigPanel } from "@/components/ng/admin/super/commerce-config";
import { ReferralConfigSection } from "@/components/ng/admin/super/referral-config";
import { RolesAndLogs } from "@/components/ng/admin/super/roles-and-logs";
import { LOYALTY_CONFIG, type LoyaltyConfig } from "@/lib/loyalty-config";
import { getAdminRole, getAdminEmail } from "@/lib/admin-auth";
import { adminGet, invalidateAdminGet } from "@/lib/admin-get";
import { WhenVisible } from "@/components/ng/admin/when-visible";

/* ---- Read-only reference cards (kept from the previous display) -------- */
const ZONES = [
  { city: "Hyderabad", pin: "500001-500098", days: "Same/next day", surcharge: "Free above ₹599", on: true },
  { city: "Secunderabad", pin: "500003-500094", days: "Same/next day", surcharge: "Free above ₹599", on: true },
  { city: "Mumbai", pin: "400001-400107", days: "3 days", surcharge: "₹49 flat", on: true },
  { city: "Chennai", pin: "600001-600099", days: "3 days", surcharge: "₹49 flat", on: true },
  { city: "Delhi NCR", pin: "110001-110099", days: "3-4 days", surcharge: "₹79 flat", on: true },
  { city: "Pan-India (rest)", pin: "—", days: "5-7 days", surcharge: "₹99 flat", on: true },
  { city: "Kolkata", pin: "700001-700099", days: "—", surcharge: "—", on: false },
];

const PAYMENT = [
  { method: "UPI · Razorpay", on: true, fee: "0.4%", note: "Default checkout" },
  { method: "Cards · Razorpay", on: true, fee: "1.9% + ₹2", note: "All major networks" },
  { method: "Netbanking", on: true, fee: "₹15 flat", note: "" },
  { method: "Wallets (Paytm, PhonePe)", on: true, fee: "1.4%", note: "" },
  { method: "COD", on: false, fee: "—", note: "Disabled · pilferage rate too high" },
];

const SUB_NAV = [
  "Commerce",
  "Loyalty",
  "Referrals",
  "Coupons",
  "Features",
  "Access",
  "Shipping",
  "Payment",
];

/** ₹ formatter for figures shown read-only. */
const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function AdminConfig() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    setRole(getAdminRole());
  }, []);

  // The edge proxy already redirects non-superadmins away from this route; this
  // guard is a graceful client-side fallback before that proxy is in place.
  if (role !== null && role !== "superadmin") {
    return <AccessRequired />;
  }

  return <ConfigContent />;
}

/** Graceful "not allowed" state for non-superadmins. */
function AccessRequired() {
  return (
    <AdminShell active="/admin/config" title="Super Admin">
      <div className="max-w-md mx-auto text-center py-20">
        <span className="ng-on-dark relative inline-flex size-16 items-center justify-center rounded-2xl bg-ng-forest-deep ring-1 ring-ng-clay/40 mb-5 shadow-[0_8px_24px_rgba(31,77,46,0.18)]">
          <Icon name="lock-keyhole-minimalistic-bold" size={28} className="text-ng-clay" />
        </span>
        <h2 className="font-display text-[22px] text-ng-forest-deep">Super Admin access required</h2>
        <p className="text-[13.5px] font-medium text-ng-ink-muted mt-2">
          Only Super Admins can open the control center. Ask an owner to change your
          role, or go back to the overview.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-1.5 mt-6 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <Icon name="arrow-left-linear" size={15} />
          Back to overview
        </a>
      </div>
    </AdminShell>
  );
}

/** Live figures behind the hero KPI strip — all read from the real backends. */
interface KpiData {
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  shippingType: string;
  shippingFlatPaise: number;
  earnPointsPerRupee: number;
  activeCoupons: number;
  slotCount: number;
}

function ConfigContent() {
  // The operator identity for the hero — resolved client-side from the session
  // cookie (same source the guard uses). Null on the server pass.
  const [operator, setOperator] = useState<string | null>(null);
  useEffect(() => setOperator(getAdminEmail()), []);

  // Live KPI strip — every figure is fetched from the real backends (commerce
  // rules, loyalty config, the coupons catalogue and the delivery slots) so the
  // hero mirrors exactly what's driving the storefront right now.
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      /*
       * Delegates to the shared reader instead of fetching directly.
       *
       * Identical contract — parsed body, or null on failure — so no call site
       * below changes. What changes is that these four reads now JOIN the
       * requests the panels mounted alongside this page are already making,
       * rather than issuing their own. Measured on one open of this page:
       * `config/commerce` was read four times, `slots` four, `loyalty` four,
       * coupons three.
       */
      const getJson = <T,>(url: string): Promise<T | null> => adminGet<T>(url);
      const [commerce, loyalty, couponsRes, slotsRes] = await Promise.all([
        getJson<{ rules?: { minOrderPaise?: number; freeDeliveryThresholdPaise?: number; shippingType?: string; shippingFlatPaise?: number } }>(
          "/api/admin/config/commerce",
        ),
        getJson<{ config?: { earnPointsPerRupee?: number } }>("/api/admin/config/loyalty"),
        getJson<{ coupons?: { active: boolean }[] }>("/api/admin/marketing/coupons"),
        getJson<{ slots?: unknown[] }>("/api/admin/config/commerce/slots"),
      ]);
      if (cancelled) return;
      setKpiData({
        minOrderPaise: commerce?.rules?.minOrderPaise ?? 0,
        freeDeliveryThresholdPaise: commerce?.rules?.freeDeliveryThresholdPaise ?? 0,
        shippingType: commerce?.rules?.shippingType ?? "flat",
        shippingFlatPaise: commerce?.rules?.shippingFlatPaise ?? 0,
        earnPointsPerRupee: loyalty?.config?.earnPointsPerRupee ?? LOYALTY_CONFIG.earnPointsPerRupee,
        activeCoupons: (couponsRes?.coupons ?? []).filter((c) => c.active).length,
        slotCount: (slotsRes?.slots ?? []).length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const freeShipping = kpiData
    ? kpiData.shippingType === "zero" || kpiData.shippingFlatPaise === 0
    : false;
  const kpis: Kpi[] = [
    {
      icon: "cart-large-2-bold",
      label: "Min order",
      value: kpiData ? INR(kpiData.minOrderPaise / 100) : "—",
      accent: true,
    },
    {
      icon: "delivery",
      label: "Free delivery ≥",
      value: kpiData ? INR(kpiData.freeDeliveryThresholdPaise / 100) : "—",
    },
    {
      icon: "wad-of-money-bold",
      label: "Shipping",
      value: kpiData ? (freeShipping ? "Free" : INR(kpiData.shippingFlatPaise / 100)) : "—",
    },
    {
      icon: "star",
      label: "Points ratio",
      value: kpiData ? `${kpiData.earnPointsPerRupee} pt/₹` : "—",
      accent: true,
    },
    {
      icon: "coupon",
      label: "Active coupons",
      value: kpiData ? String(kpiData.activeCoupons) : "—",
    },
    {
      icon: "deliveryTime",
      label: "Delivery slots",
      value: kpiData ? String(kpiData.slotCount) : "—",
    },
  ];

  return (
    <AdminShell
      active="/admin/config"
      title={
        <span>
          Super <em className="italic text-ng-clay font-display">Admin</em>
        </span>
      }
      subtitle="The live storefront control center"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/20 text-ng-clay-deep font-bold px-4 py-2 text-[12px] uppercase tracking-wider">
          <UiIcon name="admin" size={14} />
          Super Admin
        </span>
      }
    >
      {/* Distinguished command-center hero with live KPI strip. */}
      <CommandCenterHero operator={operator} kpis={kpis} />

      {/* Sticky in-page section nav.

          The full-bleed negative margin tracks the main container's padding,
          which steps 4 -> 6 -> 8. A flat -mx-8 overhangs by 8px on tablet and
          scrolls the whole console sideways. */}
      <div className="sticky top-[68px] z-[1] bg-ng-cream/85 backdrop-blur -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 mb-7 border-b border-ng-line-soft">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ng-ink-muted font-mono font-semibold mr-1 hidden sm:inline">
            Jump to
          </span>
          <div className="flex gap-1 text-[12.5px] flex-wrap">
            {SUB_NAV.map((t, i) => (
              <a
                key={t}
                href={`#${t.toLowerCase()}`}
                className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  i === 0
                    ? "bg-ng-forest-deep text-ng-cream font-semibold"
                    : "text-ng-ink-muted font-medium hover:bg-ng-paper"
                }`}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Headline controls — Commerce + Loyalty, visually primary. */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="ng-eyebrow text-ng-clay-deep">Headline controls</span>
        <span className="h-px flex-1 bg-gradient-to-r from-ng-clay/40 to-transparent" />
      </div>

      <CommerceConfigPanel />
      <LoyaltySection />
      <ReferralConfigSection />

      {/* Secondary controls. */}
      <div className="flex items-center gap-2.5 mt-9 mb-3.5">
        <span className="ng-eyebrow text-ng-ink-muted">Programmes &amp; platform</span>
        <span className="h-px flex-1 bg-ng-line-soft" />
      </div>

      {/* Secondary panels mount when scrolled to, not on page load. Each one
          fetches from its own effect, so deferring the mount defers the request.
          The wrapper holds the sub-nav anchor while the panel is absent. */}
      <WhenVisible minHeight={340}>
        <PaymentGatewayPanel />
      </WhenVisible>

      <WhenVisible anchorId="coupons" minHeight={420}>
        <CouponCampaignBuilder />
      </WhenVisible>

      <FeatureTogglesSection />

      <WhenVisible anchorId="access" minHeight={380}>
        <RolesAndLogs />
      </WhenVisible>

      {/* Read-only reference: shipping zones + payment methods */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <UiIcon name="location" size={17} className="text-ng-forest" />
            Shipping zones
          </span>
        }
        action={<span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">{ZONES.filter((z) => z.on).length} live · read-only</span>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div id="shipping" className="scroll-mt-32" />
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>City</span>
          <span>PIN range</span>
          <span>Delivery</span>
          <span>Pricing</span>
          <span>Status</span>
        </div>
        <ul>
          {ZONES.map((z) => (
            <li
              key={`${z.city}-${z.pin}`}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0"
            >
              <span className="font-semibold text-ng-ink">{z.city}</span>
              <span className="font-mono font-medium text-[11.5px] text-ng-ink-muted tabular-nums">{z.pin}</span>
              <span className="text-[12.5px] font-medium text-ng-ink-muted">{z.days}</span>
              <span className="text-[12.5px] font-medium text-ng-ink">{z.surcharge}</span>
              <span><Pill tone={z.on ? "success" : "neutral"}>{z.on ? "Live" : "Off"}</Pill></span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="card-bold" size={17} className="text-ng-forest" />
            Payment methods
          </span>
        }
        className="mb-2"
      >
        <div id="payment" className="scroll-mt-32" />
        <ul className="divide-y divide-ng-line-soft -mt-1">
          {PAYMENT.map((p) => (
            <li key={p.method} className="py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ng-ink">{p.method}</div>
                <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">{p.note || `Fee: ${p.fee}`}</div>
              </div>
              <span className="font-mono font-semibold text-[12px] text-ng-ink tabular-nums">{p.fee}</span>
              <Pill tone={p.on ? "success" : "neutral"}>{p.on ? "On" : "Off"}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </AdminShell>
  );
}

/* =======================================================================
 * Loyalty (§3.5.1) — DB-backed via /api/admin/config/loyalty
 * ===================================================================== */
function LoyaltySection() {
  const [saved, setSaved] = useState<LoyaltyConfig>(LOYALTY_CONFIG);
  const [draft, setDraft] = useState<LoyaltyConfig>(LOYALTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Shares the read with the KPI strip above, which wants the same row.
        const data = await adminGet<{ ok?: boolean; config?: LoyaltyConfig }>(
          "/api/admin/config/loyalty",
        );
        if (!cancelled && data && data.ok !== false && data.config) {
          setSaved(data.config);
          setDraft(data.config);
        }
      } catch {
        /* keep defaults on failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      invalidateAdminGet("/api/admin/config/");
      const res = await fetch("/api/admin/config/loyalty", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        config?: LoyaltyConfig;
        error?: string;
      };
      if (!res.ok || data.ok === false || !data.config) {
        throw new Error(data.error || "save-failed");
      }
      setSaved(data.config);
      setDraft(data.config);
      toast.success("Loyalty programme saved", {
        description: "Points earned on orders and redeemed at checkout now use these settings.",
      });
    } catch (err) {
      toast.error("Couldn't save the loyalty programme", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    setDraft(saved);
    toast.info("Unsaved changes discarded");
  }

  return (
    <PrimarySection id="loyalty">
      <Card>
        <SectionHeader
          icon="star"
          tone="clay"
          title="Loyalty programme"
          caption="How points are earned and redeemed, with minimums and limits. Applies to orders and checkout."
          badge={
            loading ? (
              <span className="ng-eyebrow text-ng-ink-soft">Loading…</span>
            ) : dirty ? (
              <Pill tone="warn">Unsaved</Pill>
            ) : (
              <Pill tone="success">Synced</Pill>
            )
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField
            label="Earn points per ₹1"
            value={draft.earnPointsPerRupee}
            onChange={(v) => setDraft((d) => ({ ...d, earnPointsPerRupee: v }))}
            suffix="pts"
            step={0.1}
            hint="Points credited per rupee spent"
          />
          <NumberField
            label="Redeem points per ₹1"
            value={draft.redeemPointsPerRupee}
            onChange={(v) => setDraft((d) => ({ ...d, redeemPointsPerRupee: v }))}
            suffix="pts"
            step={1}
            hint="Points needed for ₹1 off"
          />
          <NumberField
            label="Min points to redeem"
            value={draft.minRedeemPoints}
            onChange={(v) => setDraft((d) => ({ ...d, minRedeemPoints: v }))}
            suffix="pts"
            step={10}
            hint="Minimum balance before points can be used"
          />
          <NumberField
            label="Max redeem % of order"
            value={draft.maxRedeemPercent}
            onChange={(v) => setDraft((d) => ({ ...d, maxRedeemPercent: v }))}
            suffix="%"
            step={1}
            hint="Limit on points used per order"
          />
          <NumberField
            label="Points expiry"
            value={draft.expiryMonths}
            onChange={(v) => setDraft((d) => ({ ...d, expiryMonths: v }))}
            suffix="months"
            step={1}
            hint="From last activity"
          />
          <div className="flex items-center">
            <div className="w-full rounded-xl border border-ng-line-soft bg-ng-cream/50 px-4">
              <Toggle
                label="Earning enabled"
                description="Turn off to stop customers earning points"
                checked={draft.earnEnabled}
                onChange={(on) => setDraft((d) => ({ ...d, earnEnabled: on }))}
              />
            </div>
          </div>
        </div>

        <SaveBar
          note={
            saving
              ? "Saving…"
              : "Saved to the database. Applies to points earned on orders and redeemed at checkout."
          }
          onSave={save}
          onReset={reset}
          dirty={dirty}
        />
      </Card>
    </PrimarySection>
  );
}

/* =======================================================================
 * Feature toggles — DB-backed via /api/admin/config/features
 * ===================================================================== */
interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

function FeatureTogglesSection() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminGet<{ ok?: boolean; flags?: FeatureFlag[] }>(
          "/api/admin/config/features",
        );
        if (!cancelled && data && data.ok !== false && data.flags) {
          setFlags(data.flags);
        }
      } catch {
        /* keep empty on failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: string) {
    const current = flags.find((f) => f.key === key);
    if (!current) return;
    const next = !current.enabled;
    // Optimistic flip; revert on failure.
    setFlags((fs) => fs.map((f) => (f.key === key ? { ...f, enabled: next } : f)));
    try {
      invalidateAdminGet("/api/admin/config/");
      const res = await fetch("/api/admin/config/features", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        flags?: FeatureFlag[];
        error?: string;
      };
      if (!res.ok || data.ok === false || !data.flags) {
        throw new Error(data.error || "save-failed");
      }
      setFlags(data.flags);
      toast.success(`${current.label} ${next ? "enabled" : "disabled"}`);
    } catch (err) {
      setFlags((fs) => fs.map((f) => (f.key === key ? { ...f, enabled: current.enabled } : f)));
      toast.error("Couldn't update the feature", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <section id="features" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="bolt-bold"
          tone="clay"
          title="Feature toggles"
          caption="Turn storefront features on or off."
          badge={
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">
              {loading
                ? "Loading…"
                : `${flags.filter((f) => f.enabled).length} / ${flags.length} on`}
            </span>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 -my-1">
          {flags.map((f) => (
            <div key={f.key} className="border-b border-ng-line-soft sm:[&:nth-last-child(-n+2)]:border-0 last:border-0">
              <Toggle
                label={f.label}
                description={f.description}
                checked={f.enabled}
                onChange={() => void toggle(f.key)}
              />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
