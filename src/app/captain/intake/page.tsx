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

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CaptainShell,
  CaptainCard,
  CaptainSectionHead,
  CaptainEmpty,
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import {
  useCaptain,
  type PayMode,
  type CapturedLineItem,
} from "@/components/ng/captain/captain-store";

type Cart = Record<string, number>;

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
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/captain/catalogue", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items?: StallItem[] };
        if (alive) setCatalogue(data.items ?? []);
      } catch {
        if (alive) setCatalogueFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const [cart, setCart] = useState<Cart>({});
  const [payMode, setPayMode] = useState<PayMode>("Cash");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const lineItems = useMemo<CapturedLineItem[]>(
    () =>
      (catalogue ?? [])
        .filter((p) => (cart[p.sku] ?? 0) > 0)
        .map((p) => ({
          sku: p.sku,
          title: p.title,
          unit: p.pack ? `${p.unit} · ${p.pack}` : p.unit,
          price: p.price,
          qty: cart[p.sku],
          // Sent so the sale joins to the real catalogue rather than sitting in
          // a jsonb blob that can never be counted per SKU.
          variantId: p.variantId,
        })),
    [cart, catalogue],
  );
  const total = useMemo(() => lineItems.reduce((s, i) => s + i.price * i.qty, 0), [lineItems]);
  const cartCount = useMemo(() => lineItems.reduce((s, i) => s + i.qty, 0), [lineItems]);

  const mobileValid = /^[6-9]\d{9}$/.test(mobile);
  const nameValid = name.trim().length >= 2;
  const hasItems = lineItems.length > 0;
  const canSubmit = nameValid && mobileValid && hasItems;

  // Capture-progress steps for the field-rep "how far am I" chip.
  const stepWho = nameValid && mobileValid;
  const doneSteps = [stepWho, hasItems, true].filter(Boolean).length; // pay always chosen

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
    setCommunity(communities[0]);
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
      {/* Capture progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < doneSteps ? "w-7 bg-ng-leaf" : "w-3.5 bg-ng-line"
              }`}
              aria-hidden
            />
          ))}
        </div>
        <span className="text-[11px] text-ng-ink-soft">
          {canSubmit ? "Ready to capture" : stepWho ? "Add products" : "Customer details"}
        </span>
      </div>

      {/* Onboarding cross-match note */}
      <div className="flex gap-2.5 rounded-2xl bg-ng-sage/30 border border-ng-leaf/25 px-3.5 py-3 mb-5">
        <div className="size-7 rounded-lg bg-ng-forest/10 ring-1 ring-ng-leaf/25 flex items-center justify-center shrink-0">
          <Icon name="link-round-bold" size={16} className="text-ng-forest" />
        </div>
        <p className="text-[12px] leading-snug text-ng-ink-muted">
          On online signup, this mobile{" "}
          <span className="font-semibold text-ng-forest-deep">auto-links &amp; imports</span> stall purchases — marking
          the customer “Onboarded”.
        </p>
      </div>

      {/* Customer details */}
      <CaptainSectionHead className="mt-0">Who</CaptainSectionHead>
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

        <Field label="Mobile number" required hint="10-digit Indian mobile — used to match the customer’s account">
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
              className={`${inputCls(false)} appearance-none pr-9 cursor-pointer`}
            >
              {communities.map((c) => (
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
            <span className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/20 text-ng-forest font-bold px-2.5 py-1 text-[11.5px]">
              <Icon name="cart-large-2-bold" size={14} />
              {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      >
        What
      </CaptainSectionHead>
      <div className="space-y-2">
        {catalogueFailed ? (
          <CaptainCard className="!py-4 text-center">
            <p className="text-[13px] font-semibold text-ng-danger">Couldn&rsquo;t load your products</p>
            <p className="mt-1 text-[12px] text-ng-ink-muted">
              Check your connection and pull to refresh. Don&rsquo;t take payment until the list loads.
            </p>
          </CaptainCard>
        ) : catalogue === null ? (
          <CaptainCard className="!py-4 text-center">
            <p className="text-[12.5px] text-ng-ink-muted">Loading your products…</p>
          </CaptainCard>
        ) : catalogue.length === 0 ? (
          /* Fail-closed. A captain with no allocation sells nothing until an
             operator assigns products — better than an invented tray. */
          <CaptainCard className="!py-4 text-center">
            <p className="text-[13px] font-semibold text-ng-forest-deep">No products assigned yet</p>
            <p className="mt-1 text-[12px] text-ng-ink-muted">
              Ask the office to allocate your stall products. You can still record pickups.
            </p>
          </CaptainCard>
        ) : null}
        {(catalogue ?? []).map((p) => {
          const qty = cart[p.sku] ?? 0;
          const active = qty > 0;
          return (
            <CaptainCard
              key={p.sku}
              className={`flex items-center gap-3 !py-3 transition-colors ${
                active ? "border-ng-leaf bg-ng-sage/25 shadow-[0_2px_10px_-4px_rgba(102,191,115,0.4)]" : ""
              }`}
            >
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 font-display text-[13px] transition-colors ${
                  active ? "bg-ng-forest text-ng-leaf" : "bg-ng-sage/50 text-ng-forest"
                }`}
                aria-hidden
              >
                {p.sku.split("-")[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[13.5px] text-ng-forest-deep leading-tight">{p.title}</div>
                <div className="text-[12px] text-ng-ink-muted mt-0.5">
                  {p.pack ? `${p.unit} · ${p.pack}` : p.unit} ·{" "}
                  <span className="font-semibold text-ng-forest">₹{p.price}</span>
                  {p.available <= 5 ? (
                    <span className="ml-1.5 text-[11px] font-semibold text-ng-clay-deep">
                      {p.available === 0 ? "· out of stock" : `· ${p.available} left`}
                    </span>
                  ) : null}
                </div>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => setQty(p.sku, 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-ng-line text-ng-forest px-4 py-2.5 text-[12.5px] font-bold cursor-pointer hover:border-ng-leaf hover:bg-ng-white transition-colors active:scale-[0.97]"
                >
                  <Icon name="add-circle-bold" size={16} />
                  Add
                </button>
              ) : (
                <div className="inline-flex items-center gap-0.5 rounded-full bg-ng-forest text-ng-cream p-1">
                  <button
                    type="button"
                    onClick={() => setQty(p.sku, -1)}
                    aria-label={`Reduce ${p.title}`}
                    className="size-9 rounded-full hover:bg-ng-forest-soft flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  >
                    <Icon name="minus-square-linear" size={20} />
                  </button>
                  <span className="font-display text-[16px] tabular-nums w-6 text-center">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(p.sku, 1)}
                    aria-label={`Add ${p.title}`}
                    className="size-9 rounded-full hover:bg-ng-forest-soft flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
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
      <CaptainSectionHead>How paid</CaptainSectionHead>
      <CaptainCard className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          {(["Cash", "UPI"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayMode(m)}
              aria-pressed={payMode === m}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-[13.5px] font-bold cursor-pointer transition-all active:scale-[0.98] ${
                payMode === m
                  ? "border-ng-forest bg-ng-forest text-ng-cream shadow-[0_6px_16px_-8px_rgba(20,51,31,0.6)]"
                  : "border-ng-line bg-ng-white text-ng-ink-muted hover:border-ng-leaf"
              }`}
            >
              <Icon name={m === "Cash" ? "banknote-2-bold" : "smartphone-2-bold"} size={18} />
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

      {/* Captured today */}
      <CaptainSectionHead
        action={<span className="text-[12px] text-ng-ink-soft">{todayCustomers.length} captured</span>}
      >
        Captured today
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainEmpty
          icon="bag-3-bold"
          title="No captures logged yet"
          hint="Sales you capture appear here instantly for the day."
        />
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
                      c.payMode === "UPI" ? "bg-ng-leaf/25 text-ng-forest" : "bg-ng-soil/12 text-ng-soil"
                    }`}
                  >
                    {c.payMode}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-ng-line-soft flex items-center gap-1.5 text-[11.5px] text-ng-ink-muted">
                <UiIcon name="bag" size={13} className="text-ng-ink-soft" />
                {c.items.map((i) => `${i.title.split(" ").slice(0, 2).join(" ")} ×${i.qty}`).join(" · ")}
              </div>
            </CaptainCard>
          ))}
        </div>
      )}

      {/* Clears the floating capture bar so the last ledger row stays readable. */}
      <div aria-hidden className="h-24" />

      {/* ===== Sticky capture bar (floats above tab nav) ===== */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(5.25rem,calc(4.5rem+env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto w-full max-w-[428px] rounded-2xl bg-ng-forest-deep text-ng-cream p-3 shadow-[0_18px_40px_-12px_rgba(10,31,18,0.7)] ring-1 ring-ng-leaf/15">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 pl-1">
              <div className="text-[10px] uppercase tracking-wider text-ng-leaf-soft">
                {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? "s" : ""} · ${payMode}` : "Order total"}
              </div>
              <div className="font-display text-[22px] text-ng-cream leading-none mt-0.5">
                ₹{total.toLocaleString("en-IN")}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold px-5 py-3 text-[14px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf active:scale-[0.98] shadow-[0_8px_20px_-8px_rgba(102,191,115,0.8)]"
            >
              <Icon name="user-plus-bold" size={18} />
              Capture
            </button>
          </div>
          {!canSubmit ? (
            <p className="text-[10.5px] text-ng-cream/55 text-center mt-2">
              Name, valid mobile &amp; at least one product required.
            </p>
          ) : null}
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
        {required ? <span className="text-ng-danger"> *</span> : null}
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
    "w-full rounded-xl bg-ng-white border px-3.5 py-3 text-[15px] text-ng-ink outline-none transition-all",
    "placeholder:text-ng-ink-soft focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
    error ? "border-ng-danger focus:border-ng-danger" : "border-ng-line focus:border-ng-forest",
  ].join(" ");
}

function inputWrapCls(error: boolean): string {
  return [
    "flex items-center gap-2 w-full rounded-xl bg-ng-white border px-3.5 py-3 transition-all",
    "focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
    error ? "border-ng-danger focus-within:border-ng-danger" : "border-ng-line focus-within:border-ng-forest",
  ].join(" ");
}
