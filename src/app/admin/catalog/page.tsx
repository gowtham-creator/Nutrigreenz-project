import Image from "next/image";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS } from "@/components/ng/data";
import { HBars } from "@/components/ng/admin/viz";

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  Published: "success",
  Draft: "warn",
  "Out of stock": "danger",
  Archived: "neutral",
};

const TAG_CATEGORY: Record<string, string> = {
  oil: "Oils",
  ghee: "Ghee",
  honey: "Honey",
  millet: "Millets",
  flour: "Flours",
  superfood: "Superfoods",
  spice: "Spices",
  pulse: "Pulses",
  fruit: "Produce",
  gifting: "Gifting",
};

const STOCKS = [142, 89, 12, 31, 218, 76, 4, 56, 9, 187, 134, 24, 67, 41];
const STATUSES = [
  "Published", "Published", "Out of stock", "Published", "Published", "Published",
  "Draft", "Published", "Published", "Published", "Published", "Draft", "Published", "Archived",
];

const ROWS = PRODUCTS.map((p, i) => {
  const tag = p.tags?.[0] ?? "";
  const mrp = p.mrp ?? p.price ?? 0;
  const price = p.price ?? 0;
  const margin = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return {
    ...p,
    sku: `NG-${(p.id ?? "").replace("p-", "")}-01`,
    category: TAG_CATEGORY[tag] ?? "Other",
    stock: STOCKS[i] ?? 50,
    status: STATUSES[i] ?? "Published",
    margin,
    mrp,
    price,
  };
});

const TABS = ["All products", "Published", "Drafts", "Out of stock", "Archived"];

export default function AdminCatalog() {
  const live = ROWS.filter((r) => r.status === "Published").length;
  const blocked = ROWS.filter((r) => r.status === "Out of stock").length;
  const drafts = ROWS.filter((r) => r.status === "Draft").length;

  // category counts for the mix bar
  const catCounts = ROWS.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  const catRows = Object.entries(catCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const avgRating = (ROWS.reduce((s, r) => s + (r.rating ?? 0), 0) / ROWS.length).toFixed(2);

  return (
    <AdminShell
      active="/admin/catalog"
      title={
        <span>
          Product <em className="italic text-ng-clay font-display">catalog</em>
        </span>
      }
      subtitle={`${PRODUCTS.length} SKUs · ${live} live · ${blocked} stock-blocked · ${drafts} in draft`}
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="import-bold" size={15} className="text-ng-forest" />
            Import CSV
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="add-circle-bold" size={15} />
            New product
          </button>
        </>
      }
    >
      {/* Stat tiles + category mix */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <StatTile label="Live SKUs" value={String(live)} delta={`${Math.round((live / ROWS.length) * 100)}% of catalog`} trend="up" />
          <StatTile label="Avg rating" value={`${avgRating}★`} delta="across all SKUs" trend="flat" />
          <StatTile label="Stock-blocked" value={String(blocked)} delta="needs restock" trend="down" />
          <StatTile label="Drafts" value={String(drafts)} delta="awaiting copy + photos" trend="flat" />
        </div>
        <Card title="Catalog by category">
          <HBars rows={catRows} tone="forest" formatValue={(v) => `${v}`} />
        </Card>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 bg-ng-paper border border-ng-line-soft rounded-full p-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`px-4 py-1.5 rounded-full text-[12.5px] transition-colors cursor-pointer ${
                i === 0 ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted hover:text-ng-forest"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Icon name="magnifer-linear" size={15} className="text-ng-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search SKU, name, tag…"
              className="rounded-full bg-ng-paper border border-ng-line-soft pl-9 pr-4 py-2 text-[13px] w-72 focus:border-ng-forest outline-none"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line-soft px-3.5 py-2 text-[13px] bg-ng-paper hover:bg-ng-cream transition-colors cursor-pointer">
            <Icon name="filter-bold" size={15} className="text-ng-ink-soft" />
            Filters
          </button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[auto_2.6fr_1fr_0.9fr_1.1fr_0.8fr_0.7fr_1fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span className="w-4"><input type="checkbox" aria-label="Select all" /></span>
          <span>Product</span>
          <span>SKU</span>
          <span>Category</span>
          <span>Price</span>
          <span>Rating</span>
          <span>Stock</span>
          <span>Status</span>
          <span></span>
        </div>
        <ul>
          {ROWS.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-[auto_2.6fr_1fr_0.9fr_1.1fr_0.8fr_0.7fr_1fr_0.5fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <span className="w-4"><input type="checkbox" aria-label={`Select ${r.title}`} /></span>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative size-11 rounded-lg overflow-hidden bg-ng-sage shrink-0">
                  <Image src={r.image} alt={r.title} fill className="object-cover" sizes="44px" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ng-ink">{r.title}</span>
                    {r.badge ? (
                      <span className="shrink-0 text-[9.5px] uppercase tracking-wider font-bold text-ng-clay-deep bg-ng-clay/15 rounded-full px-2 py-0.5">
                        {r.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-ng-ink-soft mt-0.5">{r.unit}</div>
                </div>
              </div>
              <span className="font-mono text-[11.5px] text-ng-ink-muted">{r.sku}</span>
              <span className="text-[12px] text-ng-ink-muted">{r.category}</span>
              <span>
                <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">₹{r.price.toLocaleString("en-IN")}</span>
                {r.margin > 0 ? (
                  <span className="block text-[10.5px] text-ng-ink-soft">
                    <span className="line-through">₹{r.mrp.toLocaleString("en-IN")}</span> · {r.margin}% off
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1 font-mono text-[12px] tabular-nums">
                <Icon name="star-bold" size={12} className="text-ng-clay" />
                {r.rating?.toFixed(1)}
              </span>
              <span className={`font-mono text-[12px] tabular-nums ${r.stock < 20 ? "text-ng-terracotta font-semibold" : ""}`}>{r.stock}</span>
              <span><Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Pill></span>
              <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">Edit →</button>
            </li>
          ))}
        </ul>

        <div className="px-6 py-3 flex items-center justify-between text-[12px] text-ng-ink-soft border-t border-ng-line-soft bg-ng-cream/40">
          <span>Showing 1–{ROWS.length} of {ROWS.length}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg border border-ng-line-soft hover:bg-ng-paper transition-colors cursor-pointer">← Prev</button>
            <button className="px-3 py-1 rounded-lg border border-ng-line-soft hover:bg-ng-paper transition-colors cursor-pointer">Next →</button>
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}
