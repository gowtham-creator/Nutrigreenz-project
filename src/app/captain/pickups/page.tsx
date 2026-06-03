import { CaptainShell, CaptainCard } from "@/components/ng/captain/captain-shell";

const SECTIONS = [
  {
    label: "Today · 19 May",
    items: [
      { id: "PK-2026-218", farm: "Anantapur · K. Subbaiah", items: "Groundnut · 1,500 kg", eta: "14:30", status: "Scheduled", tone: "info" },
      { id: "PK-2026-219", farm: "Bellary · R. Eshwarappa", items: "Foxtail millet · 1,200 kg", eta: "17:00", status: "En route", tone: "warn" },
    ],
  },
  {
    label: "Tomorrow · 20 May",
    items: [
      { id: "PK-2026-220", farm: "Karnataka · M. Devraj", items: "Sunflower · 900 kg", eta: "11:00", status: "Scheduled", tone: "info" },
      { id: "PK-2026-221", farm: "Mysore · F. Patil", items: "Cold-press blend · 600 kg", eta: "15:30", status: "Scheduled", tone: "info" },
    ],
  },
  {
    label: "This week",
    items: [
      { id: "PK-2026-222", farm: "Hassan · L. Krishnamurthy", items: "Coffee parchment · 400 kg", eta: "21 May", status: "Pending farmer ✓", tone: "warn" },
      { id: "PK-2026-223", farm: "Kodagu · A. Bopanna", items: "Forest honey · 180 jars", eta: "22 May", status: "Scheduled", tone: "info" },
    ],
  },
];

export default function CaptainPickups() {
  return (
    <CaptainShell active="/captain/pickups" title="Pickups" subtitle="6 scheduled across 5 farms this week">
      {/* Toolbar */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {["All", "Today", "Tomorrow", "This week", "Pending"].map((t, i) => (
          <button
            key={t}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] transition-colors ${
              i === 0 ? "bg-ng-forest-deep text-ng-cream font-semibold" : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {SECTIONS.map((s) => (
        <section key={s.label} className="mb-6">
          <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium mb-2 px-1">{s.label}</div>
          <div className="space-y-3">
            {s.items.map((p) => (
              <CaptainCard key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-ng-forest-deep">{p.id}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider font-bold ${
                        p.tone === "warn" ? "bg-ng-clay/30 text-ng-clay-deep" : "bg-ng-forest/15 text-ng-forest"
                      }`}>{p.status}</span>
                    </div>
                    <div className="font-medium text-[14px] mt-1.5">{p.farm}</div>
                    <div className="text-[12px] text-ng-ink-muted mt-1">{p.items}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-[18px] text-ng-forest-deep leading-none">{p.eta}</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-ng-line-soft grid grid-cols-3 gap-2">
                  <button className="text-[12px] py-2 rounded-lg bg-ng-cream border border-ng-line-soft hover:bg-ng-paper">📍 Route</button>
                  <button className="text-[12px] py-2 rounded-lg bg-ng-cream border border-ng-line-soft hover:bg-ng-paper">📞 Call</button>
                  <button className="text-[12px] py-2 rounded-lg bg-ng-forest text-ng-cream font-semibold hover:bg-ng-forest-deep">Open →</button>
                </div>
              </CaptainCard>
            ))}
          </div>
        </section>
      ))}
    </CaptainShell>
  );
}
