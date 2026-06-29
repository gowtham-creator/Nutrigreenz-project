"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import {
  NumberField,
  Toggle,
  SegToggle,
  TextField,
  SaveBar,
} from "@/components/ng/admin/super/controls";
import {
  CommandCenterHero,
  SectionHeader,
  PrimarySection,
  type Kpi,
} from "@/components/ng/admin/super/command-center";
import { CouponCampaignBuilder } from "@/components/ng/admin/super/coupon-campaign-builder";
import { CommerceConfigPanel } from "@/components/ng/admin/super/commerce-config";
import { ReferralConfigSection } from "@/components/ng/admin/super/referral-config";
import { RolesAndLogs } from "@/components/ng/admin/super/roles-and-logs";
import { useCommerceConfig } from "@/lib/commerce";
import { useLoyaltyConfig, type LoyaltyConfig } from "@/lib/loyalty-config";
import { getAdminRole, getAdminEmail } from "@/lib/admin-auth";
import { COUPONS } from "@/components/ng/data";
import type { CommerceRules, DeliverySlot } from "@/types/nutrigreenz";

/* ---- Read-only reference cards (kept from the previous display) -------- */
const ZONES = [
  { city: "Hyderabad", pin: "500001–500098", days: "Same/next day", surcharge: "Free above ₹599", on: true },
  { city: "Secunderabad", pin: "500003–500094", days: "Same/next day", surcharge: "Free above ₹599", on: true },
  { city: "Mumbai", pin: "400001–400107", days: "3 days", surcharge: "₹49 flat", on: true },
  { city: "Chennai", pin: "600001–600099", days: "3 days", surcharge: "₹49 flat", on: true },
  { city: "Delhi NCR", pin: "110001–110099", days: "3–4 days", surcharge: "₹79 flat", on: true },
  { city: "Pan-India (rest)", pin: "—", days: "5–7 days", surcharge: "₹99 flat", on: true },
  { city: "Kolkata", pin: "700001–700099", days: "—", surcharge: "—", on: false },
];

const PAYMENT = [
  { method: "UPI · Razorpay", on: true, fee: "0.4%", note: "Default checkout" },
  { method: "Cards · Razorpay", on: true, fee: "1.9% + ₹2", note: "All major networks" },
  { method: "Netbanking", on: true, fee: "₹15 flat", note: "" },
  { method: "Wallets (Paytm, PhonePe)", on: true, fee: "1.4%", note: "" },
  { method: "COD", on: false, fee: "—", note: "Disabled · pilferage rate too high" },
];

/* ---- Feature toggles (UI state only; demo) ----------------------------- */
const INITIAL_FEATURES: { key: string; label: string; desc: string; on: boolean }[] = [
  { key: "subscriptions", label: "Subscriptions", desc: "Recurring boxes with pause / skip", on: true },
  { key: "referrals", label: "Referrals", desc: "Refer-a-friend rewards programme", on: true },
  { key: "community_bundles", label: "Community bundles", desc: "Captain-led group orders", on: true },
  { key: "captain_network", label: "Captain network", desc: "Field-pickup captain PWA", on: false },
];

const SUB_NAV = [
  "Commerce",
  "Rules",
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
        <span className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-ng-forest-deep ring-1 ring-ng-clay/40 mb-5 shadow-[0_8px_24px_rgba(31,77,46,0.18)]">
          <Icon name="lock-keyhole-bold" size={28} className="text-ng-clay" />
        </span>
        <h2 className="font-display text-[22px] text-ng-forest-deep">Super Admin access required</h2>
        <p className="text-[13.5px] font-medium text-ng-ink-muted mt-2">
          The control center is restricted to Super Admins. Ask an owner to upgrade your
          role, or head back to the admin overview.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-1.5 mt-6 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <Icon name="arrow-left-bold" size={15} />
          Back to overview
        </a>
      </div>
    </AdminShell>
  );
}

function ConfigContent() {
  const { rules, updateRules, resetRules } = useCommerceConfig();
  const { config: loyalty, updateConfig: updateLoyalty, resetConfig: resetLoyalty } =
    useLoyaltyConfig();

  // The operator identity for the hero — resolved client-side from the session
  // cookie (same source the guard uses). Null on the server pass.
  const [operator, setOperator] = useState<string | null>(null);
  useEffect(() => setOperator(getAdminEmail()), []);

  // Live KPI strip — every figure reads straight from the stores so the hero
  // mirrors exactly what's driving the storefront right now.
  const activeCoupons = COUPONS.filter((c) => c.active).length;
  const kpis: Kpi[] = [
    { icon: "cart-large-2-bold", label: "Min order", value: INR(rules.minOrderValue), accent: true },
    { icon: "delivery-bold", label: "Free delivery ≥", value: INR(rules.freeDeliveryThreshold) },
    {
      icon: "wad-of-money-bold",
      label: "Shipping",
      value: rules.shippingFlat === 0 ? "Free" : INR(rules.shippingFlat),
    },
    { icon: "star-bold", label: "Points ratio", value: `${loyalty.earnPointsPerRupee} pt/₹`, accent: true },
    { icon: "ticket-sale-bold", label: "Active coupons", value: String(activeCoupons) },
    { icon: "clock-circle-bold", label: "Delivery slots", value: String(rules.deliverySlots.length) },
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
          <Icon name="crown-bold" size={14} />
          Super Admin
        </span>
      }
    >
      {/* Distinguished command-center hero with live KPI strip. */}
      <CommandCenterHero operator={operator} kpis={kpis} />

      {/* Sticky in-page section nav. */}
      <div className="sticky top-[68px] z-[1] bg-ng-cream/85 backdrop-blur -mx-8 px-8 py-3 mb-7 border-b border-ng-line-soft">
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
      <CommerceRulesSection rules={rules} updateRules={updateRules} resetRules={resetRules} />
      <LoyaltySection
        loyalty={loyalty}
        updateLoyalty={updateLoyalty}
        resetLoyalty={resetLoyalty}
      />
      <ReferralConfigSection />

      {/* Secondary controls. */}
      <div className="flex items-center gap-2.5 mt-9 mb-3.5">
        <span className="ng-eyebrow text-ng-ink-muted">Programmes &amp; platform</span>
        <span className="h-px flex-1 bg-ng-line-soft" />
      </div>

      <CouponCampaignBuilder />
      <FeatureTogglesSection />
      <RolesAndLogs />

      {/* Read-only reference: shipping zones + payment methods */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="map-point-wave-bold" size={17} className="text-ng-forest" />
            Shipping zones
          </span>
        }
        action={<span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">{ZONES.filter((z) => z.on).length} live · read-only</span>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div id="shipping" className="scroll-mt-32" />
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_1.4fr_0.8fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>City</span>
          <span>PIN range</span>
          <span>SLA</span>
          <span>Pricing</span>
          <span>Status</span>
        </div>
        <ul>
          {ZONES.map((z) => (
            <li
              key={`${z.city}-${z.pin}`}
              className="grid grid-cols-[1.4fr_1.6fr_1fr_1.4fr_0.8fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0"
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
 * Global Commerce Rules (§3.8)
 * ===================================================================== */
function CommerceRulesSection({
  rules,
  updateRules,
  resetRules,
}: {
  rules: CommerceRules;
  updateRules: (patch: Partial<CommerceRules>) => void;
  resetRules: () => void;
}) {
  const [draft, setDraft] = useState<CommerceRules>(rules);
  // Re-sync when the store resets/changes underneath us.
  useEffect(() => setDraft(rules), [rules]);

  const freeShipping = draft.shippingFlat === 0;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(rules),
    [draft, rules],
  );

  function patchSlot(id: string, patch: Partial<DeliverySlot>) {
    setDraft((d) => ({
      ...d,
      deliverySlots: d.deliverySlots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }
  function addSlot() {
    const id = `slot-${Date.now()}`;
    setDraft((d) => ({
      ...d,
      deliverySlots: [...d.deliverySlots, { id, label: "New slot", cutoff: "22:00" }],
    }));
  }
  function removeSlot(id: string) {
    setDraft((d) => ({ ...d, deliverySlots: d.deliverySlots.filter((s) => s.id !== id) }));
  }

  function save() {
    updateRules(draft);
    toast.success("Commerce rules saved", {
      description: "Applied to the live storefront — cart & checkout.",
    });
  }
  function reset() {
    resetRules();
    toast.info("Commerce rules reset to defaults");
  }

  return (
    <PrimarySection id="rules">
      <Card>
        <SectionHeader
          icon="settings-bold"
          tone="forest"
          title="Global commerce rules"
          caption="Order minimums, delivery pricing, tax display & slots — applied to cart and checkout."
          badge={dirty ? <Pill tone="warn">Unsaved</Pill> : <span className="ng-eyebrow">§3.8</span>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField
            label="Minimum order value"
            value={draft.minOrderValue}
            onChange={(v) => setDraft((d) => ({ ...d, minOrderValue: v }))}
            prefix="₹"
            step={10}
            hint="Cart must reach this to checkout"
          />
          <NumberField
            label="Free-delivery threshold"
            value={draft.freeDeliveryThreshold}
            onChange={(v) => setDraft((d) => ({ ...d, freeDeliveryThreshold: v }))}
            prefix="₹"
            step={10}
            hint="Free at/above this subtotal"
          />
          <NumberField
            label="Flat delivery fee"
            value={draft.shippingFlat}
            onChange={(v) => setDraft((d) => ({ ...d, shippingFlat: v }))}
            prefix="₹"
            step={5}
            hint={freeShipping ? "Currently free for all orders" : "Charged below the threshold"}
          />
          <SegToggle
            label="Tax display mode"
            value={draft.taxMode}
            onChange={(v) => setDraft((d) => ({ ...d, taxMode: v }))}
            options={[
              { value: "inclusive", label: "Inclusive" },
              { value: "exclusive", label: "Exclusive" },
            ]}
            hint={draft.taxMode === "inclusive" ? "Shown prices include GST" : "GST added at checkout"}
          />
          <div className="sm:col-span-2 lg:col-span-2 flex items-center">
            <div className="w-full rounded-xl border border-ng-line-soft bg-ng-cream/50 px-4">
              <Toggle
                label="Free delivery for all orders"
                description="When on, the flat delivery fee is set to ₹0"
                checked={freeShipping}
                onChange={(on) =>
                  setDraft((d) => ({ ...d, shippingFlat: on ? 0 : d.shippingFlat || 49 }))
                }
              />
            </div>
          </div>
        </div>

        {/* Delivery slots */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[12.5px] font-semibold text-ng-ink">Delivery slots</span>
            <button
              type="button"
              onClick={addSlot}
              className="inline-flex items-center gap-1 text-[12px] text-ng-forest font-semibold hover:text-ng-leaf transition-colors cursor-pointer"
            >
              <Icon name="add-circle-bold" size={15} />
              Add slot
            </button>
          </div>
          <ul className="space-y-2.5">
            {draft.deliverySlots.map((slot) => (
              <li
                key={slot.id}
                className="grid grid-cols-[1.8fr_1fr_auto] gap-3 items-end rounded-xl border border-ng-line-soft bg-ng-cream/40 p-3"
              >
                <TextField
                  label="Label"
                  value={slot.label}
                  onChange={(v) => patchSlot(slot.id, { label: v })}
                  placeholder="Morning · 7–10 AM"
                />
                <TextField
                  label="Cutoff"
                  value={slot.cutoff}
                  onChange={(v) => patchSlot(slot.id, { cutoff: v })}
                  placeholder="22:00"
                />
                <button
                  type="button"
                  onClick={() => removeSlot(slot.id)}
                  aria-label={`Remove slot ${slot.label}`}
                  className="h-11 px-3 rounded-xl border border-ng-line text-ng-terracotta hover:bg-ng-terracotta/10 transition-colors cursor-pointer"
                >
                  <Icon name="trash-bin-trash-bold" size={16} />
                </button>
              </li>
            ))}
            {draft.deliverySlots.length === 0 ? (
              <li className="text-[12px] font-medium text-ng-ink-soft py-2">No slots — add one above.</li>
            ) : null}
          </ul>
        </div>

        <SaveBar
          note="Changes apply to the live storefront (cart & checkout)."
          onSave={save}
          onReset={reset}
          dirty={dirty}
        />
      </Card>
    </PrimarySection>
  );
}

/* =======================================================================
 * Loyalty (§3.5.1)
 * ===================================================================== */
function LoyaltySection({
  loyalty,
  updateLoyalty,
  resetLoyalty,
}: {
  loyalty: LoyaltyConfig;
  updateLoyalty: (patch: Partial<LoyaltyConfig>) => void;
  resetLoyalty: () => void;
}) {
  const [draft, setDraft] = useState<LoyaltyConfig>(loyalty);
  useEffect(() => setDraft(loyalty), [loyalty]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(loyalty),
    [draft, loyalty],
  );

  function save() {
    updateLoyalty(draft);
    toast.success("Loyalty programme saved", {
      description: "Drives points earned & checkout redemption.",
    });
  }
  function reset() {
    resetLoyalty();
    toast.info("Loyalty config reset to defaults");
  }

  return (
    <PrimarySection id="loyalty">
      <Card>
        <SectionHeader
          icon="star-bold"
          tone="clay"
          title="Loyalty programme"
          caption="Earn & redemption ratios, floors and caps — drives points on orders and checkout redemption."
          badge={dirty ? <Pill tone="warn">Unsaved</Pill> : <span className="ng-eyebrow">§3.5.1</span>}
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
            hint="Floor before points can be used"
          />
          <NumberField
            label="Max redeem % of order"
            value={draft.maxRedeemPercent}
            onChange={(v) => setDraft((d) => ({ ...d, maxRedeemPercent: v }))}
            suffix="%"
            step={1}
            hint="Cap on points applied per order"
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
                description="Turn off to pause all points accrual"
                checked={draft.earnEnabled}
                onChange={(on) => setDraft((d) => ({ ...d, earnEnabled: on }))}
              />
            </div>
          </div>
        </div>

        <SaveBar
          note="Drives points earned on orders and redemption at checkout."
          onSave={save}
          onReset={reset}
          dirty={dirty}
        />
      </Card>
    </PrimarySection>
  );
}

/* =======================================================================
 * Feature toggles (performance) — UI state + toast
 * ===================================================================== */
function FeatureTogglesSection() {
  const [features, setFeatures] = useState(INITIAL_FEATURES);

  function toggle(key: string) {
    setFeatures((fs) =>
      fs.map((f) => (f.key === key ? { ...f, on: !f.on } : f)),
    );
    const f = features.find((x) => x.key === key);
    if (f) toast.success(`${f.label} ${f.on ? "disabled" : "enabled"}`);
  }

  return (
    <section id="features" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="bolt-bold"
          tone="clay"
          title="Feature toggles"
          caption="Switch storefront capabilities on or off across the platform."
          badge={
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">
              {features.filter((f) => f.on).length} / {features.length} on
            </span>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 -my-1">
          {features.map((f) => (
            <div key={f.key} className="border-b border-ng-line-soft sm:[&:nth-last-child(-n+2)]:border-0 last:border-0">
              <Toggle
                label={f.label}
                description={f.desc}
                checked={f.on}
                onChange={() => toggle(f.key)}
              />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
