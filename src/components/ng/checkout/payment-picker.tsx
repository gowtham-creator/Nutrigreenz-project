"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { PaymentLogo } from "./payment-logo";

/* ──────────────────────────────────────────────────────────────────────────
 * Shared contract — the Invoice/confirmation flow depends on this shape.
 * ────────────────────────────────────────────────────────────────────────── */
export interface PaymentSelection {
  category: "upi" | "card" | "wallet" | "paylater" | "netbanking" | "cod";
  id: string; // unique instrument id e.g. "upi-gpay", "card-4242"
  label: string; // display e.g. "Google Pay", "Visa •••• 4242"
  categoryLabel: string; // "UPI", "Credit / Debit Card", "Wallet", "Pay Later"
  logo?: string; // provider key for <PaymentLogo>
}

const CATEGORY_LABEL = {
  upi: "UPI",
  card: "Credit / Debit Card",
  wallet: "Wallet",
  paylater: "Pay Later",
  netbanking: "Netbanking",
  cod: "Pay on Delivery",
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Persistence — linked instruments stick across sessions via localStorage.
 * ────────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = "ng.pay.v1";

interface LinkedState {
  /** UPI IDs the user has linked, e.g. "ananya@okhdfcbank". */
  upiIds: string[];
  /** Saved cards (masked). */
  cards: { id: string; network: string; last4: string; name?: string }[];
  /** Provider keys that have been linked (wallets + pay-later). */
  walletsLinked: string[];
  paylaterLinked: string[];
}

const DEFAULT_STATE: LinkedState = {
  upiIds: ["ananya@okhdfcbank"],
  cards: [
    { id: "4242", network: "visa", last4: "4242" },
    { id: "5521", network: "mastercard", last4: "5521" },
  ],
  walletsLinked: [],
  paylaterLinked: [],
};

function readState(): LinkedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<LinkedState>;
    return {
      upiIds: parsed.upiIds ?? DEFAULT_STATE.upiIds,
      cards: parsed.cards ?? DEFAULT_STATE.cards,
      walletsLinked: parsed.walletsLinked ?? [],
      paylaterLinked: parsed.paylaterLinked ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: LinkedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — selection still works in-memory */
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Static catalogues
 * ────────────────────────────────────────────────────────────────────────── */
const UPI_APPS = [
  { key: "gpay", label: "Google Pay" },
  { key: "phonepe", label: "PhonePe" },
  { key: "paytm", label: "Paytm" },
  { key: "bhim", label: "BHIM" },
  { key: "cred", label: "CRED" },
];

const WALLETS = [
  { key: "amazonpay", label: "Amazon Pay", balance: "₹1,240" },
  { key: "paytm-wallet", label: "Paytm Wallet", balance: "₹560" },
  { key: "mobikwik", label: "Mobikwik", balance: "₹85" },
  { key: "phonepe-wallet", label: "PhonePe Wallet", balance: "₹2,015" },
  { key: "freecharge", label: "Freecharge", balance: "₹430" },
];

const PAYLATER = [
  { key: "lazypay", label: "LazyPay", limit: "₹10,000" },
  { key: "amazon-paylater", label: "Amazon Pay Later", limit: "₹60,000" },
  { key: "simpl", label: "Simpl", limit: "₹5,000" },
  { key: "zestmoney", label: "ZestMoney", limit: "₹40,000" },
  { key: "flipkart-paylater", label: "Flipkart Pay Later", limit: "₹15,000" },
];

const BANKS = [
  { key: "hdfc", label: "HDFC Bank" },
  { key: "icici", label: "ICICI Bank" },
  { key: "sbi", label: "SBI" },
  { key: "axis", label: "Axis Bank" },
  { key: "kotak", label: "Kotak" },
];

/* Detect card network from the number as the user types. */
function detectNetwork(digits: string): string | null {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(60|65|81|82|508)/.test(digits)) return "rupay";
  return null;
}

function networkLabel(network: string): string {
  return (
    {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      rupay: "RuPay",
    }[network] ?? "Card"
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ────────────────────────────────────────────────────────────────────────── */
function Radio({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
        active ? "border-ng-forest bg-ng-forest" : "border-ng-line",
      )}
    >
      {active ? <Icon name="check-read-bold" size={12} className="text-ng-cream" /> : null}
    </span>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
        active
          ? "border-ng-forest bg-ng-sage/30 shadow-[0_2px_10px_rgba(31,77,46,0.08)]"
          : "border-ng-line-soft hover:border-ng-leaf",
      )}
    >
      {children}
    </button>
  );
}

interface SectionProps {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

function Accordion({
  icon,
  title,
  subtitle,
  open,
  onToggle,
  badge,
  children,
}: SectionProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        open ? "border-ng-leaf bg-ng-paper" : "border-ng-line-soft bg-ng-paper",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest-deep">
          <Icon name={icon} size={19} />
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-[16px] text-ng-forest-deep">
              {title}
            </span>
            {badge ? (
              <span className="rounded-full bg-ng-forest/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ng-forest">
                {badge}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[12px] text-ng-ink-muted">
            {subtitle}
          </span>
        </span>
        <Icon
          name="alt-arrow-down-linear"
          size={18}
          className={cn(
            "text-ng-ink-soft transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────────────────────── */
export function PaymentPicker({
  selected,
  onSelect,
}: {
  selected: PaymentSelection | null;
  onSelect: (selection: PaymentSelection) => void;
}) {
  const [state, setState] = useState<LinkedState>(DEFAULT_STATE);
  const [open, setOpen] = useState<string | null>("upi");

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setState(readState());
  }, []);

  const persist = useCallback((next: LinkedState) => {
    setState(next);
    writeState(next);
  }, []);

  const selId = selected?.id ?? null;

  /* ── Add-new UPI ── */
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [upiDraft, setUpiDraft] = useState("");

  function verifyUpi() {
    const value = upiDraft.trim().toLowerCase();
    if (!/^[a-z0-9.\-_]{2,}@[a-z]{2,}$/.test(value)) {
      toast.error("Enter a valid UPI ID like name@bank");
      return;
    }
    if (state.upiIds.includes(value)) {
      toast.error("That UPI ID is already linked");
      return;
    }
    persist({ ...state, upiIds: [...state.upiIds, value] });
    setUpiDraft("");
    setShowUpiInput(false);
    toast.success(`${value} verified & linked`);
    onSelect({
      category: "upi",
      id: `upi-id-${value}`,
      label: value,
      categoryLabel: CATEGORY_LABEL.upi,
      logo: "upi",
    });
  }

  /* ── Add-new card ── */
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

  const cardDigits = cardNum.replace(/\D/g, "");
  const liveNetwork = useMemo(() => detectNetwork(cardDigits), [cardDigits]);

  function addCard() {
    if (cardDigits.length < 15) {
      toast.error("Enter a valid card number");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
      toast.error("Expiry must be MM/YY");
      return;
    }
    if (cardCvv.length < 3) {
      toast.error("Enter the CVV");
      return;
    }
    const last4 = cardDigits.slice(-4);
    const network = liveNetwork ?? "card";
    const card = {
      id: last4,
      network,
      last4,
      name: cardName.trim() || undefined,
    };
    if (state.cards.some((c) => c.id === last4)) {
      toast.error("That card is already saved");
      return;
    }
    persist({ ...state, cards: [...state.cards, card] });
    setCardNum("");
    setCardExp("");
    setCardCvv("");
    setCardName("");
    setShowCardForm(false);
    toast.success(`${networkLabel(network)} card saved`);
    onSelect({
      category: "card",
      id: `card-${last4}`,
      label: `${networkLabel(network)} •••• ${last4}`,
      categoryLabel: CATEGORY_LABEL.card,
      logo: network,
    });
  }

  /* ── Link wallet / pay-later ── */
  function linkWallet(key: string, label: string) {
    persist({ ...state, walletsLinked: [...state.walletsLinked, key] });
    toast.success(`${label} linked`);
  }
  function linkPaylater(key: string, label: string) {
    persist({ ...state, paylaterLinked: [...state.paylaterLinked, key] });
    toast.success(`${label} activated`);
  }

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-ng-float)] md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-sage/50 text-ng-forest-deep">
          <Icon name="wallet-money-bold" size={20} />
        </span>
        <div>
          <span className="ng-eyebrow text-ng-forest/70">Step 4</span>
          <h2 className="font-display text-[24px] leading-tight text-ng-forest-deep">
            Payment method
          </h2>
          <p className="mt-1 text-[12px] text-ng-ink-soft">
            Prepaid recommended — orders are no-cancellation once packed.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* ── UPI ─────────────────────────────────────────────── */}
        <Accordion
          id="upi"
          icon="smartphone-bold"
          title="UPI"
          subtitle="Pay instantly with any UPI app"
          badge="Fastest"
          open={open === "upi"}
          onToggle={() => toggle("upi")}
        >
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {UPI_APPS.map((app) => {
              const id = `upi-${app.key}`;
              return (
                <button
                  key={app.key}
                  type="button"
                  onClick={() =>
                    onSelect({
                      category: "upi",
                      id,
                      label: app.label,
                      categoryLabel: CATEGORY_LABEL.upi,
                      logo: app.key,
                    })
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                    selId === id
                      ? "border-ng-forest bg-ng-sage/30"
                      : "border-ng-line-soft hover:border-ng-leaf",
                  )}
                >
                  <PaymentLogo provider={app.key} size={28} className="sm:hidden" />
                  <PaymentLogo provider={app.key} size={36} className="hidden sm:grid" />
                  <span className="max-w-full truncate text-[10px] font-medium text-ng-ink-muted">
                    {app.label.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ng-ink-soft">
              Your UPI IDs
            </p>
            {state.upiIds.map((upi) => {
              const id = `upi-id-${upi}`;
              return (
                <Row key={upi} active={selId === id} onClick={() =>
                  onSelect({
                    category: "upi",
                    id,
                    label: upi,
                    categoryLabel: CATEGORY_LABEL.upi,
                    logo: "upi",
                  })
                }>
                  <PaymentLogo provider="upi" size={36} />
                  <span className="flex-1 font-medium text-ng-ink">{upi}</span>
                  <Radio active={selId === id} />
                </Row>
              );
            })}

            {showUpiInput ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-ng-line-soft p-3 sm:flex-row sm:items-center">
                <input
                  value={upiDraft}
                  onChange={(e) => setUpiDraft(e.target.value)}
                  placeholder="name@bank"
                  autoFocus
                  className="h-10 flex-1 rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-leaf"
                />
                <button
                  type="button"
                  onClick={verifyUpi}
                  className="h-10 shrink-0 rounded-xl bg-ng-forest px-4 text-[13px] font-medium text-ng-cream hover:bg-ng-forest-deep"
                >
                  Verify & add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpiInput(true)}
                className="flex items-center gap-2 px-1 pt-1 text-[13px] font-medium text-ng-forest hover:text-ng-forest-deep"
              >
                <Icon name="add-circle-bold" size={16} />
                Add new UPI ID
              </button>
            )}
          </div>
        </Accordion>

        {/* ── Cards ───────────────────────────────────────────── */}
        <Accordion
          id="card"
          icon="card-bold"
          title="Credit / Debit Cards"
          subtitle="Visa, Mastercard, RuPay & Amex"
          open={open === "card"}
          onToggle={() => toggle("card")}
        >
          <div className="space-y-2">
            {state.cards.map((card) => {
              const id = `card-${card.id}`;
              const label = `${networkLabel(card.network)} •••• ${card.last4}`;
              return (
                <Row key={card.id} active={selId === id} onClick={() =>
                  onSelect({
                    category: "card",
                    id,
                    label,
                    categoryLabel: CATEGORY_LABEL.card,
                    logo: card.network,
                  })
                }>
                  <PaymentLogo provider={card.network} size={36} />
                  <span className="flex-1">
                    <span className="block font-medium text-ng-ink">{label}</span>
                    {card.name ? (
                      <span className="block text-[11px] text-ng-ink-soft">
                        {card.name}
                      </span>
                    ) : null}
                  </span>
                  <Radio active={selId === id} />
                </Row>
              );
            })}
          </div>

          {showCardForm ? (
            <div className="mt-3 space-y-2.5 rounded-2xl border border-ng-line-soft p-3.5">
              <div className="relative">
                <input
                  value={cardNum}
                  onChange={(e) =>
                    setCardNum(
                      e.target.value
                        .replace(/[^\d]/g, "")
                        .slice(0, 19)
                        .replace(/(.{4})/g, "$1 ")
                        .trim(),
                    )
                  }
                  placeholder="Card number"
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 pr-14 text-[14px] text-ng-ink outline-none focus:border-ng-leaf"
                />
                {liveNetwork ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <PaymentLogo provider={liveNetwork} size={30} />
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <input
                  value={cardExp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                    setCardExp(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                  }}
                  placeholder="MM/YY"
                  inputMode="numeric"
                  className="h-11 w-1/2 rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-leaf"
                />
                <input
                  value={cardCvv}
                  onChange={(e) =>
                    setCardCvv(e.target.value.replace(/[^\d]/g, "").slice(0, 4))
                  }
                  placeholder="CVV"
                  inputMode="numeric"
                  className="h-11 w-1/2 rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-leaf"
                />
              </div>
              <input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Name on card"
                className="h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-leaf"
              />
              <button
                type="button"
                onClick={addCard}
                className="h-11 w-full rounded-xl bg-ng-forest text-[14px] font-medium text-ng-cream hover:bg-ng-forest-deep"
              >
                Save card
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCardForm(true)}
              className="mt-3 flex items-center gap-2 px-1 text-[13px] font-medium text-ng-forest hover:text-ng-forest-deep"
            >
              <Icon name="add-circle-bold" size={16} />
              Add new card
            </button>
          )}
        </Accordion>

        {/* ── Wallets ─────────────────────────────────────────── */}
        <Accordion
          id="wallet"
          icon="wallet-bold"
          title="Wallets"
          subtitle="Amazon Pay, Paytm, Mobikwik & more"
          open={open === "wallet"}
          onToggle={() => toggle("wallet")}
        >
          <div className="space-y-2">
            {WALLETS.map((w) => {
              const id = `wallet-${w.key}`;
              const linked = state.walletsLinked.includes(w.key);
              const active = selId === id;
              return (
                <div
                  key={w.key}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3.5 transition-all",
                    active
                      ? "border-ng-forest bg-ng-sage/30"
                      : "border-ng-line-soft",
                  )}
                >
                  <PaymentLogo provider={w.key} size={36} />
                  <span className="flex-1">
                    <span className="block font-medium text-ng-ink">{w.label}</span>
                    {linked ? (
                      <span className="flex items-center gap-1 text-[11px] text-ng-forest">
                        <Icon name="check-circle-bold" size={12} /> Linked ·{" "}
                        {w.balance}
                      </span>
                    ) : (
                      <span className="block text-[11px] text-ng-ink-soft">
                        Not linked
                      </span>
                    )}
                  </span>
                  {linked ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          category: "wallet",
                          id,
                          label: w.label,
                          categoryLabel: CATEGORY_LABEL.wallet,
                          logo: w.key,
                        })
                      }
                      className="shrink-0"
                    >
                      <Radio active={active} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => linkWallet(w.key, w.label)}
                      className="h-9 shrink-0 rounded-full border border-ng-forest px-4 text-[13px] font-medium text-ng-forest hover:bg-ng-forest hover:text-ng-cream"
                    >
                      Link
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>

        {/* ── Pay Later ───────────────────────────────────────── */}
        <Accordion
          id="paylater"
          icon="clock-circle-bold"
          title="Pay Later"
          subtitle="Buy now, settle later"
          open={open === "paylater"}
          onToggle={() => toggle("paylater")}
        >
          <div className="space-y-2">
            {PAYLATER.map((p) => {
              const id = `paylater-${p.key}`;
              const linked = state.paylaterLinked.includes(p.key);
              const active = selId === id;
              return (
                <div
                  key={p.key}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3.5 transition-all",
                    active
                      ? "border-ng-forest bg-ng-sage/30"
                      : "border-ng-line-soft",
                  )}
                >
                  <PaymentLogo provider={p.key} size={36} />
                  <span className="flex-1">
                    <span className="block font-medium text-ng-ink">{p.label}</span>
                    {linked ? (
                      <span className="flex items-center gap-1 text-[11px] text-ng-forest">
                        <Icon name="check-circle-bold" size={12} /> Limit{" "}
                        {p.limit}
                      </span>
                    ) : (
                      <span className="block text-[11px] text-ng-ink-soft">
                        Activate to use
                      </span>
                    )}
                  </span>
                  {linked ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          category: "paylater",
                          id,
                          label: p.label,
                          categoryLabel: CATEGORY_LABEL.paylater,
                          logo: p.key,
                        })
                      }
                      className="shrink-0"
                    >
                      <Radio active={active} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => linkPaylater(p.key, p.label)}
                      className="h-9 shrink-0 rounded-full border border-ng-forest px-4 text-[13px] font-medium text-ng-forest hover:bg-ng-forest hover:text-ng-cream"
                    >
                      Activate
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Accordion>

        {/* ── More (netbanking + COD), de-emphasised ──────────── */}
        <Accordion
          id="more"
          icon="course-up-bold"
          title="More options"
          subtitle="Netbanking & Pay on Delivery"
          open={open === "more"}
          onToggle={() => toggle("more")}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ng-ink-soft">
            Netbanking
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {BANKS.map((b) => {
              const id = `netbanking-${b.key}`;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() =>
                    onSelect({
                      category: "netbanking",
                      id,
                      label: b.label,
                      categoryLabel: CATEGORY_LABEL.netbanking,
                      logo: b.key,
                    })
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                    selId === id
                      ? "border-ng-forest bg-ng-sage/30"
                      : "border-ng-line-soft hover:border-ng-leaf",
                  )}
                >
                  <PaymentLogo provider={b.key} size={26} className="sm:hidden" />
                  <PaymentLogo provider={b.key} size={34} className="hidden sm:grid" />
                  <span className="max-w-full truncate text-[10px] font-medium text-ng-ink-muted">
                    {b.key.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Row
              active={selId === "cod"}
              onClick={() =>
                onSelect({
                  category: "cod",
                  id: "cod",
                  label: "Pay on Delivery",
                  categoryLabel: CATEGORY_LABEL.cod,
                  logo: "cod",
                })
              }
            >
              <PaymentLogo provider="cod" size={36} />
              <span className="flex-1">
                <span className="block font-medium text-ng-ink">
                  Pay on Delivery
                </span>
                <span className="block text-[11px] text-ng-ink-soft">
                  Cash / UPI at your doorstep
                </span>
              </span>
              <Radio active={selId === "cod"} />
            </Row>
          </div>
        </Accordion>
      </div>
    </div>
  );
}
