import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS } from "@/components/ng/data";

/**
 * Admin · Wishlists — lets the client see which products customers have saved
 * to their wishlist, both in aggregate (most-wishlisted → a demand / restock
 * signal) and per-customer (who saved what → win-back targeting).
 *
 * Milestone 1 is front-end only: a shopper's wishlist lives in their own
 * browser (localStorage, see src/lib/wishlist.tsx), so there's no server to
 * aggregate every customer's saves yet. To keep this view useful today, the
 * numbers below are derived deterministically from the REAL catalogue (rating,
 * reviews, position) — identical on server and client, no random. Milestone 2
 * swaps `savesFor()` for real wishlist events from the backend; the UI stays.
 */

const WISHLISTERS = 3120; // customers with at least one saved item (demo total)

const CATEGORY_LABEL: Record<string, string> = {
  oil: "Oils",
  ghee: "A2 Ghee",
  honey: "Honey",
  superfood: "Superfoods",
  millet: "Millets",
  spice: "Spices",
  pulse: "Pulses",
  flour: "Flours",
  fruit: "Dry fruits",
  gifting: "Gifting",
};

function categoryOf(p: (typeof PRODUCTS)[number]): string {
  const tag = (p.tags ?? []).find((t) => CATEGORY_LABEL[t]);
  return tag ? CATEGORY_LABEL[tag] : "Pantry";
}

/** Deterministic save count from real catalogue signals (no Math.random). */
function savesFor(p: (typeof PRODUCTS)[number]): number {
  const seed = (p.title.length * 31 + (p.reviewCount ?? 0)) % 70;
  return Math.round((p.rating - 3.7) * 150 + (p.reviewCount ?? 0) * 0.05 + seed + 35);
}

const RANKED = [...PRODUCTS]
  .map((p) => ({ p, saves: savesFor(p) }))
  .sort((a, b) => b.saves - a.saves);

const TOP = RANKED.slice(0, 12);
const TOTAL_SAVES = RANKED.reduce((sum, r) => sum + r.saves, 0);
const TOP_PRODUCT = TOP[0]?.p;

/** Demand tier from the save count, for the badge. */
function demandTone(saves: number): "warn" | "success" | "neutral" {
  if (saves >= 220) return "warn"; // hot — watch stock
  if (saves >= 140) return "success";
  return "neutral";
}
function demandLabel(saves: number): string {
  if (saves >= 220) return "High demand";
  if (saves >= 140) return "Steady";
  return "Niche";
}

/* ---- per-customer saved items (demo) ------------------------------- */
const CUSTOMERS: { name: string; initial: string; community: string; saved: number; last: string; offset: number }[] = [
  { name: "Anjali Verma", initial: "A", community: "Aparna Sarovar Zenith", saved: 9, last: "2 h ago", offset: 0 },
  { name: "Priya Kapoor", initial: "P", community: "My Home Avatar", saved: 7, last: "Today, 11:04", offset: 2 },
  { name: "Karthik Rao", initial: "K", community: "Lodha Bellezza", saved: 12, last: "Yesterday", offset: 3 },
  { name: "Meera Shankar", initial: "M", community: "Manjeera Trinity", saved: 5, last: "3 days ago", offset: 5 },
  { name: "Rahul Menon", initial: "R", community: "Aparna Sarovar Zenith", saved: 8, last: "Today, 09:21", offset: 1 },
  { name: "Fatima Sheikh", initial: "F", community: "My Home Avatar", saved: 4, last: "5 days ago", offset: 6 },
];

/** Titles a customer has saved — a deterministic slice of the ranked list. */
function savedTitles(offset: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => RANKED[(offset * 2 + i) % RANKED.length].p.title);
}

export default function AdminWishlists() {
  return (
    <AdminShell
      active="/admin/wishlists"
      title={
        <span>
          Wishlists <em className="italic text-ng-clay font-display">&amp; saved items</em>
        </span>
      }
      subtitle="What customers have hearted but not yet bought — your live demand & restock signal"
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="diskette-bold" size={15} className="text-ng-forest" />
            Export CSV
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="speaker-bold" size={15} />
            Win-back campaign
          </button>
        </>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Customers wishlisting" value={WISHLISTERS.toLocaleString("en-IN")} delta="+186 this week" trend="up" />
        <StatTile label="Items saved" value={TOTAL_SAVES.toLocaleString("en-IN")} delta="across catalogue" trend="up" />
        <StatTile label="Wishlist → cart" value="34%" delta="+3 pt" trend="up" />
        <StatTile label="Most-saved" value={`#${1}`} delta={TOP_PRODUCT?.title} trend="flat" />
      </div>

      {/* Most-wishlisted products */}
      <Card
        title="Most-wishlisted products"
        action={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11.5px] text-ng-ink-soft">Sorted by saves · last 30 days</span>
            <button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All →</button>
          </div>
        }
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="grid grid-cols-[0.4fr_2.4fr_1fr_0.9fr_0.9fr_1fr_0.8fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>#</span>
          <span>Product</span>
          <span>Category</span>
          <span>Saves</span>
          <span>Share</span>
          <span>Demand</span>
          <span>Price</span>
        </div>
        <ul>
          {TOP.map(({ p, saves }, i) => {
            const share = Math.round((saves / WISHLISTERS) * 1000) / 10;
            return (
              <li
                key={p.id}
                className="grid grid-cols-[0.4fr_2.4fr_1fr_0.9fr_0.9fr_1fr_0.8fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <span className="font-display text-[15px] text-ng-clay-deep tabular-nums">{i + 1}</span>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ng-clay/10 text-ng-clay-deep">
                    <Icon name="heart-bold" size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-ng-forest-deep">{p.title}</div>
                    <div className="text-[11px] text-ng-ink-soft">{p.unit ?? "—"} · ★ {p.rating}</div>
                  </div>
                </div>
                <span className="text-[12px] text-ng-ink-muted truncate">{categoryOf(p)}</span>
                <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">{saves}</span>
                <span className="font-mono text-[12px] tabular-nums text-ng-ink-muted">{share}%</span>
                <span><Pill tone={demandTone(saves)}>{demandLabel(saves)}</Pill></span>
                <span className="font-mono text-[12.5px] tabular-nums">₹{p.price.toLocaleString("en-IN")}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Per-customer saved items + a demand-by-category recap */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
        <Card
          title="Who saved what"
          action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All customers →</button>}
          className="!p-0 overflow-hidden"
        >
          <ul>
            {CUSTOMERS.map((c) => {
              const chips = savedTitles(c.offset, 3);
              const extra = c.saved - chips.length;
              return (
                <li
                  key={c.name}
                  className="flex items-start gap-3 px-6 py-4 border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                >
                  <div className="size-9 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[14px] shrink-0">
                    {c.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium text-[13px] text-ng-forest-deep truncate">{c.name}</div>
                      <span className="text-[11px] text-ng-ink-soft shrink-0">Saved {c.last}</span>
                    </div>
                    <div className="text-[11px] text-ng-ink-soft">{c.community} · {c.saved} saved</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ng-cream px-2.5 py-1 text-[11px] text-ng-ink-muted">
                          <Icon name="heart-bold" size={11} className="text-ng-clay" />
                          <span className="max-w-[150px] truncate">{t}</span>
                        </span>
                      ))}
                      {extra > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-ng-line-soft px-2.5 py-1 text-[11px] font-medium text-ng-ink-soft">
                          +{extra} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Saved by category">
          <ul className="space-y-2.5">
            {Object.entries(
              RANKED.reduce<Record<string, number>>((acc, { p, saves }) => {
                const c = categoryOf(p);
                acc[c] = (acc[c] ?? 0) + saves;
                return acc;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .map(([cat, saves]) => {
                const pct = Math.round((saves / TOTAL_SAVES) * 100);
                return (
                  <li key={cat}>
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="text-ng-ink">{cat}</span>
                      <span className="font-mono text-[12px] text-ng-ink-soft tabular-nums">{saves.toLocaleString("en-IN")} · {pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-ng-line-soft overflow-hidden">
                      <div className="h-full rounded-full bg-ng-forest" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
