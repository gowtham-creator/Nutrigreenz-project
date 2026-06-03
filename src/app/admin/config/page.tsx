import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";

/* ---- Global commerce rules (current configured values) ----------- */
const COMMERCE_RULES: { icon: string; label: string; value: string; hint: string }[] = [
  { icon: "cart-large-minimalistic-bold", label: "Minimum order value", value: "₹499", hint: "Cart must reach this to checkout" },
  { icon: "delivery-bold", label: "Free-delivery threshold", value: "₹599", hint: "Free above · else flat fee" },
  { icon: "tag-price-bold", label: "Flat delivery fee", value: "₹49", hint: "Charged below threshold" },
  { icon: "bill-list-bold", label: "Tax mode", value: "Inclusive", hint: "Prices shown include GST" },
  { icon: "clock-circle-bold", label: "Delivery slots", value: "2 / day", hint: "Morning 7–10 · Evening 5–8" },
  { icon: "calendar-bold", label: "Dispatch days", value: "Tue · Fri", hint: "Twice-weekly fulfilment" },
];

const LOYALTY = [
  { label: "Earn rate", value: "10 pts = ₹1", hint: "1 point per ₹10 spent" },
  { label: "Redemption cap", value: "20% of order", hint: "Max points applied per order" },
  { label: "Points expiry", value: "12 months", hint: "From last activity" },
  { label: "Tier ladder", value: "Seed → Sapling → Banyan", hint: "Spend-based progression" },
];

const COUPON_RULES = [
  { label: "Stacking", value: "Single coupon", hint: "One coupon per order" },
  { label: "First-order codes", value: "Enabled", hint: "FIRST100 · new customers" },
  { label: "Max % discount", value: "25%", hint: "Hard cap across all codes" },
  { label: "Loyalty + coupon", value: "Allowed", hint: "Can combine with points" },
];

const ZONES = [
  { city: "Hyderabad", pin: "500001–500098", days: "Same/next day", surcharge: "Free above ₹599", on: true },
  { city: "Bengaluru", pin: "560001–560078", days: "2–3 days", surcharge: "₹49 flat", on: true },
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

const FLAGS = [
  { name: "subscription_v2", on: true, audience: "100%", desc: "New subscription engine with pause/skip" },
  { name: "captain_pwa_beta", on: true, audience: "Captains only", desc: "Field-pickup PWA — read access for captains" },
  { name: "checkout_fast_lane", on: true, audience: "Sapling+", desc: "One-tap checkout for tier members" },
  { name: "ai_recipe_assist", on: false, audience: "—", desc: "Recipe generator using purchase history" },
];

function SettingRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-ng-line-soft last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ng-ink">{label}</div>
        <div className="text-[11.5px] text-ng-ink-soft mt-0.5">{hint}</div>
      </div>
      <span className="font-mono text-[12.5px] text-ng-forest-deep font-semibold shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export default function AdminConfig() {
  return (
    <AdminShell
      active="/admin/config"
      title={
        <span>
          Commerce <em className="italic text-ng-clay font-display">config</em>
        </span>
      }
      subtitle="Global commerce rules, loyalty & coupons, shipping, payments, flags"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/15 text-ng-clay-deep font-semibold px-4 py-2 text-[12px]">
          <Icon name="lock-keyhole-bold" size={14} />
          Read-only · editing in Phase 7
        </span>
      }
    >
      {/* Sticky sub-nav */}
      <div className="sticky top-[68px] z-[1] bg-ng-cream/85 backdrop-blur -mx-8 px-8 py-3 mb-6 border-b border-ng-line-soft">
        <div className="flex gap-1 text-[12.5px] flex-wrap">
          {["Rules", "Loyalty", "Shipping", "Payment", "Flags"].map((t, i) => (
            <a
              key={t}
              href={`#${t.toLowerCase()}`}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                i === 0 ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted hover:bg-ng-paper"
              }`}
            >
              {t}
            </a>
          ))}
        </div>
      </div>

      {/* Global commerce rules — hero grid */}
      <section id="rules" className="mb-6 scroll-mt-32">
        <div className="flex items-center gap-2 mb-4">
          <span className="ng-eyebrow">Global commerce rules</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMMERCE_RULES.map((r) => (
            <div key={r.label} className="rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="size-9 rounded-xl bg-ng-forest/8 flex items-center justify-center">
                  <Icon name={r.icon} size={18} className="text-ng-forest" />
                </span>
                <span className="font-display text-[22px] text-ng-forest-deep tabular-nums">{r.value}</span>
              </div>
              <div className="text-[12.5px] font-medium text-ng-ink mt-3.5">{r.label}</div>
              <div className="text-[11.5px] text-ng-ink-soft mt-0.5">{r.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty + coupon settings */}
      <section id="loyalty" className="grid lg:grid-cols-2 gap-6 mb-6 scroll-mt-32">
        <Card title="Loyalty programme">
          <div className="-mt-1">
            {LOYALTY.map((l) => (
              <SettingRow key={l.label} {...l} />
            ))}
          </div>
        </Card>
        <Card title="Coupon rules">
          <div className="-mt-1">
            {COUPON_RULES.map((c) => (
              <SettingRow key={c.label} {...c} />
            ))}
          </div>
        </Card>
      </section>

      {/* Shipping zones */}
      <Card
        title="Shipping zones"
        action={<span className="text-[11px] uppercase tracking-wider text-ng-ink-soft">{ZONES.filter((z) => z.on).length} live</span>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div id="shipping" className="scroll-mt-32" />
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_1.4fr_0.8fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>City</span>
          <span>PIN range</span>
          <span>SLA</span>
          <span>Pricing</span>
          <span>Status</span>
          <span></span>
        </div>
        <ul>
          {ZONES.map((z) => (
            <li
              key={z.city}
              className="grid grid-cols-[1.4fr_1.6fr_1fr_1.4fr_0.8fr_0.5fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <span className="font-medium">{z.city}</span>
              <span className="font-mono text-[11.5px] text-ng-ink-muted">{z.pin}</span>
              <span className="text-[12.5px]">{z.days}</span>
              <span className="text-[12.5px]">{z.surcharge}</span>
              <span><Pill tone={z.on ? "success" : "neutral"}>{z.on ? "Live" : "Off"}</Pill></span>
              <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">View →</button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Payment + flags */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Payment methods">
          <div id="payment" className="scroll-mt-32" />
          <ul className="divide-y divide-ng-line-soft -mt-1">
            {PAYMENT.map((p) => (
              <li key={p.method} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium">{p.method}</div>
                  <div className="text-[11.5px] text-ng-ink-soft mt-0.5">{p.note || `Fee: ${p.fee}`}</div>
                </div>
                <span className="font-mono text-[12px] text-ng-ink-muted tabular-nums">{p.fee}</span>
                <Pill tone={p.on ? "success" : "neutral"}>{p.on ? "On" : "Off"}</Pill>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Feature flags">
          <div id="flags" className="scroll-mt-32" />
          <ul className="divide-y divide-ng-line-soft -mt-1">
            {FLAGS.map((f) => (
              <li key={f.name} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12.5px] text-ng-forest-deep">{f.name}</span>
                    <Pill tone={f.on ? "success" : "neutral"}>{f.on ? "Live" : "Off"}</Pill>
                  </div>
                  <div className="text-[12px] text-ng-ink-muted mt-1">{f.desc}</div>
                </div>
                <span className="text-[11.5px] text-ng-ink-soft shrink-0">{f.audience}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
