"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

/**
 * LiveCouponsPanel — the REAL coupon manager backed by the `coupons` table
 * (super-admin `/api/admin/marketing/coupons`). Lists live coupons with their
 * usage counts and supports create + deactivate. Sits alongside the campaign
 * ROI planner, which stays a forward-looking planning surface.
 *
 * Money is entered in ₹ and stored as integer paise; percent coupons take a
 * whole-number percent. A coupon that has been used is never hard-deleted —
 * it is deactivated so historical orders keep a valid reference.
 */

interface CouponRow {
  id: string;
  code: string;
  kind: "percent" | "flat";
  value: number; // percent: whole %, flat: paise
  minOrderPaise: number;
  capPaise: number | null;
  active: boolean;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  requiresVerifiedPhone: boolean;
  /** Delivery pincodes the code is limited to; null = every pincode. */
  pincodes: string[] | null;
  /** Gated communities the code is limited to; null = every community. */
  communities: string[] | null;
  /** Products the code is limited to; null = every product. */
  productIds: string[] | null;
  usedCount: number;
}

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

function describe(c: CouponRow): string {
  const off = c.kind === "percent" ? `${c.value}% off` : `${rupees(c.value)} off`;
  const cap = c.kind === "percent" && c.capPaise ? ` (max ${rupees(c.capPaise)})` : "";
  const min = c.minOrderPaise > 0 ? ` · min ${rupees(c.minOrderPaise)}` : "";
  return `${off}${cap}${min}`;
}

const EMPTY = {
  code: "",
  kind: "percent" as "percent" | "flat",
  value: "",
  minOrder: "",
  cap: "",
  perCustomerLimit: "1",
  requiresPhone: false,
  pincodes: "",
  communities: "",
};

export function LiveCouponsPanel() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/coupons", { cache: "no-store" });
      if (!res.ok) {
        setCoupons([]);
        return;
      }
      const json = (await res.json()) as { coupons?: CouponRow[] };
      setCoupons(json.coupons ?? []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    if (!code) return toast.error("Enter a coupon code.");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a discount value.");

    const body = {
      code,
      kind: form.kind,
      // percent → whole percent; flat → ₹ entered, stored as paise
      value: form.kind === "percent" ? Math.round(value) : Math.round(value * 100),
      minOrderPaise: form.minOrder ? Math.round(Number(form.minOrder) * 100) : 0,
      capPaise: form.kind === "percent" && form.cap ? Math.round(Number(form.cap) * 100) : null,
      perCustomerLimit: form.perCustomerLimit ? Math.round(Number(form.perCustomerLimit)) : null,
      // Welcome/first-order codes require an OTP-verified phone + are once-per-customer.
      requiresVerifiedPhone: form.requiresPhone,
      // Area targeting — comma/newline separated; blank means "valid everywhere".
      pincodes: form.pincodes.trim() || null,
      communities: form.communities.trim() || null,
      active: true,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error === "code-required" ? "Code required." : `Couldn't create coupon${json.error ? ` (${json.error})` : ""}.`);
        return;
      }
      toast.success(`${code} created`);
      setForm(EMPTY);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(c: CouponRow, active: boolean) {
    try {
      const res = await fetch(`/api/admin/marketing/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        toast.error("Couldn't update coupon.");
        return;
      }
      toast.success(`${c.code} ${active ? "activated" : "deactivated"}`);
      await load();
    } catch {
      toast.error("Couldn't update coupon.");
    }
  }

  return (
    <section id="live-coupons" className="mb-6 scroll-mt-32 rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-forest/10 text-ng-forest">
          <Icon name="ticket-bold" size={20} />
        </span>
        <div>
          <h2 className="font-display text-[22px] leading-tight text-ng-forest-deep">Live coupons</h2>
          <p className="text-[13px] text-ng-ink-muted">Real codes customers can redeem at checkout — validated server-side.</p>
        </div>
      </div>

      {/* Create form */}
      <div className="mb-6 grid gap-3 rounded-2xl border border-ng-line-soft bg-ng-sage/20 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Input label="Code" placeholder="HARVEST10" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ng-ink-muted">Type</label>
          <div className="flex gap-1.5">
            {(["percent", "flat"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-[13px] font-semibold capitalize transition-all",
                  form.kind === k ? "border-ng-forest bg-ng-forest text-ng-paper" : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-leaf",
                )}
              >
                {k === "percent" ? "%" : "Flat ₹"}
              </button>
            ))}
          </div>
        </div>
        <Input label={form.kind === "percent" ? "Percent" : "Amount (₹)"} inputMode="numeric" placeholder={form.kind === "percent" ? "10" : "50"} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/[^\d.]/g, "") }))} />
        <Input label="Min order (₹)" inputMode="numeric" placeholder="599" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value.replace(/[^\d.]/g, "") }))} />
        {form.kind === "percent" ? (
          <Input label="Max cap (₹)" inputMode="numeric" placeholder="150" value={form.cap} onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value.replace(/[^\d.]/g, "") }))} />
        ) : (
          <Input label="Per-customer" inputMode="numeric" placeholder="1" value={form.perCustomerLimit} onChange={(e) => setForm((f) => ({ ...f, perCustomerLimit: e.target.value.replace(/\D/g, "") }))} />
        )}
        <div className="flex items-end">
          <Button type="button" variant="primary" onClick={() => void create()} disabled={saving} className="h-11 w-full">
            {saving ? "Adding…" : "Add coupon"}
          </Button>
        </div>

        {/* Welcome / first-order gate — requires an OTP-verified phone + once per customer. */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ng-line-soft bg-ng-paper px-4 py-3 sm:col-span-2 lg:col-span-6">
          <input
            type="checkbox"
            checked={form.requiresPhone}
            onChange={(e) => setForm((f) => ({ ...f, requiresPhone: e.target.checked }))}
            className="h-4 w-4 shrink-0 accent-ng-forest"
          />
          <span className="flex items-center gap-1.5 text-[13px] leading-snug text-ng-ink">
            <Icon name="phone-bold" size={14} className="text-ng-clay-deep" />
            <span>
              <span className="font-semibold text-ng-forest-deep">First-order / welcome code</span>
              {" "}— requires a verified phone (once per customer)
            </span>
          </span>
        </label>

        {/* Area targeting — restrict the code to specific pincodes and/or gated
            communities. Both blank = redeemable anywhere we deliver. */}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-6">
          <Input
            label="Limit to pincodes (optional)"
            placeholder="500072, 500085"
            value={form.pincodes}
            onChange={(e) => setForm((f) => ({ ...f, pincodes: e.target.value }))}
          />
          <Input
            label="Limit to gated communities (optional)"
            placeholder="My Home Bhooja, Aparna Sarovar"
            value={form.communities}
            onChange={(e) => setForm((f) => ({ ...f, communities: e.target.value }))}
          />
          <p className="text-[12px] leading-relaxed text-ng-ink-soft sm:col-span-2">
            Comma-separated. Leave both blank for a code that works everywhere we deliver.
            Community names must match the ones on your serviceable-areas list, and are
            checked against the customer&rsquo;s delivery pincode at checkout.
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">No coupons yet — create your first above.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ng-line-soft">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-ng-sage/30 text-ng-forest-deep">
              <tr>
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-5 py-3 font-semibold">Discount</th>
                <th className="px-5 py-3 font-semibold text-right">Used</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ng-line-soft">
              {coupons.map((c) => (
                <tr key={c.id} className="bg-ng-paper">
                  <td className="px-5 py-3.5 font-display text-[14px] text-ng-forest-deep">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {c.code}
                      {c.requiresVerifiedPhone ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ng-clay/20 px-2 py-0.5 text-[10px] font-semibold text-ng-clay-deep" title="Welcome / first-order code — requires a verified phone, once per customer">
                          <Icon name="phone-bold" size={10} />
                          Welcome
                        </span>
                      ) : null}
                      {c.pincodes?.length ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-ng-forest/12 px-2 py-0.5 text-[10px] font-semibold text-ng-forest-deep"
                          title={`Valid only in pincodes: ${c.pincodes.join(", ")}`}
                        >
                          <Icon name="map-point-bold" size={10} />
                          {c.pincodes.length === 1 ? c.pincodes[0] : `${c.pincodes.length} pincodes`}
                        </span>
                      ) : null}
                      {c.communities?.length ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/20 px-2 py-0.5 text-[10px] font-semibold text-ng-forest-deep"
                          title={`Valid only in communities: ${c.communities.join(", ")}`}
                        >
                          <Icon name="users-group-rounded-bold" size={10} />
                          {c.communities.length === 1
                            ? c.communities[0]
                            : `${c.communities.length} communities`}
                        </span>
                      ) : null}
                      {c.productIds?.length ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-ng-clay/25 px-2 py-0.5 text-[10px] font-semibold text-ng-clay-deep"
                          title="Only applies when the cart contains one of the targeted products"
                        >
                          <UiIcon name="bag" size={10} />
                          {c.productIds.length === 1
                            ? "1 product"
                            : `${c.productIds.length} products`}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ng-ink-muted">{describe(c)}</td>
                  <td className="px-5 py-3.5 tabular-nums text-ng-ink-muted text-right">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", c.active ? "bg-ng-green-bright/15 text-ng-forest" : "bg-ng-line text-ng-ink-soft")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", c.active ? "bg-ng-green-bright" : "bg-ng-ink-soft")} />
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => void setActive(c, !c.active)}
                      className="text-[13px] font-semibold text-ng-forest transition-colors hover:text-ng-leaf"
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
