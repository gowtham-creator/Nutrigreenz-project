import Link from "next/link";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";

/* ---- team --------------------------------------------------------- */
const TEAM = [
  { name: "Gowtham Reddy", role: "Founder · CDO", access: "Owner", last: "Active now", avatar: "G" },
  { name: "Hetal Pateel", role: "Farmer partner · Junagadh", access: "Farm portal", last: "2 days ago", avatar: "H" },
  { name: "K. Subbaiah", role: "Farmer partner · Anantapur", access: "Farm portal", last: "Today, 08:12", avatar: "K" },
  { name: "Sneha Kumar", role: "Captain · Hyderabad West", access: "Captain PWA", last: "12 min ago", avatar: "S" },
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

      {/* Customers — now a deduped canonical directory, lives on its own page. */}
      <Card title="Customers" className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="size-12 rounded-2xl bg-ng-sage/50 flex items-center justify-center shrink-0">
            <Icon name="user-rounded-bold" size={24} className="text-ng-forest" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] text-ng-forest-deep">Deduped customer directory</p>
            <p className="text-[12.5px] font-medium text-ng-ink-muted mt-0.5 leading-relaxed">
              One canonical row per real person — Google and phone sign-ins folded into a single
              customer, with linked providers, mobile, email and saved addresses.
            </p>
          </div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer shrink-0"
          >
            Open customers
            <Icon name="alt-arrow-right-bold" size={14} />
          </Link>
        </div>
      </Card>

      {/* Team + roles */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
        <Card
          title="Team & partners"
          action={<button className="text-[12px] font-semibold text-ng-forest hover:underline cursor-pointer">All →</button>}
          className="!p-0 overflow-hidden"
        >
          <div className="grid grid-cols-[2.2fr_1.4fr_1.2fr_0.6fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
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
                    <div className="font-semibold text-ng-ink truncate">{t.name}</div>
                    <div className="text-[11.5px] font-medium text-ng-ink-soft truncate">{t.role}</div>
                  </div>
                </div>
                <span>
                  <Pill tone={t.access === "Owner" ? "warn" : t.access.startsWith("Admin") ? "info" : "success"}>{t.access}</Pill>
                </span>
                <span className="text-[12px] font-medium text-ng-ink-soft">{t.last}</span>
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
                  <span className="font-mono text-[12px] font-medium text-ng-ink-soft tabular-nums">{r.count} {r.count === 1 ? "person" : "people"}</span>
                </div>
                <p className="text-[12px] font-medium text-ng-ink-muted mt-1.5 leading-relaxed">{r.perms}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Community captains performance"
        action={<button className="text-[12px] font-semibold text-ng-forest hover:underline cursor-pointer">All captains →</button>}
        className="!p-0 overflow-hidden"
      >
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
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
              <span className="font-semibold text-ng-ink">{c.name}</span>
              <span className="text-[12px] font-medium text-ng-ink-muted font-mono">{c.area}</span>
              <span className="font-mono text-[12px] tabular-nums font-semibold text-ng-ink">{c.bundles}</span>
              <span className="font-mono text-[12px] tabular-nums font-semibold text-ng-ink">{c.members}</span>
              <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-ink">₹{c.gmv.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </AdminShell>
  );
}
