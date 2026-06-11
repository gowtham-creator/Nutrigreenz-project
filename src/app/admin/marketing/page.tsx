import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { Sparkline, HBars, TrendChip, type VizTone } from "@/components/ng/admin/viz";

const CAMPAIGNS = [
  { name: "Harvest letter #142", channel: "Email", segment: "All subscribers (28,412)", sent: "12 May", opens: 13642, ctr: 8.4, revenue: 184200, roi: "6.4×", status: "Sent", tone: "success" as const },
  { name: "Sapling tier early-access drop", channel: "Email + push", segment: "Sapling tier (4,218)", sent: "08 May", opens: 2811, ctr: 14.2, revenue: 62800, roi: "9.1×", status: "Sent", tone: "success" as const },
  { name: "Win-back · 90d lapsed", channel: "Email", segment: "Lapsed 90d (1,840)", sent: "Scheduled 21 May", opens: 0, ctr: 0, revenue: 0, roi: "—", status: "Scheduled", tone: "info" as const },
  { name: "Festive hamper launch", channel: "All channels", segment: "All (47,200)", sent: "Draft", opens: 0, ctr: 0, revenue: 0, roi: "—", status: "Draft", tone: "warn" as const },
];

const COUPONS = [
  { code: "MONSOON25", discount: "₹250 off ₹999+", mode: "Public", uses: 1284, capacity: 5000, redeemed: 320900, expires: "30 Jun", roi: "5.2×" },
  { code: "FIRST100", discount: "₹100 off first order", mode: "First-order", uses: 8419, capacity: Infinity, redeemed: 841900, expires: "—", roi: "7.8×" },
  { code: "FAMILYPACK", discount: "12% off 5+ items", mode: "Targeted", uses: 642, capacity: 2000, redeemed: 128400, expires: "31 May", roi: "4.1×" },
];

const SEGMENTS = [
  { name: "Sapling tier · A2 ghee buyers", count: 2840, growth: "+12%" as const, dir: "up" as const },
  { name: "First-time customers · 30d", count: 1162, growth: "+8%" as const, dir: "up" as const },
  { name: "Cart abandoners · 7d", count: 487, growth: "+24%" as const, dir: "up" as const },
  { name: "VIP · Banyan tier", count: 312, growth: "+3%" as const, dir: "up" as const },
];

const OPEN_RATE = [44, 46, 43, 48, 47, 49, 48.6];

const PROGRAMS = [
  { icon: "gift-bold", title: "Referral program", detail: "Give ₹150, get ₹150 · 1,284 referrals this quarter", stat: "₹192k", statLabel: "referred GMV", tone: "leaf" as VizTone },
  { icon: "medal-ribbons-star-bold", title: "Loyalty · tier ladder", detail: "Seed → Sapling → Banyan · 10 pts = ₹1", stat: "4,218", statLabel: "Sapling members", tone: "clay" as VizTone },
  { icon: "users-group-two-rounded-bold", title: "Community captains", detail: "Bundle leaders earn 4% · 12 active captains", stat: "₹2.4L", statLabel: "captain GMV", tone: "forest" as VizTone },
];

export default function AdminMarketing() {
  return (
    <AdminShell
      active="/admin/marketing"
      title={
        <span>
          Marketing <em className="italic text-ng-clay font-display">desk</em>
        </span>
      }
      subtitle="Campaigns, coupons, segments, referral & loyalty — all in one place"
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="tag-price-bold" size={15} className="text-ng-forest" />
            New coupon
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="speaker-bold" size={15} />
            New campaign
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Subscribers" value="28,412" delta="+412 this week" trend="up" />
        <div className="flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">Avg open rate</div>
            <TrendChip delta="+2.1 pt" direction="up" />
          </div>
          <div className="font-display text-[30px] text-ng-forest-deep leading-none mt-2.5 tabular-nums">48.6%</div>
          <Sparkline data={OPEN_RATE} tone="leaf" width={200} height={32} className="w-full mt-auto pt-3" />
        </div>
        <StatTile label="Avg CTR" value="9.2%" delta="industry 2.1%" trend="up" />
        <StatTile label="Coupon ROAS" value="6.4×" delta="₹3.8L spend" trend="up" />
      </div>

      {/* Campaigns */}
      <Card
        title="Campaigns"
        action={<button className="text-[12px] font-semibold text-ng-forest hover:underline cursor-pointer">All →</button>}
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="grid grid-cols-[2.2fr_1.1fr_1.6fr_0.8fr_0.6fr_0.9fr_0.6fr_0.9fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>Campaign</span>
          <span>Channel</span>
          <span>Segment</span>
          <span>Opens</span>
          <span>CTR</span>
          <span>Revenue</span>
          <span>ROI</span>
          <span>Status</span>
          <span></span>
        </div>
        <ul>
          {CAMPAIGNS.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[2.2fr_1.1fr_1.6fr_0.8fr_0.6fr_0.9fr_0.6fr_0.9fr_0.5fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-semibold text-ng-ink truncate">{c.name}</div>
                <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">{c.sent}</div>
              </div>
              <span className="text-[12px] font-medium text-ng-ink-muted">{c.channel}</span>
              <span className="text-[12px] font-medium text-ng-ink-muted truncate">{c.segment}</span>
              <span className="font-mono text-[12px] tabular-nums font-medium text-ng-ink">{c.opens ? c.opens.toLocaleString("en-IN") : "—"}</span>
              <span className="font-mono text-[12px] tabular-nums font-medium text-ng-ink">{c.ctr ? `${c.ctr}%` : "—"}</span>
              <span className="font-mono text-[12px] tabular-nums font-semibold text-ng-ink">{c.revenue ? `₹${c.revenue.toLocaleString("en-IN")}` : "—"}</span>
              <span className="font-mono text-[12px] tabular-nums text-ng-success font-semibold">{c.roi}</span>
              <span><Pill tone={c.tone}>{c.status}</Pill></span>
              <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">Open →</button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Coupons + segments */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
        <Card title="Coupons" action={<button className="text-[12px] font-semibold text-ng-forest hover:underline cursor-pointer">+ Create</button>}>
          <ul className="divide-y divide-ng-line-soft">
            {COUPONS.map((c) => {
              const cap = c.capacity;
              const pct = Number.isFinite(cap) ? Math.min(100, (c.uses / (cap as number)) * 100) : 0;
              return (
                <li key={c.code} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[14px] font-semibold text-ng-forest-deep">{c.code}</span>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-ng-forest bg-ng-forest/10 rounded-full px-2 py-0.5">{c.mode}</span>
                      </div>
                      <div className="text-[12px] font-medium text-ng-ink-muted mt-1">{c.discount} · expires {c.expires}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[12.5px] tabular-nums font-semibold">
                        {c.uses.toLocaleString("en-IN")}{Number.isFinite(cap) ? ` / ${(cap as number).toLocaleString("en-IN")}` : " / ∞"}
                      </div>
                      <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">redemptions · ROI {c.roi}</div>
                    </div>
                  </div>
                  {Number.isFinite(cap) ? (
                    <div className="h-1.5 bg-ng-line-soft rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-ng-forest rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Segments" action={<button className="text-[12px] font-semibold text-ng-forest hover:underline cursor-pointer">+ New</button>}>
          <ul className="space-y-1">
            {SEGMENTS.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 py-2.5 border-b border-ng-line-soft last:border-0">
                <span className="text-[13px] font-medium text-ng-ink flex-1 min-w-0 truncate">{s.name}</span>
                <span className="font-mono text-[13px] tabular-nums font-semibold">{s.count.toLocaleString("en-IN")}</span>
                <TrendChip delta={s.growth} direction={s.dir} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Referral / loyalty / captain programs */}
      <div className="grid md:grid-cols-3 gap-4">
        {PROGRAMS.map((p) => (
          <div key={p.title} className="flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
            <div className="flex items-center gap-2.5">
              <span className="size-9 rounded-xl bg-ng-forest/8 flex items-center justify-center shrink-0">
                <Icon name={p.icon} size={18} className="text-ng-forest" />
              </span>
              <span className="font-display text-[15px] text-ng-forest-deep">{p.title}</span>
            </div>
            <p className="text-[12px] font-medium text-ng-ink-muted mt-3 leading-relaxed">{p.detail}</p>
            <div className="mt-auto pt-3 border-t border-ng-line-soft flex items-baseline gap-2">
              <span className="font-display text-[22px] text-ng-forest-deep tabular-nums">{p.stat}</span>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">{p.statLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Card title="Channel revenue · 7-day GMV attribution">
          <HBars
            rows={[
              { label: "Email", value: 247000, hint: "6.4× ROAS" },
              { label: "Push", value: 132000, hint: "9.1× ROAS" },
              { label: "Referral", value: 192000, hint: "organic" },
              { label: "Community captains", value: 240000, hint: "4% comm." },
              { label: "Paid social", value: 98000, hint: "3.2× ROAS" },
            ]}
            tone="clay"
            formatValue={(v) => `₹${(v / 1000).toFixed(0)}k`}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
