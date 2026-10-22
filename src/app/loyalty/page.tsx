import Link from "next/link";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { getCustomerSession } from "@/lib/customer-session";
import { getLoyaltyConfig, loyaltyBalance, listLoyaltyLedger } from "@/lib/rewards";
import { getReferralConfig } from "@/lib/referrals";
import { UiIcon } from "@/components/ui/ui-icon";
import { pageMeta } from "@/lib/seo";

/**
 * /loyalty — the customer's real Harvest Credit wallet.
 *
 * Every figure on this page is read from the append-only `loyalty_ledger` and
 * the admin-configured programme; nothing is illustrative. A customer with no
 * orders sees a genuine zero balance and an empty ledger, not a sample one.
 */
export const dynamic = "force-dynamic";

/** Tier ladder. Thresholds are annual spend; the rates mirror the programme. */
const TIERS = [
  {
    name: "Seedling",
    floor: 0,
    ceil: 5000,
    range: "₹0 to ₹4,999 / yr",
    rate: "3% back",
    icon: "leaf-bold",
    perks: ["Free shipping over ₹599", "Birthday treat (1 month before)", "Member-only journal"],
  },
  {
    name: "Sapling",
    floor: 5000,
    ceil: 15000,
    range: "₹5,000 to ₹14,999 / yr",
    rate: "5% back",
    icon: "sun-2-bold",
    perks: ["Free shipping always", "Early access to harvests (48h)", "2× referral credit", "Quarterly harvest letter"],
  },
  {
    name: "Banyan",
    floor: 15000,
    ceil: Number.POSITIVE_INFINITY,
    range: "₹15,000+ / yr",
    rate: "8% back",
    icon: "star",
    perks: ["Free express shipping", "Reserved limited-batch lots", "Annual farm visit invite", "Direct line to founders"],
  },
];

/** A ledger reason mapped to human copy + an icon. */
function describeEntry(reason: string, orderId: string | null): { note: string; icon: string } {
  if (reason === "order_earn") {
    return { note: orderId ? "Earned on an order" : "Points earned", icon: "order" };
  }
  if (reason === "order_redeem") return { note: "Redeemed at checkout", icon: "tag-price-bold" };
  return { note: "Adjustment", icon: "customers" };
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const metadata = pageMeta({
  title: "Harvest Coins rewards · Nutri Greenz",
  description:
    "Earn Harvest Coins on every Nutri Greenz order and use them at checkout. See how coins are earned, redeemed and when they expire.",
  path: "/loyalty",
});

export default async function LoyaltyPage() {
  const session = await getCustomerSession();
  const customerId = session?.customerId ?? null;

  const [config, referralConfig, points, ledger] = await Promise.all([
    getLoyaltyConfig(),
    getReferralConfig().catch(() => null),
    customerId ? loyaltyBalance(customerId) : Promise.resolve(0),
    customerId ? listLoyaltyLedger(customerId, 20) : Promise.resolve([]),
  ]);

  // Points → rupees at the live redemption rate.
  const perRupee = config.redeemPointsPerRupee > 0 ? config.redeemPointsPerRupee : 10;
  const toRupees = (p: number) => Math.floor(Math.abs(p) / perRupee);
  const balance = toRupees(points);

  // Spend-equivalent of everything earned, used only to place the tier — derived
  // from the real ledger, never assumed.
  const earnedPoints = ledger
    .filter((e) => e.deltaPoints > 0 && e.reason === "order_earn")
    .reduce((s, e) => s + e.deltaPoints, 0);
  const earnRate = config.earnPointsPerRupee > 0 ? config.earnPointsPerRupee : 1;
  const spend = Math.round(earnedPoints / earnRate);

  const tierIndex = Math.max(
    0,
    TIERS.findIndex((t) => spend >= t.floor && spend < t.ceil),
  );
  const tier = TIERS[tierIndex] ?? TIERS[0];
  const isTop = tierIndex === TIERS.length - 1;
  const nextTier = isTop ? null : TIERS[tierIndex + 1];
  const progress = isTop
    ? 1
    : Math.min(1, Math.max(0, (spend - tier.floor) / (tier.ceil - tier.floor)));
  const toNext = nextTier ? Math.max(0, tier.ceil - spend) : 0;

  const hasActivity = ledger.length > 0;
  // Referrer is rewarded in POINTS; the referee gets a straight discount in paise.
  const referralReward =
    referralConfig && referralConfig.enabled && referralConfig.referrerPoints > 0
      ? toRupees(referralConfig.referrerPoints)
      : null;
  const refereeReward =
    referralConfig && referralConfig.refereeDiscountPaise > 0
      ? Math.round(referralConfig.refereeDiscountPaise / 100)
      : null;

  return (
    <AccountShell active="loyalty">
      <Reveal className="mb-8">
        <span className="ng-eyebrow inline-flex items-center gap-2">
          <Icon name="wallet" size={14} />
          Your wallet
        </span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          ₹{balance.toLocaleString("en-IN")} in <em className="italic text-ng-leaf">harvest credit</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          {hasActivity
            ? `Every order and every referral earns wallet credit you can redeem on anything in the pantry. Up to ${config.maxRedeemPercent}% of an order.`
            : `Place your first order to start earning. Every order and every referral earns wallet credit you can redeem on anything in the pantry. Up to ${config.maxRedeemPercent}% of an order.`}
        </p>
      </Reveal>

      <div>
        {/* Hero: balance + progress ring */}
        <Reveal className="mb-10">
          <div className="relative grid overflow-hidden rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep p-8 text-ng-cream shadow-[var(--shadow-ng-float)] ring-1 ring-ng-clay/20 md:grid-cols-[1.3fr_auto] md:items-center md:gap-8 md:p-10">
            <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-ng-clay/30 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-ng-leaf/20 blur-3xl" />
            <div className="relative">
              <div className="ng-eyebrow text-ng-clay-light">Current balance</div>
              <div className="mt-2 font-display text-[clamp(40px,6vw,64px)] leading-none text-ng-cream tabular-nums">
                ₹{balance.toLocaleString("en-IN")}
              </div>
              <div className="mt-1 text-[13px] text-ng-cream/60 tabular-nums">
                {points.toLocaleString("en-IN")} points · {perRupee} points = ₹1
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/25 px-3 py-1.5 text-[12px] font-semibold text-ng-clay">
                  <Icon name="star" size={14} />
                  {tier.name} member · {tier.rate}
                </span>
                <span className="text-[13px] text-ng-cream/65">
                  {config.expiryMonths > 0
                    ? `Credit expires ${config.expiryMonths} months after earning`
                    : "No expiry · redeem any time"}
                </span>
              </div>
              <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-ng-cream/70">
                {!hasActivity ? (
                  <>Your credit appears here the moment your first order is delivered.</>
                ) : nextTier ? (
                  <>
                    Spend{" "}
                    <span className="font-semibold text-ng-cream tabular-nums">
                      ₹{toNext.toLocaleString("en-IN")}
                    </span>{" "}
                    more this year to reach
                    <span className="font-semibold text-ng-clay"> {nextTier.name}</span> and unlock{" "}
                    {nextTier.rate}.
                  </>
                ) : (
                  <>You&rsquo;re at our highest tier. Thank you for shopping with us.</>
                )}
              </p>
              <Button variant="gold" size="md" className="mt-6" asChild>
                <Link href="/shop">{hasActivity ? "Redeem at checkout →" : "Start shopping →"}</Link>
              </Button>
            </div>

            {/* Progress ring (pure SVG, no libs) */}
            <ProgressRing progress={progress} className="relative mx-auto mt-8 md:mt-0" />
          </div>
        </Reveal>

        {/* Stat strip */}
        <Stagger className="grid items-stretch sm:grid-cols-3 gap-4 mb-12">
          <StaggerItem className="h-full">
            <Tile
              icon="wallet"
              big={`₹${balance.toLocaleString("en-IN")}`}
              small="Current balance"
              tone="forest"
            />
          </StaggerItem>
          <StaggerItem className="h-full">
            <Tile
              icon="star"
              big={tier.name}
              small={`Current tier · ${tier.rate}`}
              tone="clay"
            />
          </StaggerItem>
          <StaggerItem className="h-full">
            <Tile
              icon="graph-up-bold"
              big={`₹${toRupees(earnedPoints).toLocaleString("en-IN")}`}
              small="Earned so far"
              tone="sage"
            />
          </StaggerItem>
        </Stagger>

        {/* Tiers — ladder */}
        <Reveal className="mb-16">
          <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mb-7">
            Three tiers. <em className="italic text-ng-leaf">No tricks.</em>
          </h2>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            {TIERS.map((t) => {
              const featured = t.name === tier.name;
              return (
                <StaggerItem key={t.name}>
                  <article
                    className={
                      featured
                        ? "h-full rounded-3xl border-2 border-ng-clay bg-ng-paper p-7 shadow-[var(--shadow-ng-float)]"
                        : "h-full rounded-3xl border border-ng-line-soft bg-ng-paper p-7"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-2xl ${
                          featured ? "bg-ng-clay/20 text-ng-clay-deep" : "bg-ng-sage/50 text-ng-forest"
                        }`}
                      >
                        <Icon name={t.icon} size={22} />
                      </span>
                      {featured ? (
                        <span className="rounded-full bg-ng-clay/20 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-ng-clay-deep">
                          You&rsquo;re here
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-5 font-display text-[24px] text-ng-forest-deep">{t.name}</h3>
                    <div className="mt-1 text-[13px] text-ng-ink-soft">{t.range}</div>
                    <div className="mt-3 font-display text-[20px] text-ng-forest">{t.rate}</div>
                    <ul className="mt-5 space-y-2.5 text-[14px] text-ng-ink-muted">
                      {t.perks.map((p) => (
                        <li key={p} className="flex gap-2">
                          <UiIcon
                            name="verified"
                            size={15}
                            className={`mt-0.5 shrink-0 ${featured ? "text-ng-clay" : "text-ng-forest"}`}
                          />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Reveal>

        {/* Recent activity */}
        <Reveal>
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7 shadow-[var(--shadow-ng-card)]">
              <h2 className="font-display text-[22px] text-ng-forest-deep mb-5">Recent activity</h2>
              {hasActivity ? (
                <ul className="divide-y divide-ng-line-soft">
                  {ledger.map((tx) => {
                    const credit = tx.deltaPoints > 0;
                    const { note, icon } = describeEntry(tx.reason, tx.orderId);
                    return (
                      <li key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                              credit ? "bg-ng-leaf/15 text-ng-forest" : "bg-ng-terracotta/15 text-ng-terracotta"
                            }`}
                          >
                            <Icon name={icon} size={16} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[14px] text-ng-ink truncate">{note}</div>
                            <div className="text-[12px] text-ng-ink-soft mt-0.5">
                              {fmtDate(tx.createdAt)} · {Math.abs(tx.deltaPoints).toLocaleString("en-IN")} pts
                            </div>
                          </div>
                        </div>
                        <div
                          className={`font-display text-[18px] tabular-nums shrink-0 ${
                            credit ? "text-ng-success" : "text-ng-terracotta"
                          }`}
                        >
                          {credit ? "+" : "−"}₹{toRupees(tx.deltaPoints).toLocaleString("en-IN")}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ng-cream text-ng-forest">
                    <Icon name="wallet" size={24} />
                  </span>
                  <p className="max-w-xs text-[14px] leading-relaxed text-ng-ink-muted">
                    No credit yet. Your first order will show up here with the points it earned.
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-1">
                    <Link href="/shop">Browse the pantry</Link>
                  </Button>
                </div>
              )}
            </div>

            <aside className="rounded-3xl bg-ng-sage/40 border border-ng-line p-7">
              <h3 className="font-display text-[22px] text-ng-forest-deep">How to earn</h3>
              <ul className="mt-5 space-y-4 text-[14px] text-ng-ink-muted">
                <li className="flex gap-3">
                  <Icon name="order" size={20} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span>
                    <span className="block font-display text-[15px] text-ng-forest-deep">
                      Every order
                    </span>
                    Earn {config.earnPointsPerRupee} point{config.earnPointsPerRupee === 1 ? "" : "s"} per ₹1
                    spent, credited once the order is delivered.
                  </span>
                </li>
                {referralReward !== null ? (
                  <li className="flex gap-3">
                    <UiIcon
                      name="customers"
                      size={20}
                      className="mt-0.5 shrink-0 text-ng-forest"
                    />
                    <span>
                      <span className="block font-display text-[15px] text-ng-forest-deep">
                        Refer a friend · ₹{referralReward.toLocaleString("en-IN")}
                      </span>
                      {refereeReward
                        ? `You earn ₹${referralReward}, they get ₹${refereeReward} on their first order.`
                        : `Credited when your friend's first order is delivered.`}
                    </span>
                  </li>
                ) : null}
                <li className="flex gap-3">
                  <UiIcon name="tag" size={20} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span>
                    <span className="block font-display text-[15px] text-ng-forest-deep">
                      Redeem any time
                    </span>
                    Use your credit for up to {config.maxRedeemPercent}% of an order
                    {config.minRedeemPoints > 0
                      ? `, once you have ${config.minRedeemPoints.toLocaleString("en-IN")} points.`
                      : "."}
                  </span>
                </li>
              </ul>
              <Button variant="primary" size="sm" className="mt-6 w-full" asChild>
                <Link href="/referral">Get your referral link</Link>
              </Button>
            </aside>
          </div>
        </Reveal>
      </div>
    </AccountShell>
  );
}

/** Circular progress toward the next tier. */
function ProgressRing({ progress, className }: { progress: number; className?: string }) {
  const R = 62;
  const C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, progress)) * C;
  return (
    <div className={className}>
      <svg width="160" height="160" viewBox="0 0 160 160" className="rotate-[-90deg]">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(245,242,224,0.15)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B5862F" />
            <stop offset="100%" stopColor="#8FCB8F" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none -mt-[104px] mb-[48px] text-center">
        <div className="font-display text-[26px] leading-none text-ng-cream tabular-nums">
          {Math.round(Math.max(0, Math.min(1, progress)) * 100)}%
        </div>
        <div className="mt-1 text-[10.5px] uppercase tracking-wider text-ng-cream/55">this tier</div>
      </div>
    </div>
  );
}

function Tile({
  icon,
  big,
  small,
  tone,
}: {
  icon: string;
  big: string;
  small: string;
  tone: "forest" | "clay" | "sage";
}) {
  const styles =
    tone === "forest"
      ? "bg-ng-forest-deep text-ng-cream"
      : tone === "clay"
        ? "bg-ng-clay/15 text-ng-forest-deep border border-ng-clay/30"
        : "bg-ng-sage/40 text-ng-forest-deep border border-ng-line";
  return (
    <div className={`flex h-full flex-col justify-between rounded-3xl p-6 ${styles}`}>
      <Icon name={icon} size={22} className={tone === "forest" ? "text-ng-clay" : "text-ng-forest"} />
      <div className="mt-6">
        <div className="font-display text-[26px] leading-none tabular-nums">{big}</div>
        <div className={`mt-1.5 text-[12.5px] ${tone === "forest" ? "text-ng-cream/60" : "text-ng-ink-muted"}`}>
          {small}
        </div>
      </div>
    </div>
  );
}
