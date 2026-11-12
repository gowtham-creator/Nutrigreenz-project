import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { pageMeta } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";
import {
  FREQUENCIES,
  SUBSCRIBER_DISCOUNT_BPS,
  applySubscriberDiscountPaise,
} from "@/lib/subscriptions-core";

export const dynamic = "force-dynamic";

const PERCENT = SUBSCRIBER_DISCOUNT_BPS / 100;

export const metadata: Metadata = pageMeta({
  title: `Subscribe & save ${PERCENT}% · Nutri Greenz`,
  description: `Get your cold-pressed oils, ghee and honey delivered weekly, fortnightly or monthly and save ${PERCENT}% on every delivery. Skip, pause or cancel any time.`,
  path: "/subscriptions",
});

const STEPS = [
  {
    icon: "cart-check-bold",
    title: "Pick your staples",
    body: "Choose any product and size, and how many you go through.",
  },
  {
    icon: "calendar-bold",
    title: "Choose how often",
    body: "Weekly, every 2 weeks or monthly, starting on the day you pick.",
  },
  {
    icon: "wallet-money-bold",
    title: "Pay per delivery",
    body: "We remind you 2 days before each delivery. Pay online or cash on delivery. Nothing is charged automatically.",
  },
] as const;

const PERKS = [
  { icon: "bill-check-bold", title: `${PERCENT}% off, every time`, body: "The subscriber price applies on top of any running sale." },
  { icon: "refresh-bold", title: "Skip, pause or cancel", body: "From your account, in one tap. No calls, no fees." },
  { icon: "box-bold", title: "Never run out", body: "Fresh batches pressed and packed for your delivery date." },
] as const;

const FAQ = [
  {
    q: "Will I be charged automatically?",
    a: "No. Each delivery is paid separately. We email you two days before; if you don't pay, that delivery is simply skipped.",
  },
  {
    q: "Can I change the quantity or frequency later?",
    a: "Yes. Open Account → Subscriptions and edit it any time. Changes apply from the next delivery.",
  },
  {
    q: "What if I'm travelling?",
    a: "Skip the next delivery, or pause for 2 weeks, a month, 2 months or until you resume.",
  },
  {
    q: "Is cash on delivery available?",
    a: "Yes. Choose cash on delivery when you subscribe and we place each order for you automatically.",
  },
] as const;

export default async function SubscriptionsLandingPage() {
  if (!(await isFeatureEnabled("subscriptions"))) notFound();
  const { products } = await getStorefrontCatalog();
  const subscribable = products.filter((p) => (p.variants?.length ?? 0) > 0);

  return (
    <PageShell>
      {/* Hero */}
      <Section className="!pb-10">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
            <Icon name="refresh-bold" size={14} />
            Subscribe &amp; save
          </span>
          <h1 className="mt-4 font-display text-[clamp(34px,5.5vw,60px)] leading-[1.05] text-ng-forest-deep">
            Your kitchen staples, on repeat.
            <br />
            <em className="italic text-ng-leaf">{PERCENT}% off every delivery.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ng-ink-muted">
            Cold-pressed oils, ghee and honey delivered {FREQUENCIES.map((f) => f.short.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " or $1")}.
            Pay per delivery, never automatically. Skip, pause or cancel whenever you like.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="#products">
                <Icon name="refresh-bold" size={18} />
                Choose a product
              </a>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/account/subscriptions">Manage my subscriptions</Link>
            </Button>
          </div>
        </Reveal>
      </Section>

      {/* How it works */}
      <Section className="!pt-0 !pb-12">
        <Stagger className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title}>
              <div className="h-full rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ng-cream text-ng-forest-deep">
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ng-ink-soft">Step {i + 1}</span>
                </div>
                <h2 className="mt-4 font-display text-[21px] text-ng-forest-deep">{s.title}</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ng-ink-muted">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* Products */}
      <Section
        id="products"
        className="!pt-4"
        eyebrow="Subscribe to"
        heading="Pick what you use every month"
        description={`Prices shown are subscriber prices, ${PERCENT}% below the one-time price.`}
      >
        {subscribable.length === 0 ? (
          <p className="text-[15px] text-ng-ink-muted">Products will appear here shortly.</p>
        ) : (
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {subscribable.map((p) => {
              const fromPaise = Math.round(p.price * 100);
              const subPaise = applySubscriberDiscountPaise(fromPaise, SUBSCRIBER_DISCOUNT_BPS);
              const fmt = (paise: number) =>
                `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
              return (
                <StaggerItem key={p.id}>
                  <Link
                    href={`/subscribe?product=${encodeURIComponent(p.slug)}`}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper shadow-[var(--shadow-ng-card)] transition-shadow hover:shadow-[var(--shadow-ng-float)]"
                  >
                    <div className="relative aspect-square bg-ng-cream">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.title}
                          fill
                          sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                      <span className="absolute left-3 top-3 rounded-full bg-ng-forest px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ng-cream">
                        Save {PERCENT}%
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <span className="font-display text-[16px] leading-snug text-ng-forest-deep">{p.title}</span>
                      <span className="text-[13px] text-ng-ink-muted">
                        {p.priceFrom ? "from " : ""}
                        <span className="font-semibold text-ng-forest-deep tabular-nums">{fmt(subPaise)}</span>{" "}
                        <span className="line-through tabular-nums">{fmt(fromPaise)}</span>
                      </span>
                      <span className="mt-auto pt-3 text-[13px] font-semibold text-ng-forest transition-colors group-hover:text-ng-forest-deep">
                        Subscribe →
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </Section>

      {/* Perks */}
      <Section className="!pt-0">
        <div className="grid gap-4 rounded-[32px] bg-ng-forest-deep p-6 text-ng-cream sm:p-10 md:grid-cols-3">
          {PERKS.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ng-cream/10 text-ng-cream">
                <Icon name={p.icon} size={22} />
              </span>
              <div>
                <p className="font-display text-[19px]">{p.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ng-cream/75">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section className="!pt-0" eyebrow="Questions" heading="How subscriptions work">
        <div className="mx-auto grid max-w-4xl gap-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-ng-line-soft bg-ng-paper px-5 py-4 open:shadow-[var(--shadow-ng-card)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ng-forest-deep">
                {f.q}
                <span aria-hidden className="text-ng-leaf transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-ng-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
