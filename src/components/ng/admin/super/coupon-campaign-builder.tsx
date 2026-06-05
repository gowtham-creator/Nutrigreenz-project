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
import { COUPONS } from "@/components/ng/data";

/**
 * Super Admin · Coupon campaign builder (§3.5.2).
 *
 * A front-end builder that mirrors the scope's coupon lifecycle: create/edit a
 * campaign (code, type, value, min cart, max cap, expiry, first-order-only,
 * loyalty-stacking), choose one of the five targeting modes, stage an SMS
 * delivery (send now / schedule + live message preview), and review redemption
 * tracking (issued / redeemed / revenue / ROI — mocked). Existing seed coupons
 * from `COUPONS` are listed alongside campaigns built in-session.
 *
 * Demo only — SMS dispatch + real redemption tracking land in Milestone 2.
 * No store wiring here; all state is local so the headline commerce/loyalty
 * controls keep full ownership of persisted config.
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
  schedule: "now" | "schedule";
  scheduleAt: string; // datetime-local or ""
};

type Campaign = CampaignDraft & {
  id: string;
  /** Mock redemption tracking — populated for seed campaigns, zero for new. */
  issued: number;
  redeemed: number;
  revenue: number; // ₹ attributable revenue
  cost: number; // ₹ discount given (for ROI)
  source: "seed" | "built";
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
    schedule: "now",
    scheduleAt: "",
  };
}

/** Seed the list from the shared COUPONS catalogue with plausible mock stats. */
function seedCampaigns(): Campaign[] {
  const stats: Record<string, { issued: number; redeemed: number; revenue: number; cost: number; target: TargetMode }> = {
    FRESH50: { issued: 1840, redeemed: 612, revenue: 248_900, cost: 30_600, target: "individual" },
    HARVEST10: { issued: 5200, redeemed: 1486, revenue: 712_300, cost: 64_180, target: "global" },
    GHEELOVE: { issued: 920, redeemed: 214, revenue: 196_400, cost: 16_050, target: "product" },
    MONSOON25: { issued: 3100, redeemed: 705, revenue: 281_200, cost: 70_300, target: "zip" },
  };
  return COUPONS.map((c) => {
    const s = stats[c.code] ?? { issued: 0, redeemed: 0, revenue: 0, cost: 0, target: "global" as TargetMode };
    return {
      id: `seed-${c.code}`,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue ?? 0,
      maxDiscount: c.maxDiscount ?? 0,
      expiresAt: c.expiresAt ?? "",
      firstOrderOnly: Boolean(c.firstOrderOnly),
      stackLoyalty: false,
      target: s.target,
      targetDetail: "",
      schedule: "now" as const,
      scheduleAt: "",
      issued: s.issued,
      redeemed: s.redeemed,
      revenue: s.revenue,
      cost: s.cost,
      source: "seed" as const,
    };
  });
}

function valueLabel(c: { type: "percent" | "flat"; value: number; maxDiscount?: number }): string {
  const base = c.type === "percent" ? `${c.value}%` : INR(c.value);
  const cap = c.type === "percent" && c.maxDiscount ? ` · max ${INR(c.maxDiscount)}` : "";
  return `${base}${cap}`;
}

function roi(c: { revenue: number; cost: number }): string {
  if (c.cost <= 0) return "—";
  return `${(c.revenue / c.cost).toFixed(1)}×`;
}

function redemptionRate(c: { issued: number; redeemed: number }): string {
  if (c.issued <= 0) return "—";
  return `${Math.round((c.redeemed / c.issued) * 100)}%`;
}

/* ----------------------------------------------------------------------- */
/* Main section.                                                            */
/* ----------------------------------------------------------------------- */
export function CouponCampaignBuilder() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>(seedCampaigns);
  const [draft, setDraft] = React.useState<CampaignDraft>(emptyDraft);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // The redemption tracking panel mirrors whichever campaign is selected.
  const [trackingId, setTrackingId] = React.useState<string | null>(
    () => seedCampaigns()[0]?.id ?? null,
  );

  const tracked = campaigns.find((c) => c.id === trackingId) ?? campaigns[0] ?? null;
  const mode = TARGET_MODES.find((m) => m.value === draft.target)!;
  const isEditing = editingId !== null;

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
      schedule: c.schedule,
      scheduleAt: c.scheduleAt,
    });
    if (typeof document !== "undefined") {
      document.getElementById("coupons")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function save() {
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

    if (isEditing) {
      setCampaigns((cs) =>
        cs.map((c) =>
          c.id === editingId ? { ...c, ...draft, code } : c,
        ),
      );
      toast.success(`Campaign ${code} updated`, {
        description: "Demo · SMS send + live tracking ship in Milestone 2.",
      });
    } else {
      const created: Campaign = {
        ...draft,
        code,
        id: `built-${Date.now()}`,
        issued: 0,
        redeemed: 0,
        revenue: 0,
        cost: 0,
        source: "built",
      };
      setCampaigns((cs) => [created, ...cs]);
      setTrackingId(created.id);
      const when =
        draft.schedule === "now"
          ? "queued to send now"
          : draft.scheduleAt
            ? `scheduled for ${new Date(draft.scheduleAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : "saved (no schedule set)";
      toast.success(`Campaign ${code} created`, {
        description: `${mode.label} · ${when}. Demo · send/track = M2.`,
      });
    }
    resetForm();
  }

  const builtCount = campaigns.filter((c) => c.source === "built").length;

  return (
    <section id="coupons" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="ticket-sale-bold"
          tone="clay"
          title="Coupon campaign builder"
          caption="Create a targeted coupon, stage SMS delivery and review redemption & ROI — per §3.5.2."
          badge={
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft font-mono">
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
              <p className="text-[11.5px] text-ng-ink-soft">Blank = perpetual</p>
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
              <span className="text-[11px] text-ng-ink-soft">— who receives this campaign</span>
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
            <p className="text-[11.5px] text-ng-ink-soft mt-2.5">{mode.hint}</p>
            {!mode.noSelector ? (
              <TextField
                label={mode.selectorLabel}
                value={draft.targetDetail}
                onChange={(v) => patch("targetDetail", v)}
                placeholder={mode.placeholder}
                className="mt-3 max-w-xl"
              />
            ) : null}
          </div>

          {/* ---- SMS delivery schedule ------------------------------------ */}
          <div className="mt-5 pt-5 border-t border-ng-clay/20">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="chat-round-line-bold" size={15} className="text-ng-clay-deep" />
              <span className="text-[12.5px] font-semibold text-ng-ink-muted">SMS delivery</span>
              <Pill tone="neutral">M2</Pill>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-start">
              <div className="flex flex-col gap-3">
                <SegToggle
                  label="Send"
                  value={draft.schedule}
                  onChange={(v) => patch("schedule", v)}
                  options={[
                    { value: "now", label: "Send now" },
                    { value: "schedule", label: "Schedule" },
                  ]}
                  hint={draft.schedule === "now" ? "Dispatches on save" : "Pick a date & time"}
                />
                {draft.schedule === "schedule" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ng-sms-when" className="text-[12.5px] font-medium text-ng-ink-muted">
                      Scheduled at
                    </label>
                    <input
                      id="ng-sms-when"
                      type="datetime-local"
                      value={draft.scheduleAt}
                      onChange={(e) => patch("scheduleAt", e.target.value)}
                      className="h-11 px-3.5 rounded-xl bg-ng-paper border border-ng-line outline-none text-[14px] text-ng-ink focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200 cursor-pointer tabular-nums"
                    />
                  </div>
                ) : null}
              </div>

              {/* Live message preview */}
              <div className="rounded-xl border border-ng-line-soft bg-ng-cream/50 p-3.5">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-mono mb-2">
                  <Icon name="smartphone-bold" size={13} className="text-ng-forest" />
                  Message preview
                </div>
                <p className="text-[13px] text-ng-ink leading-relaxed">
                  Nutri Greenz: Use code{" "}
                  <span className="font-mono font-semibold text-ng-forest-deep">
                    {draft.code.trim().toUpperCase() || "CODE"}
                  </span>{" "}
                  for {draft.type === "percent" ? `${draft.value}% off` : `${INR(draft.value)} off`}
                  {draft.minOrderValue ? ` on orders ₹${draft.minOrderValue}+` : ""}
                  {draft.expiresAt
                    ? `. Valid till ${new Date(draft.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : ""}
                  . Shop fresh → nutrigreenz.in
                </p>
                <p className="text-[10.5px] text-ng-ink-soft mt-2 font-mono">
                  ~{160} char SMS · sent to {mode.label.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Save row */}
          <div className="mt-5 pt-4 border-t border-ng-clay/20 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11.5px] text-ng-ink-soft flex items-center gap-1.5 min-w-0">
              <Icon name="info-circle-bold" size={13} className="text-ng-clay-deep shrink-0" />
              <span>Demo · campaign send &amp; live redemption tracking ship in Milestone 2.</span>
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
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer shadow-[0_4px_14px_rgba(31,77,46,0.22)]"
              >
                <Icon name={isEditing ? "diskette-bold" : "rocket-2-bold"} size={14} />
                {isEditing ? "Save changes" : "Create campaign"}
              </button>
            </div>
          </div>
        </div>

        {/* ---- Redemption tracking panel ---------------------------------- */}
        {tracked ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="graph-up-bold" size={16} className="text-ng-forest" />
                <span className="text-[13px] font-semibold text-ng-ink-muted">Redemption &amp; ROI</span>
                <span className="font-mono text-[12px] text-ng-forest-deep font-semibold">{tracked.code}</span>
              </div>
              <span className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-mono">Mock · M2 live</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
              <TrackTile icon="letter-bold" label="Issued" value={tracked.issued.toLocaleString("en-IN")} />
              <TrackTile icon="ticket-bold" label="Redeemed" value={tracked.redeemed.toLocaleString("en-IN")} />
              <TrackTile icon="check-circle-bold" label="Redeem rate" value={redemptionRate(tracked)} />
              <TrackTile icon="wad-of-money-bold" label="Revenue" value={INR(tracked.revenue)} />
              <TrackTile icon="graph-new-up-bold" label="ROI" value={roi(tracked)} accent />
            </div>
          </div>
        ) : null}

        {/* ---- Campaign list ---------------------------------------------- */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] font-semibold text-ng-ink-muted flex items-center gap-2">
              <Icon name="clipboard-list-bold" size={16} className="text-ng-forest" />
              Campaigns
            </span>
            <span className="text-[11px] text-ng-ink-soft font-mono">
              {builtCount} built · {campaigns.length - builtCount} seed
            </span>
          </div>
          <div className="grid grid-cols-[1.1fr_1.7fr_0.9fr_1fr_0.7fr_auto] gap-3 px-1 pb-2 mb-1 border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
            <span>Code</span>
            <span>Targeting</span>
            <span>Value</span>
            <span>Redeemed</span>
            <span>ROI</span>
            <span className="text-right">Edit</span>
          </div>
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
                    {c.source === "built" ? <Pill tone="info">New</Pill> : null}
                  </button>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ng-ink-muted min-w-0">
                    <Icon name={m.icon} size={14} className="text-ng-forest shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <span className="font-medium tabular-nums">{valueLabel(c)}</span>
                  <span className="tabular-nums text-ng-ink-muted">
                    {c.issued > 0 ? `${c.redeemed.toLocaleString("en-IN")} / ${c.issued.toLocaleString("en-IN")}` : "—"}
                  </span>
                  <span className="font-mono tabular-nums text-[12.5px]">{roi(c)}</span>
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
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-ng-ink-soft font-mono">
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
