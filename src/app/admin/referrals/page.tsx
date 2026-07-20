import { requirePermission } from "@/lib/admin-permissions-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listReferralAttributions, type AdminReferralPage } from "@/lib/referrals";

// Reporting reads live data on each visit.
export const revalidate = 0;

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

function StatusBadge({ status }: { status: "pending" | "rewarded" | "void" }) {
  const tone =
    status === "rewarded"
      ? "bg-ng-leaf/15 text-ng-forest"
      : status === "pending"
        ? "bg-ng-clay/15 text-ng-clay-deep"
        : "bg-ng-line/40 text-ng-ink-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default async function AdminReferralsPage() {
  await requirePermission("referrals");

  let page: AdminReferralPage = { rows: [], total: 0, rewarded: 0, pending: 0 };
  if (isSupabaseConfigured) {
    try {
      page = await listReferralAttributions(100, 0);
    } catch {
      /* fall through to the empty state */
    }
  }

  const stats = [
    { label: "Total referrals", value: page.total },
    { label: "Rewarded", value: page.rewarded },
    { label: "Pending", value: page.pending },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[26px] text-ng-forest-deep">Referrals</h1>
        <p className="mt-1 text-[14px] text-ng-ink-muted">
          Who referred whom, and the rewards paid when a referee&apos;s first qualifying order confirms.
        </p>
      </header>

      <div className="mb-7 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-ng-line-soft bg-ng-paper px-4 py-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-ng-ink-muted">{s.label}</div>
            <div className="mt-1 font-display text-[28px] tabular-nums text-ng-forest-deep">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ng-line-soft bg-ng-paper">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-ng-line-soft text-[12px] uppercase tracking-wider text-ng-ink-muted">
              <th className="px-4 py-3 font-semibold">Referrer</th>
              <th className="px-4 py-3 font-semibold">Referee</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Reward paid</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Rewarded</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-ng-ink-muted">
                  No referrals yet. Customers can share their code from their account to start earning.
                </td>
              </tr>
            ) : (
              page.rows.map((r) => (
                <tr key={r.id} className="border-b border-ng-line-soft/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ng-forest-deep">{r.referrerName ?? "—"}</div>
                    <div className="text-[12px] text-ng-ink-muted">{r.referrerEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ng-forest-deep">{r.refereeName ?? "—"}</div>
                    <div className="text-[12px] text-ng-ink-muted">{r.refereeEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-ng-ink">
                    {r.status === "rewarded" ? (
                      <span className="tabular-nums">
                        {r.referrerPointsAwarded} pts · {rupees(r.refereeDiscountPaiseAwarded)}
                      </span>
                    ) : (
                      <span className="text-ng-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ng-ink-muted">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 tabular-nums text-ng-ink-muted">{fmtDate(r.rewardedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
