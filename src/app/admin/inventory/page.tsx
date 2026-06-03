import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { StockMeter, MiniBars, type VizTone } from "@/components/ng/admin/viz";

/* ---- product stock (SKU level) ----------------------------------- */
const STOCK: {
  sku: string;
  product: string;
  category: string;
  stock: number;
  threshold: number;
  lot: string;
  movement: number[];
  reorder: boolean;
}[] = [
  { sku: "OIL-GN-1L", product: "Cold-Pressed Groundnut Oil", category: "Oils", stock: 982, threshold: 200, lot: "ANT-24-051", movement: [42, 38, 51, 44, 60, 55, 66], reorder: false },
  { sku: "GHE-A2-500", product: "A2 Gir Cow Bilona Ghee", category: "Ghee", stock: 318, threshold: 120, lot: "ANT-24-049", movement: [22, 28, 24, 31, 29, 34, 38], reorder: false },
  { sku: "OIL-SF-1L", product: "Cold-Pressed Sunflower Oil", category: "Oils", stock: 12, threshold: 40, lot: "ANT-24-046", movement: [18, 14, 20, 11, 9, 7, 5], reorder: true },
  { sku: "MIL-FX-500", product: "Foxtail Millet", category: "Millets", stock: 412, threshold: 150, lot: "ANT-24-044", movement: [60, 54, 71, 65, 78, 72, 80], reorder: false },
  { sku: "HON-ML-500", product: "Multifloral Raw Honey", category: "Honey", stock: 142, threshold: 90, lot: "ANT-24-038", movement: [30, 36, 28, 41, 35, 44, 39], reorder: false },
  { sku: "GHE-BUF-250", product: "Cultured Buffalo Ghee", category: "Ghee", stock: 9, threshold: 35, lot: "ANT-24-029", movement: [14, 11, 9, 12, 7, 6, 4], reorder: true },
  { sku: "SF-MOR-200", product: "Moringa Superfood Powder", category: "Superfoods", stock: 28, threshold: 60, lot: "ANT-24-051", movement: [20, 16, 22, 14, 18, 12, 10], reorder: true },
  { sku: "FLR-BAJ-1K", product: "Stone-Ground Bajra Flour", category: "Flours", stock: 0, threshold: 50, lot: "ANT-24-041", movement: [12, 10, 8, 6, 3, 1, 0], reorder: true },
];

/* ---- lot / batch traceability ------------------------------------ */
const LOTS = [
  { id: "ANT-24-051", product: "Cold-Pressed Groundnut Oil 1L", farm: "Anantapur · K. Subbaiah", received: "12 May 2026", units: 1240, available: 982, status: "Active", tone: "success" as const, qc: "Passed" },
  { id: "ANT-24-049", product: "A2 Gir Cow Bilona Ghee 500ml", farm: "Junagadh · H. Pateel", received: "08 May 2026", units: 540, available: 318, status: "Active", tone: "success" as const, qc: "Passed" },
  { id: "ANT-24-052", product: "Cold-Pressed Groundnut Oil 1L", farm: "Anantapur · K. Subbaiah", received: "19 May 2026", units: 1180, available: 1180, status: "QC pending", tone: "warn" as const, qc: "In lab" },
  { id: "ANT-24-044", product: "Foxtail Millet 500g", farm: "Bellary · R. Eshwarappa", received: "01 May 2026", units: 820, available: 412, status: "Active", tone: "success" as const, qc: "Passed" },
  { id: "ANT-24-038", product: "Multifloral Forest Honey 500g", farm: "Nilgiri · Kani co-op", received: "24 Apr 2026", units: 380, available: 142, status: "Active", tone: "success" as const, qc: "Passed" },
  { id: "ANT-24-046", product: "Cold-Pressed Sunflower Oil 1L", farm: "Karnataka · M. Devraj", received: "04 May 2026", units: 920, available: 12, status: "Low stock", tone: "danger" as const, qc: "Passed" },
  { id: "ANT-24-041", product: "Stone-Ground Bajra Flour 1kg", farm: "Bikaner · B. Choudhary", received: "28 Apr 2026", units: 640, available: 0, status: "Depleted", tone: "neutral" as const, qc: "Passed" },
  { id: "ANT-24-050", product: "Kashmiri Acacia Honey 350g", farm: "Pulwama · co-op", received: "10 May 2026", units: 220, available: 64, status: "Active", tone: "success" as const, qc: "Passed" },
];

const PO_OPEN = [
  { id: "PO-2026-018", farm: "Anantapur · K. Subbaiah", product: "Groundnut · cold-press grade", qty: "1,500 kg", expected: "24 May 2026", value: 187500 },
  { id: "PO-2026-019", farm: "Karnataka · M. Devraj", product: "Sunflower seed", qty: "900 kg", expected: "26 May 2026", value: 99000 },
  { id: "PO-2026-020", farm: "Bellary · R. Eshwarappa", product: "Foxtail millet", qty: "1,200 kg", expected: "28 May 2026", value: 96000 },
];

const FILTERS = ["All SKUs", "Reorder now", "Oils", "Ghee", "Honey", "Millets", "Flours"];

function stockState(stock: number, threshold: number) {
  if (stock <= 0) return { tone: "neutral" as const, label: "Out" };
  if (stock <= threshold) return { tone: "danger" as const, label: "Low" };
  return { tone: "success" as const, label: "OK" };
}

export default function AdminInventory() {
  const reorderCount = STOCK.filter((s) => s.reorder).length;
  return (
    <AdminShell
      active="/admin/inventory"
      title={
        <span>
          Inventory <em className="italic text-ng-clay font-display">&amp; lots</em>
        </span>
      }
      subtitle="Every jar traces back to a lot. Every lot traces back to a farmer."
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="document-text-bold" size={15} className="text-ng-forest" />
            Stock report
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="box-bold" size={15} />
            Receive lot
          </button>
        </>
      }
    >
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Lots active" value="86" delta="3 received this week" trend="up" />
        <StatTile label="Inventory value" value="₹38.4L" delta="+₹2.1L vs last wk" trend="up" />
        <StatTile label="QC pending" value="4" delta="all in-lab" trend="flat" />
        <StatTile label="Low-stock SKUs" value="12" delta="auto-PO drafted" trend="down" />
      </div>

      {/* Reorder banner */}
      {reorderCount > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-ng-terracotta/8 border border-ng-terracotta/25 px-5 py-3.5">
          <span className="size-8 rounded-full bg-ng-terracotta/15 flex items-center justify-center shrink-0">
            <Icon name="danger-triangle-bold" size={17} className="text-ng-terracotta" />
          </span>
          <p className="text-[13px] text-ng-ink">
            <span className="font-semibold text-ng-forest-deep tabular-nums">{reorderCount} SKUs</span> are at or below
            reorder threshold. Auto-PO drafts are ready for review.
          </p>
          <button className="ml-auto shrink-0 text-[12.5px] font-semibold text-ng-terracotta hover:underline cursor-pointer">
            Review drafts →
          </button>
        </div>
      ) : null}

      {/* Product stock table */}
      <Card
        title="Product stock"
        action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">Export →</button>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="px-6 pt-6 pb-4 flex items-center gap-2 flex-wrap border-b border-ng-line-soft">
          {FILTERS.map((t, i) => (
            <button
              key={t}
              className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors cursor-pointer ${
                i === 0
                  ? "bg-ng-forest-deep text-ng-cream font-semibold"
                  : t === "Reorder now"
                    ? "bg-ng-terracotta/10 text-ng-terracotta border border-ng-terracotta/30 hover:bg-ng-terracotta/15"
                    : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted hover:bg-ng-cream"
              }`}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto relative">
            <Icon name="magnifer-linear" size={15} className="text-ng-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search SKU, product…"
              className="rounded-full bg-ng-paper border border-ng-line-soft pl-9 pr-4 py-1.5 text-[12.5px] w-64 outline-none focus:border-ng-forest"
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_2fr_0.9fr_1.4fr_1fr_0.7fr_0.6fr] gap-3 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>SKU</span>
          <span>Product</span>
          <span>Category</span>
          <span>Stock level</span>
          <span>Active lot</span>
          <span>7-day flow</span>
          <span></span>
        </div>
        <ul>
          {STOCK.map((s) => {
            const st = stockState(s.stock, s.threshold);
            const tone: VizTone = st.tone === "danger" ? "terracotta" : st.tone === "neutral" ? "ink" : "leaf";
            return (
              <li
                key={s.sku}
                className="grid grid-cols-[1fr_2fr_0.9fr_1.4fr_1fr_0.7fr_0.6fr] gap-3 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <span className="font-mono text-[11.5px] text-ng-forest-deep">{s.sku}</span>
                <span className="truncate font-medium">{s.product}</span>
                <span className="text-[12px] text-ng-ink-muted">{s.category}</span>
                <div className="flex items-center gap-2">
                  <StockMeter stock={s.stock} threshold={s.threshold} />
                  <Pill tone={st.tone}>{st.label}</Pill>
                </div>
                <span className="font-mono text-[11.5px] text-ng-ink-muted">{s.lot}</span>
                <MiniBars data={s.movement} tone={tone} width={56} height={26} />
                {s.reorder ? (
                  <button className="text-[12px] font-bold text-ng-terracotta hover:text-ng-terracotta/80 transition-colors cursor-pointer">
                    Reorder
                  </button>
                ) : (
                  <button className="text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer">
                    Open →
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Lots table */}
      <Card
        title="Lot register"
        action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All lots →</button>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="grid grid-cols-[1.1fr_2.2fr_1.6fr_1fr_0.8fr_0.8fr_0.9fr_0.5fr] gap-3 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>Lot ID</span>
          <span>Product</span>
          <span>Farm</span>
          <span>Received</span>
          <span>Units</span>
          <span>Available</span>
          <span>Status</span>
          <span></span>
        </div>
        <ul>
          {LOTS.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[1.1fr_2.2fr_1.6fr_1fr_0.8fr_0.8fr_0.9fr_0.5fr] gap-3 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <span className="font-mono text-[11.5px] text-ng-forest-deep">{l.id}</span>
              <span className="truncate">{l.product}</span>
              <span className="truncate text-[12px] text-ng-ink-muted">{l.farm}</span>
              <span className="text-[12px] text-ng-ink-muted">{l.received}</span>
              <span className="font-mono text-[12px] tabular-nums">{l.units.toLocaleString()}</span>
              <span className={`font-mono text-[12px] tabular-nums ${l.available === 0 ? "text-ng-ink-soft" : l.available < 50 ? "text-ng-terracotta font-semibold" : ""}`}>
                {l.available.toLocaleString()}
              </span>
              <span><Pill tone={l.tone}>{l.status}</Pill></span>
              <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">Open →</button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <Card title="Low stock — replenish this week">
          <ul className="space-y-4">
            {[
              { sku: "Cold-pressed sesame · 500ml", stock: 12, threshold: 40, daysLeft: 1.4 },
              { sku: "Moringa powder · 200g", stock: 28, threshold: 60, daysLeft: 3.1 },
              { sku: "Cultured buffalo ghee · 250ml", stock: 31, threshold: 80, daysLeft: 4.7 },
              { sku: "Turmeric latte blend · 150g", stock: 44, threshold: 100, daysLeft: 5.2 },
            ].map((s) => {
              const pct = Math.min(100, (s.stock / s.threshold) * 100);
              return (
                <li key={s.sku}>
                  <div className="flex justify-between text-[13px] mb-1.5 items-baseline">
                    <span>{s.sku}</span>
                    <span className="text-ng-terracotta font-semibold font-mono text-[11.5px] tabular-nums">{s.stock} left · {s.daysLeft}d</span>
                  </div>
                  <div className="h-2 bg-ng-line-soft rounded-full overflow-hidden">
                    <div className="h-full bg-ng-terracotta rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Open POs */}
        <Card title="Open purchase orders" action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">Create PO →</button>}>
          <ul className="space-y-3 text-[13px]">
            {PO_OPEN.map((p) => (
              <li key={p.id} className="border-b border-ng-line-soft pb-3 last:border-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11.5px] text-ng-forest-deep">{p.id}</div>
                    <div className="text-[13px] mt-0.5">{p.product}</div>
                    <div className="text-[11.5px] text-ng-ink-soft mt-0.5">{p.farm} · {p.qty}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold tabular-nums">₹{p.value.toLocaleString("en-IN")}</div>
                    <div className="text-[11.5px] text-ng-ink-soft mt-0.5">ETA {p.expected}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
