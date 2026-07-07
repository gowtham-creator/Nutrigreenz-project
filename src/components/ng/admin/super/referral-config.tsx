"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { SectionHeader, PrimarySection } from "@/components/ng/admin/super/command-center";
import { NumberField, Toggle, SaveBar } from "@/components/ng/admin/super/controls";

/**
 * Super Admin · Referral programme config (§3.7).
 *
 * Reward values (referrer loyalty credit + referee first-order discount), the
 * confirmed-order qualifier, monthly cap and reward expiry, plus the scope's
 * three anti-abuse guards (same-device, mobile dedupe, address-cluster).
 *
 * DB-backed: loads and saves the singleton config through the super-admin-gated
 * `/api/admin/config/referral` endpoint (Supabase service-role). Money is edited
 * in ₹ here but persisted as integer paise. Rewards are tied to confirmed
 * (non-cancellable) orders per the No-Cancellation policy, so there is no
 * claw-back path here.
 */

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export type ReferralConfig = {
  referrerPoints: number; // loyalty points credited to the referrer
  refereeDiscount: number; // ₹ off the referee's first order
  minQualifyingOrder: number; // ₹ subtotal the referee must place
  maxPerMonth: number; // cap on rewarded referrals / referrer / month
  expiryDays: number; // referral link / reward validity
  enabled: boolean;
  // Anti-abuse guards (SCOPE §3.7)
  blockSameDevice: boolean;
  dedupeMobile: boolean;
  blockAddressCluster: boolean;
};

/** The paise-denominated shape the API returns / accepts. */
type ApiReferralConfig = {
  referrerPoints: number;
  refereeDiscountPaise: number;
  minQualifyingOrderPaise: number;
  maxPerMonth: number;
  expiryDays: number;
  enabled: boolean;
  blockSameDevice: boolean;
  dedupeMobile: boolean;
  blockAddressCluster: boolean;
};

const DEFAULTS: ReferralConfig = {
  referrerPoints: 200,
  refereeDiscount: 100,
  minQualifyingOrder: 499,
  maxPerMonth: 10,
  expiryDays: 30,
  enabled: true,
  blockSameDevice: true,
  dedupeMobile: true,
  blockAddressCluster: false,
};

const API = "/api/admin/config/referral";

/** Map the API's paise config into the ₹-denominated editor shape. */
function fromApi(c: ApiReferralConfig): ReferralConfig {
  return {
    referrerPoints: c.referrerPoints,
    refereeDiscount: Math.round(c.refereeDiscountPaise / 100),
    minQualifyingOrder: Math.round(c.minQualifyingOrderPaise / 100),
    maxPerMonth: c.maxPerMonth,
    expiryDays: c.expiryDays,
    enabled: c.enabled,
    blockSameDevice: c.blockSameDevice,
    dedupeMobile: c.dedupeMobile,
    blockAddressCluster: c.blockAddressCluster,
  };
}

/** Map the editor's ₹ values back into the API's paise payload. */
function toApiPayload(c: ReferralConfig): ApiReferralConfig {
  return {
    referrerPoints: c.referrerPoints,
    refereeDiscountPaise: Math.round(c.refereeDiscount * 100),
    minQualifyingOrderPaise: Math.round(c.minQualifyingOrder * 100),
    maxPerMonth: c.maxPerMonth,
    expiryDays: c.expiryDays,
    enabled: c.enabled,
    blockSameDevice: c.blockSameDevice,
    dedupeMobile: c.dedupeMobile,
    blockAddressCluster: c.blockAddressCluster,
  };
}

const ABUSE_GUARDS: {
  key: "blockSameDevice" | "dedupeMobile" | "blockAddressCluster";
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    key: "blockSameDevice",
    label: "Same-device block",
    desc: "Reject referee sign-ups from the referrer's device fingerprint",
    icon: "smartphone-bold",
  },
  {
    key: "dedupeMobile",
    label: "Mobile dedupe",
    desc: "One reward per unique mobile number — no recycled numbers",
    icon: "phone-bold",
  },
  {
    key: "blockAddressCluster",
    label: "Address-cluster guard",
    desc: "Flag bursts of referrals sharing one delivery address",
    icon: "map-point-wave-bold",
  },
];

export function ReferralConfigSection() {
  const [saved, setSaved] = React.useState<ReferralConfig>(DEFAULTS);
  const [draft, setDraft] = React.useState<ReferralConfig>(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; config?: ApiReferralConfig };
        if (!cancelled && res.ok && data.ok !== false && data.config) {
          const next = fromApi(data.config);
          setSaved(next);
          setDraft(next);
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

  function patch<K extends keyof ReferralConfig>(key: K, val: ReferralConfig[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toApiPayload(draft)),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        config?: ApiReferralConfig;
        error?: string;
      };
      if (!res.ok || data.ok === false || !data.config) {
        throw new Error(data.error || "save-failed");
      }
      const next = fromApi(data.config);
      setSaved(next);
      setDraft(next);
      toast.success("Referral programme saved", {
        description: `Referrer +${next.referrerPoints} pts · referee ${INR(next.refereeDiscount)} off.`,
      });
    } catch (err) {
      toast.error("Could not save referral programme", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    setDraft(saved);
    toast.info("Reverted unsaved changes");
  }

  const guardsOn = ABUSE_GUARDS.filter((g) => draft[g.key]).length;

  return (
    <PrimarySection id="referrals">
      <Card>
        <SectionHeader
          icon="share-bold"
          tone="clay"
          title="Referral programme"
          caption="Reward values, the confirmed-order qualifier and anti-abuse guards — drives refer-a-friend."
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

        {/* Reward values + qualifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField
            label="Referrer credit"
            value={draft.referrerPoints}
            onChange={(v) => patch("referrerPoints", v)}
            suffix="pts"
            step={10}
            hint="Loyalty points after the referee's confirmed order"
          />
          <NumberField
            label="Referee discount"
            value={draft.refereeDiscount}
            onChange={(v) => patch("refereeDiscount", v)}
            prefix="₹"
            step={10}
            hint="First-order coupon for the friend"
          />
          <NumberField
            label="Min qualifying order"
            value={draft.minQualifyingOrder}
            onChange={(v) => patch("minQualifyingOrder", v)}
            prefix="₹"
            step={10}
            hint="Subtotal the referee must place"
          />
          <NumberField
            label="Max referrals / month"
            value={draft.maxPerMonth}
            onChange={(v) => patch("maxPerMonth", v)}
            suffix="/mo"
            step={1}
            hint="Rewarded referrals per referrer"
          />
          <NumberField
            label="Reward expiry"
            value={draft.expiryDays}
            onChange={(v) => patch("expiryDays", v)}
            suffix="days"
            step={1}
            hint="Link & reward validity window"
          />
          <div className="flex items-center">
            <div className="w-full rounded-xl border border-ng-line-soft bg-ng-cream/50 px-4">
              <Toggle
                label="Programme enabled"
                description="Turn off to pause all referral rewards"
                checked={draft.enabled}
                onChange={(on) => patch("enabled", on)}
              />
            </div>
          </div>
        </div>

        {/* Anti-abuse guards */}
        <div className="mt-6 pt-5 border-t border-ng-line-soft">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="shield-check-bold" size={16} className="text-ng-clay-deep" />
            <span className="text-[12.5px] font-semibold text-ng-ink-muted">Anti-abuse guards</span>
            <span className="text-[11px] font-medium text-ng-ink-soft font-mono">
              {guardsOn} / {ABUSE_GUARDS.length} on
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {ABUSE_GUARDS.map((g) => {
              const on = draft[g.key];
              return (
                <div
                  key={g.key}
                  className="h-full rounded-xl border border-ng-line-soft bg-ng-cream/40 px-4 py-1"
                >
                  <Toggle
                    label={
                      <span className="flex items-center gap-1.5">
                        <Icon
                          name={g.icon}
                          size={14}
                          className={on ? "text-ng-forest" : "text-ng-ink-soft"}
                        />
                        {g.label}
                      </span>
                    }
                    description={g.desc}
                    checked={on}
                    onChange={(v) => patch(g.key, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <SaveBar
          note={
            saving
              ? "Saving…"
              : "Persisted to Supabase. Rewards fire only after a referee's confirmed order — no claw-back."
          }
          onSave={save}
          onReset={reset}
          dirty={dirty}
        />
      </Card>
    </PrimarySection>
  );
}
