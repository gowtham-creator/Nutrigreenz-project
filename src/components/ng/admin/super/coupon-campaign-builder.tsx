"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { SectionHeader } from "@/components/ng/admin/super/command-center";
import {
  NumberField,
  TextField,
  Toggle,
  SegToggle,
} from "@/components/ng/admin/super/controls";
import { ProductPicker } from "@/components/ng/admin/product-picker";

/**
 * Super Admin · Coupon campaign builder (§3.5.2).
 *
 * Create/edit a campaign (code, type, value, min cart, max cap, expiry,
 * first-order-only, loyalty-stacking), choose one of the five targeting modes,
 * and review how each code has actually performed.
 *
 * The performance figures were previously invented. Four codes carried
 * hardcoded stats — FRESH50 read "1,840 issued · 612 redeemed · ₹2,48,900
 * revenue · 8.1× ROI" — on the same page as the real coupon manager, so an
 * operator comparing the two saw precise, confident, fictional numbers for codes
 * that in most cases had never been redeemed. They now come from `coupon_uses`
 * joined to the orders they discounted.
 *
 * There is no "issued" figure any more, and so no redemption RATE. These are
 * public codes typed at checkout, not vouchers sent to named customers: nothing
 * issues them, so the rate has no denominator and every value shown for it was
 * necessarily made up. Reach is now distinct customers, which is real.
 */

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ----------------------------------------------------------------------- */
/* Targeting modes — the five segments from SCOPE §3.5.2.                   */
/* ----------------------------------------------------------------------- */
type TargetMode = "individual" | "zip" | "community" | "product" | "global";

const TARGET_MODES: {
  value: TargetMode;
  label: string;
  icon: string;
  /** Helper text + the placeholder for the mode's free-text selector. */
  hint: string;
  selectorLabel: string;
  placeholder: string;
  /** Modes with no extra selector (global) skip the input. */
  noSelector?: boolean;
}[] = [
  {
    value: "individual",
    label: "Specific customers",
    icon: "user-plus-bold",
    hint: "Issue to named individuals — e.g. a VIP or win-back list.",
    selectorLabel: "Customer mobiles / IDs",
    placeholder: "+91 98xxxxxx01, +91 98xxxxxx02",
  },
  {
    value: "zip",
    label: "Zip-code cluster",
    icon: "map-point-wave-bold",
    hint: "Everyone in one or more PIN codes.",
    selectorLabel: "PIN codes",
    placeholder: "500032, 500081, 500089",
  },
  {
    value: "community",
    label: "Gated community",
    icon: "buildings-2-bold",
    hint: "A captain-led society or apartment cluster.",
    selectorLabel: "Community / society",
    placeholder: "My Home Avatar, Aparna Sarovar",
  },
  {
    value: "product",
    label: "Product / SKU",
    icon: "tag-price-bold",
    hint: "Buyers of specific products or categories.",
    selectorLabel: "Products / SKUs",
    placeholder: "A2 Ghee 500ml, Cold-pressed oils",
  },
  {
    value: "global",
    label: "All customers",
    icon: "users-group-rounded-bold",
    hint: "Broadcast to the entire registered base.",
    selectorLabel: "",
    placeholder: "",
    noSelector: true,
  },
];

/* ----------------------------------------------------------------------- */
/* Campaign view-model.                                                     */
/* ----------------------------------------------------------------------- */
type CampaignDraft = {
  code: string;
  description: string;
  type: "percent" | "flat";
  value: number;
  minOrderValue: number;
  maxDiscount: number;
  expiresAt: string; // ISO date or ""
  firstOrderOnly: boolean;
  stackLoyalty: boolean;
  target: TargetMode;
  targetDetail: string;
  /** Product ids for the "product" targeting mode — real catalogue rows. */
  productIds: string[];
};

/** Measured performance for one code. Absent until it has been redeemed once. */
interface Perf {
  couponId: string;
  code: string;
  redemptions: number;
  customers: number;
  revenuePaise: number;
  discountPaise: number;
  unpaidRedemptions: number;
  lastRedeemedAt: string | null;
}

type Campaign = CampaignDraft & {
  id: string;
  /**
   * Measured performance, or null when this code has never been redeemed.
   *
   * Null is rendered as "Not yet redeemed", not as zeros: a row of zeros reads
   * like a measurement that came back empty, when the truth is that there is
   * nothing to measure yet.
   */
  perf: Perf | null;
};

function emptyDraft(): CampaignDraft {
  return {
    code: "",
    description: "",
    type: "percent",
    value: 10,
    minOrderValue: 599,
    maxDiscount: 150,
    expiresAt: "",
    firstOrderOnly: false,
    stackLoyalty: false,
    target: "global",
    targetDetail: "",
    productIds: [],
  };
}

/** Live coupon as returned by /api/admin/marketing/coupons. */
interface LiveCoupon {
  id: string;
  code: string;
  kind: "percent" | "flat";
  value: number; // percent: whole %, flat: paise
  minOrderPaise: number;
  capPaise: number | null;
  active: boolean;
  endsAt?: string | null;
  requiresVerifiedPhone: boolean;
  pincodes: string[] | null;
  communities: string[] | null;
  productIds: string[] | null;
}

/**
 * Infer a targeting mode from what the coupon is actually restricted to.
 *
 * The mode used to be decorative — a label chosen in the form and thrown away.
 * Reading it back from the stored restrictions means the badge describes what
 * the server will really enforce.
 */
function targetOf(c: LiveCoupon): TargetMode {
  if (c.productIds?.length) return "product";
  if (c.communities?.length) return "community";
  if (c.pincodes?.length) return "zip";
  if (c.requiresVerifiedPhone) return "individual";
  return "global";
}

function toCampaign(c: LiveCoupon, perf: Perf | null): Campaign {
  return {
    id: c.id,
    code: c.code,
    description: "",
    type: c.kind,
    // Flat coupons are stored in paise; the form works in whole rupees.
    value: c.kind === "flat" ? Math.round(c.value / 100) : c.value,
    minOrderValue: Math.round(c.minOrderPaise / 100),
    maxDiscount: c.capPaise ? Math.round(c.capPaise / 100) : 0,
    expiresAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
    firstOrderOnly: c.requiresVerifiedPhone,
    stackLoyalty: false,
    target: targetOf(c),
    targetDetail: (c.pincodes ?? c.communities ?? []).join(", "),
    productIds: c.productIds ?? [],
    perf,
  };
}

function valueLabel(c: { type: "percent" | "flat"; value: number; maxDiscount?: number }): string {
  const base = c.type === "percent" ? `${c.value}%` : INR(c.value);
  const cap = c.type === "percent" && c.maxDiscount ? ` · max ${INR(c.maxDiscount)}` : "";
  return `${base}${cap}`;
}

/**
 * Return on the discount given.
 *
 * An em dash when nothing has been discounted yet: a coupon with no cost has no
 * ratio, and both "0×" and "∞×" would be read as findings.
 */
function roi(p: Perf | null): string {
  if (!p || p.discountPaise <= 0) return "—";
  return `${(p.revenuePaise / p.discountPaise).toFixed(1)}×`;
}

const rupees = (paise: number) => INR(paise / 100);

/* ----------------------------------------------------------------------- */
/* Main section.                                                            */
/* ----------------------------------------------------------------------- */
export function CouponCampaignBuilder() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [draft, setDraft] = React.useState<CampaignDraft>(emptyDraft);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // The performance panel mirrors whichever campaign is selected.
  const [trackingId, setTrackingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);

  /*
   * Load the real coupons and their measured performance together.
   *
   * On failure the panel says so rather than rendering an empty list: "no
   * campaigns" and "couldn't reach the database" look identical otherwise, and
   * only one of them is a reason to go and create a coupon.
   */
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [couponsRes, perfRes] = await Promise.all([
          fetch("/api/admin/marketing/coupons", { cache: "no-store" }),
          fetch("/api/admin/marketing/coupons/performance", { cache: "no-store" }),
        ]);
        if (!couponsRes.ok) throw new Error("coupons");
        const { coupons = [] } = (await couponsRes.json()) as { coupons?: LiveCoupon[] };

        // Performance is best-effort: the coupon list is still worth showing
        // without it, and every figure it feeds degrades to "not yet redeemed".
        const perfById = new Map<string, Perf>();
        if (perfRes.ok) {
          const { items = [] } = (await perfRes.json()) as { items?: Perf[] };
          for (const p of items) perfById.set(p.couponId, p);
        }

        if (!alive) return;
        const rows = coupons.map((c) => toCampaign(c, perfById.get(c.id) ?? null));
        setCampaigns(rows);
        setTrackingId((id) => id ?? rows[0]?.id ?? null);
      } catch {
        if (alive) setLoadFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tracked = campaigns.find((c) => c.id === trackingId) ?? campaigns[0] ?? null;
  const mode = TARGET_MODES.find((m) => m.value === draft.target)!;
  const isEditing = editingId !== null;
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [channels, setChannels] = React.useState({ email: true, sms: false });

  /**
   * Send the campaign for the code currently loaded in the form.
   *
   * Deliberately a separate action from Save. Saving makes a code valid at
   * checkout; sending messages the customer base. Bundling them would mean
   * every edit to a live coupon re-messaged everyone, and there would be no way
   * to fix a typo without spamming.
   */
  async function sendCampaign() {
    const code = draft.code.trim().toUpperCase();
    if (!code) return;

    const picked = (["email", "sms"] as const).filter((c) => channels[c]);
    if (picked.length === 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/marketing/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "offer",
          channels: picked,
          campaignKey: code,
          vars: {
            offerCode: code,
            offerTitle: draft.description || `${code} — Nutri Greenz`,
            discount: draft.type === "percent" ? `${draft.value}%` : INR(draft.value),
            // Every template ends on {ctaUrl}; without it the message trails off
            // into nothing and the SMS spends characters on a dangling arrow.
            ctaUrl: `${window.location.origin}/shop`,
            validTill: draft.expiresAt
              ? new Date(draft.expiresAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "",
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: {
          audience: number;
          email: { sent: number; skipped: number; failed: number; blocked?: string };
          sms: { sent: number; skipped: number; failed: number; blocked?: string };
        };
      };

      if (!res.ok || !data.ok || !data.result) {
        toast.error("Campaign not sent", {
          description:
            data.error === "consent-not-configured"
              ? "Marketing consent isn't set up yet — the consent migration hasn't been applied. Nothing was sent."
              : "The send failed. Nothing was delivered.",
        });
        return;
      }

      const r = data.result;
      const sentTotal = r.email.sent + r.sms.sent;
      const blocked = [r.email.blocked, r.sms.blocked].filter(Boolean);
      const parts = [
        channels.email ? `${r.email.sent} email` : null,
        channels.sms ? `${r.sms.sent} SMS` : null,
      ].filter(Boolean);

      if (sentTotal === 0) {
        // Never report a send of zero as a success — that is how an operator
        // ends up believing a campaign went out when nothing left the building.
        toast.error("Nothing was sent", {
          description: blocked.includes("no-promotional-dlt-template")
            ? "Promotional SMS needs a DLT-registered template. Set MSG91_PROMO_TEMPLATE_ID first."
            : blocked.length > 0
              ? `Channel unavailable: ${blocked.join(", ")}.`
              : `${r.audience} customers in the audience, but none were reachable or all had already received this code.`,
        });
        return;
      }

      toast.success(`${code} sent`, {
        description:
          `${parts.join(" · ")} across ${r.audience} customers.` +
          (r.email.failed + r.sms.failed > 0
            ? ` ${r.email.failed + r.sms.failed} failed.`
            : "") +
          (blocked.length > 0 ? ` Skipped: ${blocked.join(", ")}.` : ""),
      });
    } catch {
      toast.error("Campaign not sent", { description: "Couldn't reach the server." });
    } finally {
      setSending(false);
    }
  }

  function patch<K extends keyof CampaignDraft>(key: K, val: CampaignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function resetForm() {
    setDraft(emptyDraft());
    setEditingId(null);
  }

  function edit(c: Campaign) {
    setEditingId(c.id);
    setDraft({
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      expiresAt: c.expiresAt,
      firstOrderOnly: c.firstOrderOnly,
      stackLoyalty: c.stackLoyalty,
      target: c.target,
      targetDetail: c.targetDetail,
      productIds: c.productIds ?? [],
    });
    if (typeof document !== "undefined") {
      document.getElementById("coupons")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function save() {
    const code = draft.code.trim().toUpperCase();
    if (!code) {
      toast.error("Enter a campaign code");
      return;
    }
    if (draft.value <= 0) {
      toast.error("Set a discount value above zero");
      return;
    }
    const dup = campaigns.some((c) => c.code === code && c.id !== editingId);
    if (dup) {
      toast.error(`${code} already exists`);
      return;
    }

    /*
     * Persist through the same endpoints the live coupon manager uses.
     *
     * This form previously wrote to local React state only: a code an operator
     * "created" here was accepted, listed, toasted as queued to send — and gone
     * on reload, having never once been valid at checkout.
     */
    const areaList = draft.targetDetail
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      code,
      kind: draft.type,
      // Flat coupons are stored in paise; percent coupons in whole percent.
      value: draft.type === "flat" ? Math.round(draft.value * 100) : draft.value,
      minOrderPaise: Math.round(draft.minOrderValue * 100),
      capPaise: draft.maxDiscount > 0 ? Math.round(draft.maxDiscount * 100) : null,
      endsAt: draft.expiresAt || null,
      // "First order only" is enforced server-side as verified-phone +
      // once-per-customer, which is what that checkbox has always meant.
      requiresVerifiedPhone: draft.firstOrderOnly,
      // Each targeting mode writes only its own restriction and clears the rest,
      // so switching mode cannot leave a stale filter silently narrowing the code.
      pincodes: draft.target === "zip" ? areaList : null,
      communities: draft.target === "community" ? areaList : null,
      productIds: draft.target === "product" ? draft.productIds : null,
    };

    setSaving(true);
    try {
      const res = await fetch(
        isEditing
          ? `/api/admin/marketing/coupons/${editingId}`
          : "/api/admin/marketing/coupons",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error || "save-failed");
      }
      const { coupon } = (await res.json()) as { coupon: LiveCoupon };

      setCampaigns((cs) => {
        // Performance belongs to the code, not to this edit — carry it across.
        const existing = cs.find((c) => c.id === coupon.id);
        const row = toCampaign(coupon, existing?.perf ?? null);
        return existing ? cs.map((c) => (c.id === coupon.id ? row : c)) : [row, ...cs];
      });
      setTrackingId(coupon.id);
      toast.success(isEditing ? `${code} updated` : `${code} is live`, {
        description: `${mode.label} · valid at checkout now.`,
      });
      resetForm();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      toast.error("Not saved", {
        description:
          reason === "duplicate" || reason === "code-taken"
            ? `${code} already exists.`
            : "Couldn't save the coupon — it is not live. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const redeemedCount = campaigns.filter((c) => c.perf).length;

  return (
    <section id="coupons" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="ticket-sale-bold"
          tone="clay"
          title="Coupon campaign builder"
          caption="Create a targeted coupon and review how each code has actually performed."
          badge={
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-muted font-mono font-semibold">
              {campaigns.length} total
            </span>
          }
          action={
            isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-[12px] text-ng-ink-muted font-semibold hover:text-ng-forest transition-colors cursor-pointer"
              >
                <Icon name="close-circle-bold" size={15} />
                Cancel edit
              </button>
            ) : null
          }
        />

        {/* ---- Builder form ------------------------------------------------ */}
        <div className="rounded-2xl border border-ng-clay/25 bg-ng-clay/[0.04] p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid place-items-center size-7 rounded-lg bg-ng-clay/15 text-ng-clay-deep ring-1 ring-ng-clay/25">
              <Icon name={isEditing ? "pen-2-bold" : "magic-stick-3-bold"} size={15} />
            </span>
            <span className="font-display text-[15px] text-ng-forest-deep">
              {isEditing ? `Editing ${draft.code || "campaign"}` : "New campaign"}
            </span>
            {isEditing ? <Pill tone="warn">Editing</Pill> : null}
          </div>

          {/* Code + value + caps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <TextField
              label="Campaign code"
              value={draft.code}
              onChange={(v) => patch("code", v.toUpperCase())}
              placeholder="FRESH50"
              // A code can't be renamed once live — customers may already hold
              // it, and the server ignores a code change on update. Locking the
              // field is honest; letting it be typed and dropped is not.
              readOnly={isEditing}
              hint={isEditing ? "A live code can't be renamed. Create a new one instead." : undefined}
            />
            <SegToggle
              label="Discount type"
              value={draft.type}
              onChange={(v) => patch("type", v)}
              options={[
                { value: "percent", label: "Percent" },
                { value: "flat", label: "Flat ₹" },
              ]}
              hint={draft.type === "percent" ? "A % off the cart subtotal" : "A flat ₹ amount off"}
            />
            <NumberField
              label={draft.type === "percent" ? "Percent off" : "Flat amount off"}
              value={draft.value}
              onChange={(v) => patch("value", v)}
              prefix={draft.type === "flat" ? "₹" : undefined}
              suffix={draft.type === "percent" ? "%" : undefined}
              step={draft.type === "percent" ? 1 : 10}
              hint="The discount applied at checkout"
            />
            <NumberField
              label="Minimum cart value"
              value={draft.minOrderValue}
              onChange={(v) => patch("minOrderValue", v)}
              prefix="₹"
              step={10}
              hint="Cart must reach this to redeem"
            />
            <NumberField
              label="Max discount cap"
              value={draft.maxDiscount}
              onChange={(v) => patch("maxDiscount", v)}
              prefix="₹"
              step={10}
              hint={draft.type === "percent" ? "Ceiling on a % discount" : "0 — n/a for flat coupons"}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ng-campaign-expiry" className="text-[12.5px] font-medium text-ng-ink-muted">
                Expiry date
              </label>
              <input
                id="ng-campaign-expiry"
                type="date"
                value={draft.expiresAt}
                onChange={(e) => patch("expiresAt", e.target.value)}
                className="h-11 px-3.5 rounded-xl bg-ng-paper border border-ng-line outline-none text-[14px] text-ng-ink placeholder:text-ng-ink-soft focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200 cursor-pointer tabular-nums"
              />
              <p className="text-[11.5px] font-medium text-ng-ink-soft">Blank = perpetual</p>
            </div>
          </div>

          <TextField
            label="Description"
            value={draft.description}
            onChange={(v) => patch("description", v)}
            placeholder="₹50 off your first order"
            className="mt-5"
          />

          {/* Eligibility toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-2">
            <div className="border-b border-ng-line-soft sm:border-0">
              <Toggle
                label="First-order only"
                description="Restrict to first-time customers"
                checked={draft.firstOrderOnly}
                onChange={(on) => patch("firstOrderOnly", on)}
              />
            </div>
            <div>
              <Toggle
                label="Stack with loyalty"
                description="Allow points redemption on the same order"
                checked={draft.stackLoyalty}
                onChange={(on) => patch("stackLoyalty", on)}
              />
            </div>
          </div>

          {/* ---- Targeting modes (5) -------------------------------------- */}
          <div className="mt-5 pt-5 border-t border-ng-clay/20">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="target-bold" size={15} className="text-ng-clay-deep" />
              <span className="text-[12.5px] font-semibold text-ng-ink-muted">Targeting</span>
              <span className="text-[11.5px] font-medium text-ng-ink-soft">— who receives this campaign</span>
            </div>
            <div
              role="radiogroup"
              aria-label="Targeting mode"
              className="grid grid-cols-2 lg:grid-cols-5 gap-2.5"
            >
              {TARGET_MODES.map((m) => {
                const active = m.value === draft.target;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => patch("target", m.value)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 h-full rounded-xl border p-3 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
                      active
                        ? "border-ng-forest bg-ng-forest/[0.06] shadow-[0_2px_10px_rgba(31,77,46,0.10)]"
                        : "border-ng-line bg-ng-paper hover:border-ng-forest/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid place-items-center size-8 rounded-lg",
                        active ? "bg-ng-forest text-ng-cream" : "bg-ng-cream text-ng-forest",
                      )}
                    >
                      <Icon name={m.icon} size={16} />
                    </span>
                    <span className="text-[12.5px] font-semibold text-ng-ink leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] font-medium text-ng-ink-soft mt-2.5">{mode.hint}</p>
            {draft.target === "product" ? (
              /* Real catalogue rows, not typed text: the server matches order
                 lines by product id, so a typed name could never be enforced. */
              <div className="mt-3 max-w-xl">
                <ProductPicker
                  label="Products this code applies to"
                  hint="Leave empty to apply the coupon to every product."
                  value={draft.productIds}
                  onChange={(v) => patch("productIds", v)}
                />
              </div>
            ) : !mode.noSelector ? (
              <TextField
                label={mode.selectorLabel}
                value={draft.targetDetail}
                onChange={(v) => patch("targetDetail", v)}
                placeholder={mode.placeholder}
                className="mt-3 max-w-xl"
              />
            ) : null}
          </div>

          {/* ---- Send the campaign ---------------------------------------- */}
          <div className="mt-5 pt-5 border-t border-ng-clay/20">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="chat-round-line-bold" size={15} className="text-ng-clay-deep" />
              <span className="text-[12.5px] font-semibold text-ng-ink-muted">Send campaign</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-start">
              <div className="flex flex-col gap-3">
                {/*
                 * Channels are a per-customer decision, not a global one: each
                 * recipient is messaged on the channels they have an address for
                 * and have not opted out of. Ticking both does not double-message
                 * anyone who only has one.
                 */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-[12.5px] font-semibold text-ng-ink-muted mb-1">
                    Channels
                  </legend>
                  {(
                    [
                      { key: "email" as const, label: "Email", icon: "letter-bold" },
                      { key: "sms" as const, label: "SMS", icon: "smartphone-bold" },
                    ]
                  ).map((ch) => (
                    <label
                      key={ch.key}
                      className="flex items-center gap-2 text-[13px] text-ng-ink cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={channels[ch.key]}
                        onChange={(e) =>
                          setChannels((c) => ({ ...c, [ch.key]: e.target.checked }))
                        }
                        className="size-4 accent-ng-forest cursor-pointer"
                      />
                      <Icon name={ch.icon} size={14} className="text-ng-forest" />
                      {ch.label}
                    </label>
                  ))}
                </fieldset>
                <button
                  type="button"
                  disabled={sending || !isEditing || (!channels.email && !channels.sms)}
                  onClick={() => void sendCampaign()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ng-forest text-ng-forest-deep font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-sage/30 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Icon name="plain-bold" size={14} />
                  {sending ? "Sending…" : "Send now"}
                </button>
                <p className="text-[11px] text-ng-ink-soft leading-relaxed max-w-[190px]">
                  {isEditing
                    ? "Goes to customers who haven't opted out. Already-sent recipients are skipped."
                    : "Save the coupon first — a campaign sends an existing code."}
                </p>
              </div>

              {/* Live message preview */}
              <div className="rounded-xl border border-ng-line-soft bg-ng-cream/50 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ng-ink-muted font-mono font-semibold mb-2">
                  <Icon name="smartphone-bold" size={13} className="text-ng-forest" />
                  Message preview
                </div>
                <p className="text-[13px] font-medium text-ng-ink leading-relaxed">
                  Nutri Greenz: Use code{" "}
                  <span className="font-mono font-semibold text-ng-forest-deep">
                    {draft.code.trim().toUpperCase() || "CODE"}
                  </span>{" "}
                  for {draft.type === "percent" ? `${draft.value}% off` : `${INR(draft.value)} off`}
                  {draft.minOrderValue ? ` on orders ₹${draft.minOrderValue}+` : ""}
                  {draft.expiresAt
                    ? `. Valid till ${new Date(draft.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : ""}
                  . Shop fresh → nutrigreenz.farm
                </p>
                <p className="text-[11.5px] font-medium text-ng-ink-soft mt-2 font-mono">
                  ~{160} char SMS · email adds an unsubscribe footer
                </p>
              </div>
            </div>
          </div>

          {/* Save row */}
          <div className="mt-5 pt-4 border-t border-ng-clay/20 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11.5px] font-medium text-ng-ink-soft flex items-center gap-1.5 min-w-0">
              <Icon name="info-circle-bold" size={13} className="text-ng-clay-deep shrink-0" />
              <span>
                Saving makes the code live at checkout. Sending the campaign by SMS
                or email is not connected yet.
              </span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer shadow-[0_4px_14px_rgba(31,77,46,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name={isEditing ? "diskette-bold" : "rocket-2-bold"} size={14} />
                {saving ? "Saving…" : isEditing ? "Save changes" : "Create campaign"}
              </button>
            </div>
          </div>
        </div>

        {/* ---- Redemption performance ------------------------------------- */}
        {tracked ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="graph-up-bold" size={16} className="text-ng-forest" />
                <span className="text-[13px] font-semibold text-ng-ink-muted">
                  Redemption &amp; ROI
                </span>
                <span className="font-mono text-[12px] text-ng-forest-deep font-semibold">
                  {tracked.code}
                </span>
              </div>
              {tracked.perf?.lastRedeemedAt ? (
                <span className="text-[11px] text-ng-ink-soft font-medium">
                  last used{" "}
                  {new Date(tracked.perf.lastRedeemedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              ) : null}
            </div>
            {tracked.perf ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <TrackTile
                    icon="ticket-bold"
                    label="Redeemed"
                    value={tracked.perf.redemptions.toLocaleString("en-IN")}
                  />
                  <TrackTile
                    icon="users-group-rounded-bold"
                    label="Customers"
                    value={tracked.perf.customers.toLocaleString("en-IN")}
                  />
                  <TrackTile
                    icon="wad-of-money-bold"
                    label="Revenue"
                    value={rupees(tracked.perf.revenuePaise)}
                  />
                  <TrackTile icon="graph-new-up-bold" label="ROI" value={roi(tracked.perf)} accent />
                </div>
                <p className="mt-2 text-[11.5px] text-ng-ink-soft">
                  {rupees(tracked.perf.discountPaise)} discounted on paid orders
                  {tracked.perf.unpaidRedemptions > 0
                    ? ` · ${tracked.perf.unpaidRedemptions} redemption${tracked.perf.unpaidRedemptions === 1 ? "" : "s"} on unpaid orders, excluded from revenue`
                    : ""}
                  .
                </p>
              </>
            ) : (
              /*
               * No zeros here. A row of four zeros looks like a measurement that
               * came back empty; the truth is that there is nothing to measure.
               */
              <p className="rounded-xl border border-ng-line-soft bg-ng-paper px-3.5 py-3 text-[12.5px] text-ng-ink-muted">
                Not yet redeemed — no performance to report.
              </p>
            )}
          </div>
        ) : null}

        {/* ---- Campaign list ---------------------------------------------- */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] font-semibold text-ng-ink-muted flex items-center gap-2">
              <Icon name="clipboard-list-bold" size={16} className="text-ng-forest" />
              Campaigns
            </span>
            <span className="text-[11px] font-medium text-ng-ink-soft font-mono">
              {campaigns.length} live · {redeemedCount} redeemed
            </span>
          </div>
          <div className="grid grid-cols-[1.1fr_1.7fr_0.9fr_1fr_0.7fr_auto] gap-3 px-1 pb-2 mb-1 border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
            <span>Code</span>
            <span>Targeting</span>
            <span className="text-right">Value</span>
            <span className="text-right">Redeemed</span>
            <span className="text-right">ROI</span>
            <span className="text-right">Edit</span>
          </div>
          {loadFailed ? (
            <p className="rounded-xl border border-ng-danger/40 bg-ng-danger/5 px-3.5 py-3 text-[12.5px] text-ng-danger">
              Couldn&rsquo;t load coupons. This is a connection failure, not an empty
              list — reload before creating a code, or you may duplicate one.
            </p>
          ) : loading ? (
            <p className="px-1 py-3 text-[12.5px] text-ng-ink-muted">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="px-1 py-3 text-[12.5px] text-ng-ink-muted">
              No coupons yet. Create one above and it goes live at checkout immediately.
            </p>
          ) : null}
          <ul>
            {campaigns.map((c) => {
              const m = TARGET_MODES.find((x) => x.value === c.target)!;
              const selected = c.id === trackingId;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "grid grid-cols-[1.1fr_1.7fr_0.9fr_1fr_0.7fr_auto] gap-3 px-1 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 rounded-lg transition-colors",
                    selected && "bg-ng-clay/[0.06]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setTrackingId(c.id)}
                    aria-label={`Show tracking for ${c.code}`}
                    className="flex items-center gap-1.5 text-left cursor-pointer min-w-0"
                  >
                    <span className="font-mono text-[13px] text-ng-forest-deep font-semibold truncate">{c.code}</span>
                  </button>
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ng-ink-muted min-w-0">
                    <Icon name={m.icon} size={14} className="text-ng-forest shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-ng-ink text-right">{valueLabel(c)}</span>
                  <span className="tabular-nums font-medium text-ng-ink-muted text-right">
                    {c.perf ? c.perf.redemptions.toLocaleString("en-IN") : "—"}
                  </span>
                  <span className="font-mono tabular-nums text-[12.5px] font-semibold text-ng-ink text-right">
                    {roi(c.perf)}
                  </span>
                  <span className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => edit(c)}
                      aria-label={`Edit ${c.code}`}
                      className="size-8 grid place-items-center rounded-lg border border-ng-line text-ng-ink-muted hover:text-ng-forest hover:border-ng-forest/40 transition-colors cursor-pointer"
                    >
                      <Icon name="pen-2-bold" size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Compact stat tile for the redemption-tracking strip.                     */
/* ----------------------------------------------------------------------- */
function TrackTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="h-full rounded-xl border border-ng-line-soft bg-ng-cream/50 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-ng-ink-muted font-mono font-semibold">
        <Icon name={icon} size={13} className={accent ? "text-ng-clay-deep" : "text-ng-forest"} />
        {label}
      </div>
      <div
        className={cn(
          "font-mono tabular-nums text-[18px] font-semibold mt-1.5",
          accent ? "text-ng-clay-deep" : "text-ng-forest-deep",
        )}
      >
        {value}
      </div>
    </div>
  );
}
