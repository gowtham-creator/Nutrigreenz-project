import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { Sparkline, TrendChip, type VizTone } from "@/components/ng/admin/viz";

/* ---- customers ---------------------------------------------------- */
const CUSTOMERS: {
  name: string;
  initial: string;
  orders: number;
  ltv: number;
  segment: string;
  tier: "Seed" | "Sapling" | "Banyan";
  community: string;
  spend: number[];
}[] = [
  { name: "Anjali Verma", initial: "A", orders: 28, ltv: 48200, segment: "VIP", tier: "Banyan", community: "Aparna Sarovar Zenith", spend: [1.2, 1.8, 1.5, 2.1, 1.9, 2.4, 2.2] },
  { name: "Rahul Menon", initial: "R", orders: 19, ltv: 31400, segment: "Repeat", tier: "Sapling", community: "Aparna Sarovar Zenith", spend: [0.9, 1.1, 1.0, 1.4, 1.2, 1.5, 1.3] },
  { name: "Priya Kapoor", initial: "P", orders: 22, ltv: 38600, segment: "VIP", tier: "Banyan", community: "My Home Avatar", spend: [1.4, 1.2, 1.7, 1.5, 1.9, 1.6, 2.0] },
  { name: "Karthik Rao", initial: "K", orders: 31, ltv: 52800, segment: "Subscriber", tier: "Banyan", community: "Lodha Bellezza", spend: [1.7, 1.9, 1.8, 2.0, 2.2, 2.1, 2.4] },
  { name: "Meera Shankar", initial: "M", orders: 12, ltv: 19200, segment: "Repeat", tier: "Sapling", community: "Lodha Bellezza", spend: [0.7, 0.9, 1.1, 0.8, 1.0, 1.2, 1.1] },
  { name: "Fatima Sheikh", initial: "F", orders: 4, ltv: 4800, segment: "New", tier: "Seed", community: "My Home Avatar", spend: [0.4, 0.6, 0.5, 0.7, 0.6, 0.8, 0.7] },
];

const SEGMENT_TONE: Record<string, VizTone> = {
  VIP: "clay",
  Repeat: "forest",
  Subscriber: "leaf",
  New: "blue",
};
const PILL_TONE: Record<string, "warn" | "info" | "success" | "neutral"> = {
  VIP: "warn",
  Repeat: "info",
  Subscriber: "success",
  New: "neutral",
};

/* ---- team --------------------------------------------------------- */
const TEAM = [
  { name: "Gowtham Reddy", role: "Founder · CDO", access: "Owner", last: "Active now", avatar: "G" },
  { name: "Hetal Pateel", role: "Farmer partner · Junagadh", access: "Farm portal", last: "2 days ago", avatar: "H" },
  { name: "K. Subbaiah", role: "Farmer partner · Anantapur", access: "Farm portal", last: "Today, 08:12", avatar: "K" },
  { name: "Sneha Kumar", role: "Captain · Bengaluru South", access: "Captain PWA", last: "12 min ago", avatar: "S" },
  { name: "Priya M.", role: "Lab desk · QA", access: "Admin · QC only", last: "Today, 10:42", avatar: "P" },
  { name: "Rahul Sharma", role: "Ops manager", access: "Admin · full", last: "Today, 09:30", avatar: "R" },
];

const ROLES = [
  { name: "Owner", count: 1, perms: "Everything · billing · destructive" },
  { name: "Admin · full", count: 3, perms: "Catalog, orders, inventory, marketing" },
  { name: "Admin · QC only", count: 2, perms: "Inventory, lots, lab reports" },
  { name: "Captain", count: 12, perms: "Captain PWA only · own bundle" },
  { name: "Farmer", count: 24, perms: "Farm portal · own farm" },
];

const CAPTAINS = [
  { name: "Sneha Kumar", area: "HYD-Nallagandla", bundles: 4, members: 142, gmv: 84200 },
  { name: "Arjun D.", area: "HYD-Narsingi", bundles: 3, members: 96, gmv: 58400 },
  { name: "Karthik R.", area: "HYD-Kukatpally", bundles: 2, members: 64, gmv: 41200 },
];

export default function AdminPeople() {
  return (
    <AdminShell
      active="/admin/people"
      title={
        <span>
          People <em className="italic text-ng-clay font-display">&amp; access</em>
        </span>
      }
      subtitle="Customers, internal team, farmer partners, community captains — and what they can see"
      actions={
        <>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer">
            <Icon name="clipboard-list-bold" size={15} className="text-ng-forest" />
            Audit log
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer">
            <Icon name="user-plus-bold" size={15} />
            Invite
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Customers" value="12,840" delta="+312 this month" trend="up" />
        <StatTile label="Repeat rate" value="62%" delta="+4 pt" trend="up" />
        <StatTile label="Avg LTV" value="₹18.4k" delta="VIP ₹42k" trend="up" />
        <StatTile label="MFA enrolled (team)" value="100%" trend="up" />
      </div>

      {/* Customers table */}
      <Card
        title="Customers"
        action={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex gap-1 bg-ng-cream rounded-full p-1">
              {["All", "VIP", "Repeat", "New"].map((t, i) => (
                <button
                  key={t}
                  className={`px-3 py-1 rounded-full text-[11.5px] transition-colors cursor-pointer ${
                    i === 0 ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted hover:text-ng-forest"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All →</button>
          </div>
        }
        className="!p-0 overflow-hidden mb-6"
      >
        <div className="grid grid-cols-[2fr_0.7fr_1fr_1.6fr_1.1fr_0.9fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>Customer</span>
          <span>Orders</span>
          <span>LTV</span>
          <span>Community</span>
          <span>Segment</span>
          <span>Trend</span>
          <span></span>
        </div>
        <ul>
          {CUSTOMERS.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[2fr_0.7fr_1fr_1.6fr_1.1fr_0.9fr_0.5fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[14px] shrink-0">
                  {c.initial}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-ng-ink-soft">{c.tier} tier</div>
                </div>
              </div>
              <span className="font-mono text-[12px] tabular-nums">{c.orders}</span>
              <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">₹{c.ltv.toLocaleString("en-IN")}</span>
              <span className="text-[12px] text-ng-ink-muted truncate">{c.community}</span>
              <span><Pill tone={PILL_TONE[c.segment]}>{c.segment}</Pill></span>
              <Sparkline data={c.spend} tone={SEGMENT_TONE[c.segment]} width={64} height={24} fill={false} />
              <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">View →</button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Team + roles */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
        <Card
          title="Team & partners"
          action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All →</button>}
          className="!p-0 overflow-hidden"
        >
          <div className="grid grid-cols-[2.2fr_1.4fr_1.2fr_0.6fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
            <span>Person</span>
            <span>Access</span>
            <span>Last active</span>
            <span></span>
          </div>
          <ul>
            {TEAM.map((t) => (
              <li
                key={t.name}
                className="grid grid-cols-[2.2fr_1.4fr_1.2fr_0.6fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-ng-forest-deep text-ng-cream flex items-center justify-center font-display text-[14px] shrink-0">
                    {t.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-[11.5px] text-ng-ink-soft truncate">{t.role}</div>
                  </div>
                </div>
                <span>
                  <Pill tone={t.access === "Owner" ? "warn" : t.access.startsWith("Admin") ? "info" : "success"}>{t.access}</Pill>
                </span>
                <span className="text-[12px] text-ng-ink-muted">{t.last}</span>
                <button className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer">Edit →</button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Roles & permissions">
          <ul className="space-y-3">
            {ROLES.map((r) => (
              <li key={r.name} className="rounded-xl border border-ng-line-soft p-4 hover:border-ng-leaf-soft transition-colors">
                <div className="flex justify-between gap-2 items-baseline">
                  <span className="font-display text-[15px] text-ng-forest-deep">{r.name}</span>
                  <span className="font-mono text-[12px] text-ng-ink-soft tabular-nums">{r.count} {r.count === 1 ? "person" : "people"}</span>
                </div>
                <p className="text-[12px] text-ng-ink-muted mt-1.5 leading-relaxed">{r.perms}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Community captains performance"
        action={<button className="text-[12px] text-ng-forest hover:underline cursor-pointer">All captains →</button>}
        className="!p-0 overflow-hidden"
      >
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium">
          <span>Captain</span>
          <span>Area</span>
          <span>Bundles</span>
          <span>Members</span>
          <span>GMV last 30d</span>
        </div>
        <ul>
          {CAPTAINS.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-[12px] text-ng-ink-muted font-mono">{c.area}</span>
              <span className="font-mono text-[12px] tabular-nums">{c.bundles}</span>
              <span className="font-mono text-[12px] tabular-nums">{c.members}</span>
              <span className="font-mono text-[12.5px] tabular-nums font-semibold">₹{c.gmv.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </AdminShell>
  );
}
