"use client";

interface StallItem {
  variantId: string;
  sku: string;
  title: string;
  unit: string;
  pack: string | null;
  price: number;
  available: number;
}

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CaptainShell,
  CaptainCard,
  CaptainSectionHead,
  CaptainEmpty,
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import {
  useCaptain,
  formatInr,
  type PayMode,
  type CapturedLineItem,
} from "@/components/ng/captain/captain-store";

/** Quantities are keyed by VARIANT id. Keying by SKU merged two variants that
 *  shared (or lacked) a SKU into one line. */
type Cart = Record<string, number>;

/** The server refuses more than this per line. */
const MAX_QTY = 999;

export default function CaptainIntake() {
  const { addCustomer, todayCustomers, communities } = useCaptain();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [community, setCommunity] = useState(communities[0]);
  // Snap the selection into the captain's assigned communities once identity loads.
  useEffect(() => {
    if (!communities.includes(community)) setCommunity(communities[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communities]);
  /* The tray comes from this captain's allocation, not a hardcoded list. The
     old STALL_CATALOG had SKUs that matched no real product, so cash was being
     taken against lines the business could not reconcile. */
  const [catalogue, setCatalogue] = useState<StallItem[] | null>(null);
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const loadCatalogue = useCallback(async (alive: () => boolean = () => true) => {
    setCatalogueFailed(false);
    try {
      const res = await fetch("/api/captain/catalogue", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items?: StallItem[] };
      if (alive()) setCatalogue(data.items ?? []);
    } catch {
      if (alive()) setCatalogueFailed(true);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    void loadCatalogue(() => alive);
    return () => {
      alive = false;
    };
  }, [loadCatalogue]);

  const [cart, setCart] = useState<Cart>({});
  const [payMode, setPayMode] = useState<PayMode>("Cash");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const lineItems = useMemo<CapturedLineItem[]>(
    () =>
      (catalogue ?? [])
        .filter((p) => (cart[p.variantId] ?? 0) > 0)
        .map((p) => ({
          sku: p.sku,
          title: p.title,
          unit: p.pack ? `${p.unit} · ${p.pack}` : p.unit,
          price: p.price,
          qty: cart[p.variantId],
          // Sent so the server can check the line against this captain's
          // allocation and join the sale to the real catalogue.
          variantId: p.variantId,
        })),
    [cart, catalogue],
  );
  // Summed in paise: rupee floats drift (₹349.50 × 3 is not 1048.5 exactly).
  const total = useMemo(
    () => lineItems.reduce((s, i) => s + Math.round(i.price * 100) * i.qty, 0) / 100,
    [lineItems],
  );
  const cartCount = useMemo(() => lineItems.reduce((s, i) => s + i.qty, 0), [lineItems]);

  const mobileValid = /^[6-9]\d{9}$/.test(mobile);
  const nameValid = name.trim().length >= 2;
  const hasItems = lineItems.length > 0;
  const canSubmit = nameValid && mobileValid && hasItems;

  function setQty(variantId: string, delta: number) {
    setCart((prev) => {
      const next = Math.min(MAX_QTY, Math.max(0, (prev[variantId] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[variantId];
      else copy[variantId] = next;
      return copy;
    });
  }

  function reset() {
    setName("");
    setMobile("");
    setCommunity(communities[0]);
    setCart({});
    setPayMode("Cash");
    setNotes("");
    setTouched(false);
  }

  function handleCapture() {
    setTouched(true);
    if (!canSubmit) {
      toast.error("Sale not saved yet", {
        description: "Add the customer's name, a 10-digit mobile and at least one product.",
      });
      return;
    }
    addCustomer({
      name: name.trim(),
      mobile,
      community,
      items: lineItems,
      total,
      payMode,
      notes: notes.trim() || undefined,
    });
    toast.success(`Sale saved for ${name.trim()}`, {
      description: `${formatInr(total)}, ${payMode}, +91 ${mobile}`,
    });
    reset();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const missing = !nameValid
    ? "Add the customer's name"
    : !mobileValid
      ? "Add a 10-digit mobile"
      : !hasItems
        ? "Add at least one product"
        : null;

  return (
    <CaptainShell
      eyebrow="Stall sale"
      title="Record a sale"
      subtitle="The mobile number links this sale to the customer's account when they sign up online."
    >
      {/* Customer details */}
      <CaptainSectionHead className="mt-2">Customer</CaptainSectionHead>
      <CaptainCard className="space-y-4">
        <Field label="Full name" required error={touched && !nameValid ? "Enter the customer's name." : null}>
          {(ids) => (
            <input
              id={ids.input}
              aria-describedby={ids.describedBy}
              aria-invalid={touched && !nameValid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lakshmi Narayan"
              autoComplete="name"
              className={inputCls(touched && !nameValid)}
            />
          )}
        </Field>

        <Field
          label="Mobile number"
          required
          hint="10-digit Indian mobile, without +91."
          error={touched && !mobileValid ? "Enter a 10-digit mobile that starts with 6, 7, 8 or 9." : null}
        >
          {(ids) => (
            <div className={inputWrapCls(touched && !mobileValid)}>
              <span className="text-[16px] text-ng-ink-muted tabular-nums" aria-hidden>
                +91
              </span>
              <input
                id={ids.input}
                aria-describedby={ids.describedBy}
                aria-invalid={touched && !mobileValid}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98XXXXXXXX"
                inputMode="numeric"
                autoComplete="tel-national"
                className="min-w-0 flex-1 bg-transparent outline-none text-[16px] tabular-nums text-ng-ink placeholder:text-ng-ink-soft"
              />
              {mobileValid ? <UiIcon name="verified" size={20} className="text-ng-success" /> : null}
            </div>
          )}
        </Field>

        <Field label="Community">
          {(ids) => (
            <div className="relative">
              <select
                id={ids.input}
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                className={`${inputCls(false)} appearance-none pr-10 cursor-pointer`}
              >
                {communities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Icon
                name="alt-arrow-down-linear"
                size={18}
                className="text-ng-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          )}
        </Field>
      </CaptainCard>

      {/* Products / cart */}
      <CaptainSectionHead
        action={
          cartCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-leaf/20 text-ng-forest-deep font-semibold px-3 py-1 text-[13px] tabular-nums">
              <UiIcon name="cart" size={15} />
              {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      >
        Products
      </CaptainSectionHead>
      <div className="space-y-2.5">
        {catalogueFailed ? (
          <CaptainEmpty
            icon="danger-triangle-bold"
            title="Your products did not load"
            hint="Check your connection. Do not take payment until the list loads."
            action={
              <button
                type="button"
                onClick={() => void loadCatalogue()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ng-forest px-5 text-[14px] font-semibold text-ng-cream cursor-pointer"
              >
                <Icon name="refresh-bold" size={16} />
                Try again
              </button>
            }
          />
        ) : catalogue === null ? (
          <div aria-busy="true" aria-label="Loading your products" className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] rounded-2xl border border-ng-line bg-ng-white motion-safe:animate-pulse" />
            ))}
          </div>
        ) : catalogue.length === 0 ? (
          /* Fail-closed. A captain with no allocation sells nothing until an
             operator assigns products — better than an invented tray. */
          <CaptainEmpty
            icon="bag-3-bold"
            title="No products assigned yet"
            hint="Ask the office to assign your stall products. You can still handle pickups."
          />
        ) : null}
        {(catalogue ?? []).map((p) => {
          const qty = cart[p.variantId] ?? 0;
          const active = qty > 0;
          return (
            <CaptainCard
              key={p.variantId}
              className={cn("flex items-center gap-3 !py-3 transition-colors", active && "border-ng-forest bg-ng-sage/25")}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[15px] text-ng-forest-deep leading-snug">{p.title}</div>
                <div className="text-[13px] text-ng-ink-muted mt-0.5">
                  {p.pack ? `${p.unit}, ${p.pack}` : p.unit}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-display text-[17px] text-ng-forest-deep tabular-nums">{formatInr(p.price)}</span>
                  {p.available <= 5 ? (
                    <span className="text-[12px] font-semibold text-ng-clay-deep tabular-nums">
                      {p.available === 0 ? "None in the warehouse" : `${p.available} left in the warehouse`}
                    </span>
                  ) : null}
                </div>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => setQty(p.variantId, 1)}
                  aria-label={`Add ${p.title} ${p.unit}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ng-forest/40 text-ng-forest px-4 text-[14px] font-semibold cursor-pointer hover:bg-ng-white transition-colors"
                >
                  <Icon name="add-circle-bold" size={18} />
                  Add
                </button>
              ) : (
                <div className="inline-flex items-center rounded-full bg-ng-forest text-ng-cream p-0.5">
                  <button
                    type="button"
                    onClick={() => setQty(p.variantId, -1)}
                    aria-label={`Remove one ${p.title}`}
                    className="size-11 rounded-full flex items-center justify-center cursor-pointer hover:bg-ng-forest-soft"
                  >
                    <Icon name="minus-square-linear" size={20} />
                  </button>
                  <span className="font-display text-[17px] tabular-nums min-w-8 text-center" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(p.variantId, 1)}
                    disabled={qty >= MAX_QTY}
                    aria-label={`Add one more ${p.title}`}
                    className="size-11 rounded-full flex items-center justify-center cursor-pointer hover:bg-ng-forest-soft disabled:opacity-40"
                  >
                    <Icon name="add-square-linear" size={20} />
                  </button>
                </div>
              )}
            </CaptainCard>
          );
        })}
      </div>

      {/* Payment + notes */}
      <CaptainSectionHead>Payment</CaptainSectionHead>
      <CaptainCard className="space-y-4">
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5">
          {(["Cash", "UPI"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={payMode === m}
              onClick={() => setPayMode(m)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 text-[15px] font-semibold cursor-pointer transition-colors",
                payMode === m
                  ? "border-ng-forest bg-ng-forest text-ng-cream"
                  : "border-ng-line bg-ng-white text-ng-ink-muted hover:border-ng-leaf",
              )}
            >
              <Icon name={m === "Cash" ? "banknote-2-bold" : "smartphone-2-bold"} size={18} />
              {m}
            </button>
          ))}
        </div>
        <Field label="Notes (optional)">
          {(ids) => (
            <textarea
              id={ids.input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferences, restock requests, follow-ups"
              rows={2}
              className={`${inputCls(false)} resize-none min-h-[72px] leading-snug`}
            />
          )}
        </Field>
      </CaptainCard>

      {/* Recorded today */}
      <CaptainSectionHead
        action={<span className="text-[13px] text-ng-ink-muted tabular-nums">{todayCustomers.length} today</span>}
      >
        Recorded today
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainEmpty icon="bag-3-bold" title="No sales yet today" hint="Each sale you record appears here." />
      ) : (
        <div className="space-y-2.5">
          {todayCustomers.map((c) => (
            <CaptainCard key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] text-ng-forest-deep truncate">{c.name}</div>
                  <div className="text-[13px] text-ng-ink-muted tabular-nums mt-0.5">+91 {c.mobile}</div>
                  {c.community ? <div className="text-[13px] text-ng-ink-muted mt-0.5 truncate">{c.community}</div> : null}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-[17px] text-ng-forest-deep tabular-nums">{formatInr(c.total)}</div>
                  <span
                    className={cn(
                      "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold",
                      c.payMode === "UPI" ? "bg-ng-leaf/25 text-ng-forest-deep" : "bg-ng-soil/12 text-ng-soil",
                    )}
                  >
                    {c.payMode}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-ng-line-soft text-[13px] text-ng-ink-muted text-pretty">
                {c.items.map((i) => `${i.title} × ${i.qty}`).join(", ")}
              </div>
            </CaptainCard>
          ))}
        </div>
      )}

      {/* Clears the floating sale bar so the last row stays readable. */}
      <div aria-hidden className="h-28" />

      {/* ===== Sticky sale bar (floats above the tab bar) ===== */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(4.75rem,calc(4rem+env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto w-full max-w-[428px] rounded-2xl bg-ng-forest-deep text-ng-cream p-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 pl-1">
              <div className="text-[12px] text-ng-cream/75 tabular-nums">
                {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? "s" : ""}, ${payMode}` : "Total"}
              </div>
              <div className="font-display text-[26px] text-ng-cream leading-none mt-0.5 tabular-nums">
                {formatInr(total)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCapture}
              aria-disabled={!canSubmit}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold px-6 text-[16px] cursor-pointer transition-colors hover:bg-ng-green-bright",
                !canSubmit && "opacity-50",
              )}
            >
              Save sale
            </button>
          </div>
          {missing ? <p className="text-[12px] text-ng-cream/75 mt-2 pl-1">{missing}.</p> : null}
        </div>
      </div>
    </CaptainShell>
  );
}

/* ---- form primitives (local, mobile-tuned) ---- */

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: (ids: { input: string; describedBy: string | undefined }) => React.ReactNode;
}) {
  const id = useId();
  const input = `${id}-input`;
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={input} className="block text-[14px] font-medium text-ng-ink">
        {label}
        {required ? <span className="text-ng-danger"> *</span> : null}
      </label>
      <div className="mt-1.5">{children({ input, describedBy })}</div>
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ng-ink-muted mt-1">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-ng-danger mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputCls(error: boolean): string {
  return [
    "w-full min-h-12 rounded-xl bg-ng-white border px-3.5 py-3 text-[16px] text-ng-ink outline-none transition-colors",
    "placeholder:text-ng-ink-soft focus-visible:ring-2 focus-visible:ring-ng-leaf/50",
    error ? "border-ng-danger focus:border-ng-danger" : "border-ng-line focus:border-ng-forest",
  ].join(" ");
}

function inputWrapCls(error: boolean): string {
  return [
    "flex min-h-12 items-center gap-2 w-full rounded-xl bg-ng-white border px-3.5 py-3 transition-colors",
    "focus-within:ring-2 focus-within:ring-ng-leaf/50",
    error ? "border-ng-danger focus-within:border-ng-danger" : "border-ng-line focus-within:border-ng-forest",
  ].join(" ");
}
