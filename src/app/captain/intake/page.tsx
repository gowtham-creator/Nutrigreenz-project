"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CaptainShell, CaptainCard, CaptainSectionHead } from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import {
  useCaptain,
  STALL_CATALOG,
  COMMUNITIES,
  type PayMode,
  type CapturedLineItem,
} from "@/components/ng/captain/captain-store";

type Cart = Record<string, number>;

export default function CaptainIntake() {
  const { addCustomer, todayCustomers } = useCaptain();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [community, setCommunity] = useState(COMMUNITIES[0]);
  const [cart, setCart] = useState<Cart>({});
  const [payMode, setPayMode] = useState<PayMode>("Cash");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const lineItems = useMemo<CapturedLineItem[]>(
    () =>
      STALL_CATALOG.filter((p) => (cart[p.sku] ?? 0) > 0).map((p) => ({
        ...p,
        qty: cart[p.sku],
      })),
    [cart],
  );
  const total = useMemo(() => lineItems.reduce((s, i) => s + i.price * i.qty, 0), [lineItems]);
  const cartCount = useMemo(() => lineItems.reduce((s, i) => s + i.qty, 0), [lineItems]);

  const mobileValid = /^[6-9]\d{9}$/.test(mobile);
  const nameValid = name.trim().length >= 2;
  const canSubmit = nameValid && mobileValid && lineItems.length > 0;

  function setQty(sku: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[sku] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[sku];
      else copy[sku] = next;
      return copy;
    });
  }

  function reset() {
    setName("");
    setMobile("");
    setCommunity(COMMUNITIES[0]);
    setCart({});
    setPayMode("Cash");
    setNotes("");
    setTouched(false);
  }

  function handleCapture() {
    setTouched(true);
    if (!canSubmit) {
      toast.error("Add a name, valid mobile, and at least one product.");
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
    toast.success(`${name.trim()} captured`, {
      description: `₹${total.toLocaleString("en-IN")} · ${payMode} · +91 ${mobile}`,
    });
    reset();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <CaptainShell
      eyebrow="Stall capture"
      title="New customer"
      subtitle="Log a walk-up sale. Mobile is the key — it auto-links on online signup."
    >
      {/* M2 cross-match note */}
      <div className="flex gap-2.5 rounded-2xl bg-ng-clay/15 border border-ng-clay/35 px-3.5 py-3 mb-5">
        <Icon name="link-round-bold" size={18} className="text-ng-clay-deep mt-0.5 shrink-0" />
        <p className="text-[12px] leading-snug text-ng-soil">
          On online signup, this mobile <span className="font-semibold">auto-links &amp; imports</span>{" "}
          stall purchases — marking the customer “Onboarded”.{" "}
          <span className="text-ng-ink-soft">(OTP cross-match · Milestone 2)</span>
        </p>
      </div>

      {/* Customer details */}
      <CaptainSectionHead className="mt-0">Customer</CaptainSectionHead>
      <CaptainCard className="space-y-3.5">
        <Field label="Full name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lakshmi Narayan"
            autoComplete="name"
            className={inputCls(touched && !nameValid)}
          />
          {touched && !nameValid ? <FieldError>Enter the customer&apos;s name.</FieldError> : null}
        </Field>

        <Field label="Mobile number" required hint="10-digit Indian mobile — used for M2 onboarding match">
          <div className={inputWrapCls(touched && !mobileValid)}>
            <span className="text-[14px] text-ng-ink-soft font-mono pl-0.5">+91</span>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="98XXXXXXXX"
              inputMode="numeric"
              autoComplete="tel-national"
              className="flex-1 bg-transparent outline-none text-[15px] tracking-wide text-ng-ink placeholder:text-ng-ink-soft"
            />
            {mobileValid ? <Icon name="check-circle-bold" size={18} className="text-ng-success" /> : null}
          </div>
          {touched && !mobileValid ? <FieldError>Enter a valid 10-digit mobile.</FieldError> : null}
        </Field>

        <Field label="Gated community / area">
          <div className="relative">
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className={`${inputCls(false)} appearance-none pr-9`}
            >
              {COMMUNITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Icon
              name="alt-arrow-down-linear"
              size={16}
              className="text-ng-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>
        </Field>
      </CaptainCard>

      {/* Products / cart */}
      <CaptainSectionHead
        action={
          cartCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-ng-forest font-medium">
              <Icon name="cart-large-2-bold" size={15} />
              {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      >
        Products
      </CaptainSectionHead>
      <div className="space-y-2">
        {STALL_CATALOG.map((p) => {
          const qty = cart[p.sku] ?? 0;
          return (
            <CaptainCard
              key={p.sku}
              className={`flex items-center gap-3 ${qty > 0 ? "border-ng-leaf bg-ng-sage/25" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[13.5px] text-ng-forest-deep leading-tight">{p.title}</div>
                <div className="text-[12px] text-ng-ink-muted mt-0.5">
                  {p.unit} · ₹{p.price}
                </div>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => setQty(p.sku, 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-ng-line text-ng-forest px-3 py-1.5 text-[12.5px] font-semibold hover:border-ng-leaf hover:bg-ng-white transition-colors"
                >
                  <Icon name="add-circle-linear" size={16} />
                  Add
                </button>
              ) : (
                <div className="inline-flex items-center gap-2.5 rounded-full bg-ng-forest text-ng-cream px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => setQty(p.sku, -1)}
                    aria-label={`Reduce ${p.title}`}
                    className="size-7 rounded-full hover:bg-ng-forest-soft flex items-center justify-center"
                  >
                    <Icon name="minus-square-linear" size={18} />
                  </button>
                  <span className="font-display text-[15px] tabular-nums w-4 text-center">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(p.sku, 1)}
                    aria-label={`Add ${p.title}`}
                    className="size-7 rounded-full hover:bg-ng-forest-soft flex items-center justify-center"
                  >
                    <Icon name="add-square-linear" size={18} />
                  </button>
                </div>
              )}
            </CaptainCard>
          );
        })}
      </div>

      {/* Payment + notes */}
      <CaptainSectionHead>Payment</CaptainSectionHead>
      <CaptainCard className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          {(["Cash", "UPI"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayMode(m)}
              aria-pressed={payMode === m}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-[13.5px] font-semibold transition-colors ${
                payMode === m
                  ? "border-ng-forest bg-ng-forest text-ng-cream"
                  : "border-ng-line bg-ng-white text-ng-ink-muted hover:border-ng-leaf"
              }`}
            >
              <Icon name={m === "Cash" ? "banknote-2-bold" : "smartphone-2-bold"} size={17} />
              {m}
            </button>
          ))}
        </div>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferences, restock requests, follow-ups…"
            rows={2}
            className={`${inputCls(false)} resize-none min-h-[64px] leading-snug`}
          />
        </Field>
      </CaptainCard>

      {/* Sticky summary + submit */}
      <div className="mt-5 rounded-2xl bg-ng-forest-deep text-ng-cream p-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-ng-leaf-soft">Order total</span>
          <span className="font-display text-[24px] text-ng-cream leading-none">
            ₹{total.toLocaleString("en-IN")}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!canSubmit}
          className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-semibold py-3 text-[14.5px] hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf"
        >
          <Icon name="user-plus-bold" size={18} />
          Capture customer
        </button>
        {!canSubmit ? (
          <p className="text-[11px] text-ng-cream/55 text-center mt-2">
            Name, valid mobile &amp; at least one product required.
          </p>
        ) : null}
      </div>

      {/* Captured today */}
      <CaptainSectionHead
        action={<span className="text-[12px] text-ng-ink-soft">{todayCustomers.length} captured</span>}
      >
        Captured today
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainCard tone="sage" className="text-center py-6 text-[13px] text-ng-ink-muted">
          Captures you log appear here instantly.
        </CaptainCard>
      ) : (
        <div className="space-y-2.5">
          {todayCustomers.map((c) => (
            <CaptainCard key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-[14px] text-ng-forest-deep truncate">{c.name}</div>
                  <div className="text-[11.5px] text-ng-ink-soft font-mono mt-0.5">+91 {c.mobile}</div>
                  <div className="text-[11.5px] text-ng-ink-muted mt-1 truncate">{c.community}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-[16px] text-ng-forest-deep">
                    ₹{c.total.toLocaleString("en-IN")}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider font-bold ${
                      c.payMode === "UPI" ? "bg-ng-leaf/25 text-ng-forest" : "bg-ng-clay/25 text-ng-clay-deep"
                    }`}
                  >
                    {c.payMode}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-ng-line-soft flex items-center gap-1.5 text-[11.5px] text-ng-ink-muted">
                <Icon name="bag-3-linear" size={13} className="text-ng-ink-soft" />
                {c.items.map((i) => `${i.title.split(" ").slice(0, 2).join(" ")} ×${i.qty}`).join(" · ")}
              </div>
            </CaptainCard>
          ))}
        </div>
      )}
    </CaptainShell>
  );
}

/* ---- form primitives (local, mobile-tuned) ---- */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-ng-ink-muted">
        {label}
        {required ? <span className="text-ng-terracotta"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="block text-[11px] text-ng-ink-soft mt-1">{hint}</span> : null}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11.5px] text-ng-danger mt-1">{children}</span>;
}

function inputCls(error: boolean): string {
  return [
    "w-full rounded-xl bg-ng-white border px-3.5 py-2.5 text-[15px] text-ng-ink outline-none transition-all",
    "placeholder:text-ng-ink-soft focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
    error ? "border-ng-danger focus:border-ng-danger" : "border-ng-line focus:border-ng-forest",
  ].join(" ");
}

function inputWrapCls(error: boolean): string {
  return [
    "flex items-center gap-2 w-full rounded-xl bg-ng-white border px-3.5 py-2.5 transition-all",
    "focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
    error ? "border-ng-danger focus-within:border-ng-danger" : "border-ng-line focus-within:border-ng-forest",
  ].join(" ");
}
