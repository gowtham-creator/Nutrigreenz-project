import Link from "next/link";
import { CaptainShell, CaptainCard } from "@/components/ng/captain/captain-shell";

const PICKUPS_TODAY = [
  { id: "PK-2026-218", farm: "Anantapur · K. Subbaiah", items: "Groundnut · 1,500 kg", eta: "14:30", status: "Scheduled", tone: "info" },
  { id: "PK-2026-219", farm: "Bellary · R. Eshwarappa", items: "Foxtail millet · 1,200 kg", eta: "17:00", status: "En route", tone: "warn" },
];

const BUNDLES = [
  { name: "Indiranagar pod", members: 28, gmv: 18420, status: "Open" },
  { name: "JP Nagar pod", members: 22, gmv: 14160, status: "Closing tonight" },
  { name: "HSR Layout pod", members: 18, gmv: 11240, status: "Open" },
];

export default function CaptainHome() {
  return (
    <CaptainShell active="/captain" title={<>Good morning, Sneha.</>} subtitle="Tuesday · 19 May · clear skies in BLR-South">
      {/* Today metric */}
      <CaptainCard tone="forest" className="mb-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-ng-clay/20 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-ng-clay">Today's commission</div>
          <div className="font-display text-[44px] text-ng-cream leading-none mt-2">₹3,840</div>
          <div className="text-[12px] text-ng-cream/70 mt-3">From 2 pickups · 3 bundle settles · 18 deliveries</div>
        </div>
      </CaptainCard>

      {/* Pickups today */}
      <h2 className="font-display text-[18px] text-ng-forest-deep mt-7 mb-3 flex items-center justify-between">
        Pickups today
        <Link href="/captain/pickups" className="text-[12px] text-ng-forest font-medium">All →</Link>
      </h2>
      <div className="space-y-3">
        {PICKUPS_TODAY.map((p) => (
          <Link key={p.id} href="/captain/intake" className="block">
            <CaptainCard>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-ng-forest-deep">{p.id}</div>
                  <div className="font-medium text-[14px] mt-1">{p.farm}</div>
                  <div className="text-[12px] text-ng-ink-muted mt-1">{p.items}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-[20px] text-ng-forest-deep leading-none">{p.eta}</div>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                    p.tone === "warn" ? "bg-ng-clay/30 text-ng-clay-deep" : "bg-ng-forest/15 text-ng-forest"
                  }`}>{p.status}</span>
                </div>
              </div>
            </CaptainCard>
          </Link>
        ))}
      </div>

      {/* Bundles */}
      <h2 className="font-display text-[18px] text-ng-forest-deep mt-7 mb-3 flex items-center justify-between">
        Your bundles
        <span className="text-[12px] text-ng-ink-soft font-normal">3 active</span>
      </h2>
      <div className="space-y-3">
        {BUNDLES.map((b) => (
          <CaptainCard key={b.name} tone="sage">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[16px] text-ng-forest-deep leading-tight">{b.name}</div>
                <div className="text-[11.5px] text-ng-ink-muted mt-1">{b.members} members · {b.status}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[20px] text-ng-forest-deep">₹{b.gmv.toLocaleString()}</div>
                <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft mt-1">This cycle</div>
              </div>
            </div>
          </CaptainCard>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mt-7">
        <Link href="/captain/intake" className="rounded-2xl bg-ng-forest-deep text-ng-cream px-4 py-4 text-center text-[14px] font-semibold hover:bg-ng-forest transition-colors">
          ↓ Receive lot
        </Link>
        <Link href="/captain/settle" className="rounded-2xl bg-ng-clay text-ng-forest-deep px-4 py-4 text-center text-[14px] font-semibold hover:bg-ng-clay-deep transition-colors">
          ₹ Settle bundle
        </Link>
      </div>
    </CaptainShell>
  );
}
