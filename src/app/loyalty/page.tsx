import Link from "next/link";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";

const TIERS = [
  {
    name: "Seedling",
    range: "0 – ₹4,999 / yr",
    rate: "3% back",
    icon: "leaf-bold",
    perks: ["Free shipping over ₹599", "Birthday treat (1 month before)", "Member-only journal"],
  },
  {
    name: "Sapling",
    range: "₹5,000 – ₹14,999 / yr",
    rate: "5% back",
    icon: "sun-2-bold",
    perks: ["Free shipping always", "Early access to harvests (48h)", "2× referral credit", "Quarterly harvest letter"],
    featured: true,
  },
  {
    name: "Banyan",
    range: "₹15,000+ / yr",
    rate: "8% back",
    icon: "crown-bold",
    perks: ["Free express shipping", "Reserved limited-batch lots", "Annual farm visit invite", "Direct line to founders"],
  },
];

const TRANSACTIONS = [
  { date: "12 May 2026", note: "Order NG-25-1042 · 5% back", amount: 132, icon: "box-bold" },
  { date: "28 Apr 2026", note: "Order NG-25-0981 · 5% back", amount: 71, icon: "box-bold" },
  { date: "14 Apr 2026", note: "Order NG-25-0863 · 5% back", amount: 198, icon: "box-bold" },
  { date: "01 Apr 2026", note: "Referral bonus · Priya K. signed up", amount: 250, icon: "users-group-rounded-bold" },
  { date: "12 Mar 2026", note: "Wallet redeemed at checkout", amount: -300, icon: "tag-price-bold" },
];

// Current-tier progress for the ring + ladder. Sapling: ₹5,000–₹14,999.
const SPENT_THIS_YEAR = 9120;
const TIER_FLOOR = 5000;
const TIER_CEIL = 15000;

export default function LoyaltyPage() {
  const balance = TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
  const progress = Math.min(
    1,
    (SPENT_THIS_YEAR - TIER_FLOOR) / (TIER_CEIL - TIER_FLOOR),
  );
  const toNext = TIER_CEIL - SPENT_THIS_YEAR;

  return (
    <AccountShell active="loyalty">
      <Reveal className="mb-8">
        <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-clay">
          <Icon name="wallet-money-bold" size={14} />
          Your wallet
        </span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          ₹{balance.toLocaleString()} in <em className="italic text-ng-leaf">harvest credit</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          Loyalty here is simple: every order, every referral, every review earns wallet credit you
          can redeem on anything in the pantry. Up to 30% of any order, no expiry.
        </p>
      </Reveal>

      <div>
        {/* Hero: balance + progress ring */}
        <Reveal className="mb-10">
          <div className="relative grid overflow-hidden rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep p-8 text-ng-cream shadow-[var(--shadow-ng-float)] ring-1 ring-ng-clay/20 md:grid-cols-[1.3fr_auto] md:items-center md:gap-8 md:p-10">
            <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-ng-clay/30 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-ng-leaf/20 blur-3xl" />
            <div className="relative">
              <div className="ng-eyebrow text-ng-clay">Current balance</div>
              <div className="mt-2 font-display text-[clamp(40px,6vw,64px)] leading-none text-ng-cream tabular-nums">
                ₹{balance.toLocaleString()}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/25 px-3 py-1.5 text-[12px] font-semibold text-ng-clay">
                  <Icon name="medal-ribbon-star-bold" size={14} />
                  Sapling member · 5% back
                </span>
                <span className="text-[13px] text-ng-cream/65">No expiry · redeem any time</span>
              </div>
              <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-ng-cream/70">
                Spend <span className="font-semibold text-ng-cream tabular-nums">₹{toNext.toLocaleString()}</span> more this year to reach
                <span className="font-semibold text-ng-clay"> Banyan</span> and unlock 8% back.
              </p>
              <Button variant="gold" size="md" className="mt-6" asChild>
                <Link href="/shop">Redeem at checkout →</Link>
              </Button>
            </div>

            {/* Progress ring (pure SVG, no libs) */}
            <ProgressRing progress={progress} className="relative mx-auto mt-8 md:mt-0" />
          </div>
        </Reveal>

        {/* Stat strip */}
        <Stagger className="grid sm:grid-cols-3 gap-4 mb-12">
          <StaggerItem>
            <Tile icon="wallet-money-bold" big={`₹${balance.toLocaleString()}`} small="Current balance" tone="forest" />
          </StaggerItem>
          <StaggerItem>
            <Tile icon="medal-ribbon-star-bold" big="Sapling" small="Current tier · 5% back" tone="clay" />
          </StaggerItem>
          <StaggerItem>
            <Tile icon="graph-up-bold" big="₹3,560" small="Earned this year" tone="sage" />
          </StaggerItem>
        </Stagger>

        {/* Tiers — ladder */}
        <Reveal className="mb-16">
          <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mb-7">Three tiers. <em className="italic text-ng-leaf">No tricks.</em></h2>
          <Stagger className="grid md:grid-cols-3 gap-5 md:items-end">
            {TIERS.map((t) => (
              <StaggerItem key={t.name}>
                <article
                  className={`relative h-full rounded-3xl p-7 transition-all ${
                    t.featured
                      ? "bg-ng-forest-deep text-ng-cream shadow-[var(--shadow-ng-float)] ring-1 ring-ng-clay/25 md:scale-[1.04]"
                      : "ng-float bg-ng-paper text-ng-ink border border-ng-line-soft"
                  }`}
                >
                  {t.featured ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ng-clay text-ng-forest-deep text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full shadow-[0_4px_12px_-4px_rgba(181,134,47,0.6)]">
                      You are here
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <h3 className={`font-display text-[24px] ${t.featured ? "text-ng-cream" : "text-ng-forest-deep"}`}>{t.name}</h3>
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full ${
                        t.featured ? "bg-ng-clay/25 text-ng-clay" : "bg-ng-sage/60 text-ng-forest"
                      }`}
                    >
                      <Icon name={t.icon} size={20} />
                    </span>
                  </div>
                  <p className={`text-[12px] mt-1 ${t.featured ? "text-ng-cream/60" : "text-ng-ink-soft"}`}>{t.range}</p>
                  <div className={`font-display text-[40px] mt-4 leading-none ${t.featured ? "text-ng-clay" : "text-ng-forest"}`}>
                    {t.rate}
                  </div>
                  {t.featured ? (
                    <div className="mt-4">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ng-cream/15">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ng-leaf to-ng-clay"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-[11px] text-ng-cream/60 tabular-nums">
                        {Math.round(progress * 100)}% toward Banyan
                      </div>
                    </div>
                  ) : null}
                  <ul className={`mt-5 space-y-2 text-[13px] ${t.featured ? "text-ng-cream/80" : "text-ng-ink-muted"}`}>
                    {t.perks.map((p) => (
                      <li key={p} className="flex gap-2">
                        <Icon name="check-circle-bold" size={15} className={`mt-0.5 shrink-0 ${t.featured ? "text-ng-clay" : "text-ng-forest"}`} />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        {/* Recent activity */}
        <Reveal>
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7 shadow-[var(--shadow-ng-card)]">
              <h2 className="font-display text-[22px] text-ng-forest-deep mb-5">Recent activity</h2>
              <ul className="divide-y divide-ng-line-soft">
                {TRANSACTIONS.map((tx, i) => {
                  const credit = tx.amount > 0;
                  return (
                    <li key={i} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                            credit ? "bg-ng-leaf/15 text-ng-forest" : "bg-ng-terracotta/15 text-ng-terracotta"
                          }`}
                        >
                          <Icon name={tx.icon} size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[14px] text-ng-ink truncate">{tx.note}</div>
                          <div className="text-[12px] text-ng-ink-soft mt-0.5">{tx.date}</div>
                        </div>
                      </div>
                      <div className={`font-display text-[18px] tabular-nums shrink-0 ${credit ? "text-ng-success" : "text-ng-terracotta"}`}>
                        {credit ? "+" : "−"}₹{Math.abs(tx.amount).toLocaleString()}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <aside className="rounded-3xl bg-ng-sage/40 border border-ng-line p-7">
              <h3 className="font-display text-[22px] text-ng-forest-deep">How to earn faster</h3>
              <ul className="mt-5 space-y-4 text-[14px] text-ng-ink-muted">
                <li className="flex gap-3">
                  <Icon name="users-group-rounded-bold" size={20} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span>
                    <span className="block font-display text-[15px] text-ng-forest-deep">Refer a friend · ₹250</span>
                    You earn ₹250, they get ₹100 off their first order.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Icon name="star-bold" size={20} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span>
                    <span className="block font-display text-[15px] text-ng-forest-deep">Verified reviews · ₹100</span>
                    Every review on a real order earns ₹100 credit.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Icon name="gift-bold" size={20} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span>
                    <span className="block font-display text-[15px] text-ng-forest-deep">Birthday treat · ₹500</span>
                    A month before your birthday, we slip ₹500 into your wallet.
                  </span>
                </li>
              </ul>
              <Button variant="primary" fullWidth className="mt-6" asChild>
                <Link href="/referral">Get your referral link →</Link>
              </Button>
            </aside>
          </div>
        </Reveal>
      </div>
    </AccountShell>
  );
}

/** Pure-SVG progress ring with a gradient stroke — no chart library. */
function ProgressRing({ progress, className }: { progress: number; className?: string }) {
  const size = 188;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);
  return (
    <div className={className}>
      <div className="relative grid place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id="ng-loyalty-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#66BF73" />
              <stop offset="100%" stopColor="#B5862F" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(245,240,228,0.14)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ng-loyalty-ring)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-[34px] leading-none text-ng-cream tabular-nums">{Math.round(progress * 100)}%</div>
            <div className="mt-1 text-[10.5px] uppercase tracking-wider text-ng-cream/55">to Banyan</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, big, small, tone }: { icon: string; big: string; small: string; tone: "forest" | "clay" | "sage" }) {
  const map: Record<string, string> = {
    forest: "bg-ng-forest-deep text-ng-cream",
    clay: "bg-ng-clay/30 text-ng-clay-deep border border-ng-clay/40",
    sage: "bg-ng-sage/60 text-ng-forest-deep border border-ng-line",
  };
  return (
    <div className={`ng-float rounded-2xl p-6 ${map[tone]}`}>
      <Icon name={icon} size={22} className="opacity-80" />
      <div className="font-display text-[36px] leading-none mt-3 tabular-nums">{big}</div>
      <div className="text-[12px] uppercase tracking-wider opacity-70 mt-2.5">{small}</div>
    </div>
  );
}
