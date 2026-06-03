import { CaptainShell, CaptainCard } from "@/components/ng/captain/captain-shell";

const PODS = [
  {
    name: "Indiranagar pod",
    members: 28,
    orders: 42,
    gmv: 18420,
    commission: 1842,
    status: "Ready to settle",
    tone: "info" as const,
  },
  {
    name: "JP Nagar pod",
    members: 22,
    orders: 31,
    gmv: 14160,
    commission: 1416,
    status: "Closes 22:00",
    tone: "warn" as const,
  },
  {
    name: "HSR Layout pod",
    members: 18,
    orders: 24,
    gmv: 11240,
    commission: 1124,
    status: "Closes 23 May",
    tone: "neutral" as const,
  },
];

const PAYOUT_HISTORY = [
  { id: "ST-2026-042", date: "12 May 2026", pods: 3, amount: 4280, status: "Paid · UPI" },
  { id: "ST-2026-040", date: "05 May 2026", pods: 3, amount: 3920, status: "Paid · UPI" },
  { id: "ST-2026-038", date: "28 Apr 2026", pods: 2, amount: 2840, status: "Paid · UPI" },
];

export default function CaptainSettle() {
  const totalReady = PODS.filter((p) => p.status === "Ready to settle").reduce((s, p) => s + p.commission, 0);

  return (
    <CaptainShell active="/captain/settle" title="Settle" subtitle="Close pod cycles, claim your commission">
      {/* Hero amount */}
      <CaptainCard tone="forest" className="mb-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-ng-clay/20 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-ng-clay">Ready to settle</div>
          <div className="font-display text-[48px] text-ng-cream leading-none mt-2">₹{totalReady.toLocaleString()}</div>
          <div className="text-[12px] text-ng-cream/70 mt-3">1 pod closed · 1 pending close</div>
          <button className="mt-5 w-full rounded-full bg-ng-clay text-ng-forest-deep font-semibold py-3 text-[14px] hover:bg-ng-clay-deep transition-colors">
            Request payout to UPI →
          </button>
        </div>
      </CaptainCard>

      <h2 className="font-display text-[16px] text-ng-forest-deep mb-3">Pod cycles</h2>
      <div className="space-y-3">
        {PODS.map((p) => (
          <CaptainCard key={p.name}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-display text-[16px] text-ng-forest-deep leading-tight">{p.name}</div>
                <div className="text-[11.5px] text-ng-ink-muted mt-1">{p.members} members · {p.orders} orders</div>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider font-bold shrink-0 ${
                p.tone === "info" ? "bg-ng-forest/15 text-ng-forest" : p.tone === "warn" ? "bg-ng-clay/30 text-ng-clay-deep" : "bg-ng-line-soft text-ng-ink-muted"
              }`}>{p.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-ng-line-soft">
              <Stat label="GMV" value={`₹${p.gmv.toLocaleString()}`} />
              <Stat label="Your 10%" value={`₹${p.commission.toLocaleString()}`} tone="forest" />
            </div>
            {p.status === "Ready to settle" && (
              <button className="mt-4 w-full rounded-xl bg-ng-forest-deep text-ng-cream py-2.5 text-[13px] font-semibold">
                Close pod & settle
              </button>
            )}
          </CaptainCard>
        ))}
      </div>

      <h2 className="font-display text-[16px] text-ng-forest-deep mt-7 mb-3">Past payouts</h2>
      <CaptainCard className="!p-0 overflow-hidden">
        <ul className="divide-y divide-ng-line-soft">
          {PAYOUT_HISTORY.map((h) => (
            <li key={h.id} className="px-4 py-3 flex justify-between items-center text-[13px]">
              <div>
                <div className="font-mono text-[11.5px] text-ng-forest-deep">{h.id}</div>
                <div className="text-[11px] text-ng-ink-soft mt-0.5">{h.date} · {h.pods} pods</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[16px] text-ng-forest-deep">₹{h.amount.toLocaleString()}</div>
                <div className="text-[10.5px] text-ng-success mt-0.5">{h.status}</div>
              </div>
            </li>
          ))}
        </ul>
      </CaptainCard>
    </CaptainShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "forest" }) {
  return (
    <div className="rounded-xl bg-ng-cream px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft">{label}</div>
      <div className={`font-display text-[16px] leading-none mt-1 ${tone === "forest" ? "text-ng-forest" : "text-ng-forest-deep"}`}>
        {value}
      </div>
    </div>
  );
}
