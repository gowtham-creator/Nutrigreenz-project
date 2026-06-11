import Link from "next/link";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import {
  ADMIN_ORDERS,
  itemCount,
  INR,
  STATUS_TONE,
  type OrderStatus,
} from "@/components/ng/admin/orders-data";
import {
  Sparkline,
  MiniBars,
  AreaChart,
  DonutChart,
  HBars,
  Pipeline,
  TrendChip,
  GaugeRing,
  type VizTone,
} from "@/components/ng/admin/viz";

/* ---- designed time-series (last 14 days) ---------------------------- */
const REVENUE_SERIES = [142, 158, 151, 167, 173, 168, 182, 179, 191, 184, 196, 211, 198, 224];
const ORDERS_SERIES = [38, 41, 39, 44, 47, 45, 52, 49, 55, 53, 58, 62, 59, 66];
const AOV_SERIES = [1.62, 1.58, 1.71, 1.66, 1.74, 1.69, 1.78, 1.81, 1.79, 1.84, 1.82, 1.88, 1.86, 1.92];
const SLA_SERIES = [92, 94, 91, 95, 96, 93, 97, 95, 98, 96, 97, 98, 97, 98];
const DAY_LABELS = ["W1", "", "", "", "W2", "", "", "", "W3", "", "", "Thu", "Fri", "Today"];

const KPI: {
  label: string;
  value: string;
  delta: string;
  dir: "up" | "down" | "flat";
  series: number[];
  tone: VizTone;
  kind: "spark" | "bars";
  icon: string;
}[] = [
  { label: "Revenue · today", value: "₹2.24L", delta: "+12.8%", dir: "up", series: REVENUE_SERIES, tone: "forest", kind: "spark", icon: "wad-of-money-bold" },
  { label: "Orders · today", value: "66", delta: "+9.4%", dir: "up", series: ORDERS_SERIES, tone: "leaf", kind: "bars", icon: "bag-4-bold" },
  { label: "Avg order value", value: "₹1,924", delta: "+3.2%", dir: "up", series: AOV_SERIES, tone: "clay", kind: "spark", icon: "tag-price-bold" },
  { label: "Fulfilment SLA", value: "98%", delta: "+1.0 pt", dir: "up", series: SLA_SERIES, tone: "blue", kind: "spark", icon: "delivery-bold" },
];

const SECONDARY = [
  { label: "Refund rate", value: "1.4%", delta: "-0.3 pt", dir: "down" as const, tone: "terracotta" as VizTone },
  { label: "New customers", value: "31", delta: "+18%", dir: "up" as const, tone: "leaf" as VizTone },
  { label: "Repeat rate", value: "62%", delta: "+4 pt", dir: "up" as const, tone: "forest" as VizTone },
  { label: "Captain bundles", value: "9", delta: "4 communities", dir: "flat" as const, tone: "clay" as VizTone },
];

const TOP_PRODUCTS = [
  { label: "A2 Gir Cow Bilona Ghee", value: 312400, hint: "168 units" },
  { label: "Cold-Pressed Groundnut Oil", value: 248900, hint: "386 units" },
  { label: "Multifloral Raw Honey", value: 142600, hint: "264 units" },
  { label: "Foxtail Millet", value: 86200, hint: "454 units" },
  { label: "Stone-Ground Turmeric", value: 61800, hint: "334 units" },
];

const CATEGORY_MIX: { label: string; value: number; tone: VizTone }[] = [
  { label: "Cold-pressed oils", value: 38, tone: "forest" },
  { label: "A2 Ghee", value: 27, tone: "clay" },
  { label: "Honey", value: 16, tone: "amber" },
  { label: "Millets & grains", value: 12, tone: "leaf" },
  { label: "Spices & superfoods", value: 7, tone: "blue" },
];

const LOW_STOCK = [
  { sku: "Cold-pressed sesame · 500ml", left: 12, threshold: 40 },
  { sku: "Moringa superfood · 200g", left: 28, threshold: 60 },
  { sku: "Cultured buffalo ghee · 250ml", left: 9, threshold: 35 },
  { sku: "Kashmiri acacia honey · 350g", left: 18, threshold: 45 },
];

const ACTIVITY = [
  { icon: "box-bold", tone: "info" as const, label: "Lot ANT-24-052 cleared QC — 1,180 units now sellable", actor: "Lab desk · Priya M.", time: "8 min ago" },
  { icon: "danger-triangle-bold", tone: "danger" as const, label: "Stock-low alert · Cold-pressed sesame 500ml (12 left)", actor: "Inventory", time: "26 min ago" },
  { icon: "card-bold", tone: "warn" as const, label: "Refund requested ₹780 · order NG-25-1052", actor: "Sneha Bhat", time: "1 hr ago" },
  { icon: "users-group-rounded-bold", tone: "success" as const, label: "Community bundle for Aparna Sarovar locked — 14 orders", actor: "Captain · Sneha Kumar", time: "2 hr ago" },
  { icon: "tag-price-bold", tone: "info" as const, label: "Coupon FRESH50 hit 80% of redemption cap", actor: "Marketing", time: "3 hr ago" },
];

export default function AdminOverview() {
  /* live aggregates from the shared orders dataset */
  const statusCount = (s: OrderStatus) => ADMIN_ORDERS.filter((o) => o.status === s).length;
  const pipeline: { label: string; value: number; tone: VizTone }[] = [
    { label: "Awaiting pay", value: statusCount("Awaiting payment"), tone: "amber" },
    { label: "Paid", value: statusCount("Paid"), tone: "leaf" },
    { label: "Packed", value: statusCount("Packed"), tone: "blue" },
    { label: "Out for del.", value: statusCount("Out for delivery") + statusCount("Shipped"), tone: "clay" },
    { label: "Delivered", value: statusCount("Delivered"), tone: "forest" },
  ];
  const recent = ADMIN_ORDERS.slice(0, 6);
  const needAttention = statusCount("Awaiting payment") + statusCount("Refund req.") + statusCount("Payment failed");

  return (
    <AdminShell
      active="/admin"
      title={
        <span>
          Operator <em className="italic text-ng-clay font-display">overview</em>
        </span>
      }
      subtitle="Today · 3 Jun 2026 · live metrics from production"
      actions={
        <>
          <button className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="calendar-bold" size={15} className="text-ng-forest" />
            Last 14 days
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="download-minimalistic-bold" size={15} />
            Export report
          </button>
        </>
      }
    >
      {/* ── attention banner ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-ng-clay/10 border border-ng-clay/25 px-5 py-3.5">
        <span className="size-8 rounded-full bg-ng-clay/20 flex items-center justify-center shrink-0">
          <Icon name="bell-bing-bold" size={17} className="text-ng-clay-deep" />
        </span>
        <p className="text-[13px] font-medium text-ng-ink">
          <span className="font-semibold text-ng-forest-deep tabular-nums">{needAttention} orders</span> need attention,{" "}
          <span className="font-semibold text-ng-forest-deep">2 lots</span> are low on stock, and{" "}
          <span className="font-semibold text-ng-forest-deep">1 refund</span> is awaiting review.
        </p>
        <Link href="/admin/orders" className="ml-auto shrink-0 text-[12.5px] font-semibold text-ng-clay-deep hover:underline">
          Triage queue →
        </Link>
      </div>

      {/* ── KPI cards with sparklines ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {KPI.map((k) => (
          <div
            key={k.label}
            className="flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft p-5 hover:shadow-[var(--shadow-ng-card)] transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted flex items-center gap-1.5">
                  <Icon name={k.icon} size={13} className="text-ng-ink-muted" />
                  {k.label}
                </div>
                <div className="font-display text-[30px] text-ng-forest-deep leading-none mt-2.5 tabular-nums">{k.value}</div>
              </div>
              <TrendChip delta={k.delta} direction={k.dir} />
            </div>
            <div className="mt-auto pt-4">
              {k.kind === "spark" ? (
                <Sparkline data={k.series} tone={k.tone} width={240} height={40} className="w-full" />
              ) : (
                <MiniBars data={k.series} tone={k.tone} width={240} height={40} className="w-full" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── secondary metric strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {SECONDARY.map((s) => (
          <div key={s.label} className="h-full rounded-2xl bg-ng-paper border border-ng-line-soft px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{s.label}</div>
              <div className="font-display text-[22px] text-ng-forest-deep leading-none mt-1.5 tabular-nums">{s.value}</div>
            </div>
            <TrendChip delta={s.delta} direction={s.dir} />
          </div>
        ))}
      </div>

      {/* ── revenue trend + category mix ─────────────────────────────── */}
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-6 mb-6">
        <Card
          title="Revenue & orders"
          action={
            <div className="flex items-center gap-4 text-[11.5px] font-medium text-ng-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-ng-forest" /> Revenue (₹k)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-ng-leaf" /> Orders
              </span>
            </div>
          }
        >
          <AreaChart
            series={[
              { name: "Revenue", data: REVENUE_SERIES, tone: "forest" },
              { name: "Orders", data: ORDERS_SERIES, tone: "leaf" },
            ]}
            labels={DAY_LABELS}
            height={230}
            formatY={(v) => `${Math.round(v)}`}
          />
        </Card>

        <Card title="Category mix" action={<span className="text-[11px] font-semibold text-ng-ink-muted uppercase tracking-wider">by GMV</span>}>
          <DonutChart segments={CATEGORY_MIX} centerValue="₹8.4L" centerLabel="this week" />
        </Card>
      </div>

      {/* ── pipeline + SLA gauges + top products ─────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Order pipeline" action={<Link href="/admin/orders" className="text-[12px] font-semibold text-ng-forest hover:underline">Queue →</Link>}>
          <Pipeline stages={pipeline} />
          <div className="mt-5 pt-4 border-t border-ng-line-soft grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-display text-[20px] text-ng-forest-deep tabular-nums">{ADMIN_ORDERS.length}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Open</div>
            </div>
            <div>
              <div className="font-display text-[20px] text-ng-clay tabular-nums">{statusCount("Refund req.")}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Refunds</div>
            </div>
            <div>
              <div className="font-display text-[20px] text-ng-terracotta tabular-nums">{statusCount("Payment failed")}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mt-0.5">Failed</div>
            </div>
          </div>
        </Card>

        <Card title="Operational health">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <GaugeRing value={98} tone="leaf" label={<>On-time<br />delivery</>} />
              <GaugeRing value={92} tone="forest" label={<>QC pass<br />rate</>} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <GaugeRing value={76} tone="clay" label={<>Stock<br />coverage</>} />
              <GaugeRing value={88} tone="blue" label={<>Payment<br />success</>} />
            </div>
          </div>
        </Card>

        <Card title="Top products" action={<span className="text-[11px] font-semibold text-ng-ink-muted uppercase tracking-wider">7-day GMV</span>}>
          <HBars rows={TOP_PRODUCTS} tone="forest" formatValue={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        </Card>
      </div>

      {/* ── recent orders + low stock + activity ─────────────────────── */}
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-6">
        <Card
          title="Recent orders"
          action={<Link href="/admin/orders" className="text-[12px] font-semibold text-ng-forest hover:underline">Open queue →</Link>}
          className="!p-0 overflow-hidden"
        >
          <div className="grid grid-cols-[1.1fr_1.3fr_0.5fr_0.8fr_1fr_0.7fr] gap-3 px-6 py-3 bg-ng-cream text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold border-b border-ng-line-soft">
            <span>Order</span>
            <span>Customer</span>
            <span>Items</span>
            <span>Total</span>
            <span>Status</span>
            <span className="text-right">When</span>
          </div>
          <ul>
            {recent.map((o) => (
              <li
                key={o.id}
                className="grid grid-cols-[1.1fr_1.3fr_0.5fr_0.8fr_1fr_0.7fr] gap-3 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <span className="font-mono text-[12px] font-semibold text-ng-forest-deep">{o.id}</span>
                <span className="truncate font-semibold text-ng-ink">{o.customer.name}</span>
                <span className="font-mono text-[12px] font-medium tabular-nums text-ng-ink-muted">{itemCount(o)}</span>
                <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-ink">{INR(o.total)}</span>
                <span><Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill></span>
                <span className="text-[11.5px] font-medium text-ng-ink-soft text-right">{o.placedAgo}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card
            title="Low stock"
            action={<Link href="/admin/inventory" className="text-[12px] font-semibold text-ng-forest hover:underline">Restock →</Link>}
          >
            <ul className="space-y-3.5">
              {LOW_STOCK.map((s) => {
                const pct = Math.min(100, (s.left / s.threshold) * 100);
                const danger = s.left <= s.threshold * 0.4;
                return (
                  <li key={s.sku}>
                    <div className="flex justify-between gap-3 items-baseline mb-1.5">
                      <span className="text-[12.5px] font-medium text-ng-ink truncate">{s.sku}</span>
                      <span className={`font-mono text-[11.5px] tabular-nums shrink-0 font-semibold ${danger ? "text-ng-terracotta" : "text-ng-clay-deep"}`}>
                        {s.left}/{s.threshold}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ng-line-soft overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(4, pct)}%`, background: danger ? "var(--ng-terracotta)" : "var(--ng-clay)" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Activity">
            <ul className="space-y-3.5">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`shrink-0 size-7 rounded-full flex items-center justify-center ${
                      a.tone === "danger"
                        ? "bg-ng-terracotta/12 text-ng-terracotta"
                        : a.tone === "warn"
                          ? "bg-ng-clay/20 text-ng-clay-deep"
                          : a.tone === "success"
                            ? "bg-ng-success/15 text-ng-success"
                            : "bg-ng-forest/10 text-ng-forest"
                    }`}
                  >
                    <Icon name={a.icon} size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-ng-ink leading-snug">{a.label}</div>
                    <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">{a.actor} · {a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
