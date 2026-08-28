import Link from "next/link";
import { AdminShell } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { LiveCouponsPanel } from "@/components/ng/admin/super/live-coupons-panel";
import { PromotionsPanel } from "@/components/ng/admin/super/promotions-panel";
import { AnnouncementsPanel } from "@/components/ng/admin/super/announcements-panel";

/**
 * Marketing desk — every surface here is live and backed by the database.
 *
 * Promotions (the seasonal sale engine), the redeemable coupon catalogue and the
 * storefront announcement marquee all read and write real rows. The former
 * campaign / segment / channel-revenue blocks were illustrative sample figures
 * with no backend, so they have been removed rather than shown to operators as
 * if they were reporting. Real reporting lives on /admin/reports and
 * /admin/analytics; the referral and loyalty programmes are configured on
 * /admin/config and reviewed on /admin/referrals.
 */

/** Where the genuinely-live adjacent surfaces live, for quick navigation. */
const RELATED = [
  {
    href: "/admin/referrals",
    icon: "customers",
    title: "Referrals",
    detail: "Live referral ledger: who referred whom, and what was awarded.",
  },
  {
    href: "/admin/config",
    icon: "settings",
    title: "Loyalty & referral settings",
    detail: "Earn rate, redeem value, guardrails and referral rewards.",
  },
  {
    href: "/admin/analytics",
    icon: "chart-square-bold",
    title: "Analytics",
    detail: "Real order, product and revenue performance.",
  },
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
      subtitle="Promotions, redeemable coupons and storefront announcements, all live"
      actions={
        <a
          href="#live-coupons"
          className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <UiIcon name="tag" size={15} />
          New coupon
        </a>
      }
    >
      {/* Promotions — the occasion/seasonal sale engine (banner picker, discount,
          scope & schedule; create / edit / delete). */}
      <PromotionsPanel />

      {/* Live coupons — the redeemable coupon catalogue, including pincode and
          gated-community targeting. */}
      <LiveCouponsPanel />

      {/* Top-bar announcements — the evergreen storefront marquee lines. The
          PromoBar prepends any live promotion ahead of these at render time. */}
      <AnnouncementsPanel />

      {/* Pointers to the other live surfaces operators usually want next. */}
      <div className="mt-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
          Related
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {RELATED.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="group flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-colors hover:border-ng-leaf"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ng-forest/8">
                  <Icon name={r.icon} size={18} className="text-ng-forest" />
                </span>
                <span className="font-display text-[15px] text-ng-forest-deep">{r.title}</span>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ng-ink-muted">{r.detail}</p>
              <span className="mt-auto pt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-ng-forest group-hover:text-ng-forest-deep">
                Open
                <Icon name="arrow-right-linear" size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
