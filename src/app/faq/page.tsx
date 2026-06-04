import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "FAQs — Nutri Greenz",
  description:
    "Answers to common questions about Nutri Greenz — orders, delivery slots across Hyderabad, our no-cancellation policy, loyalty, damaged-item returns and lot-code traceability.",
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const GROUPS: { title: string; icon: string; items: QA[] }[] = [
  {
    title: "Orders & payment",
    icon: "bag-4-bold",
    items: [
      {
        q: "How do I place an order?",
        a: (
          <p>
            Sign in with your mobile number, add items to your cart and check out. We&rsquo;re a
            prepaid-first store, so your order is confirmed the moment payment succeeds. You can pay by
            UPI, card or netbanking.
          </p>
        ),
      },
      {
        q: "Is there a minimum order value?",
        a: (
          <p>
            A small minimum applies and is shown in your cart. Spend ₹599 or more and delivery is free;
            below that, a flat delivery fee is shown transparently before you pay.
          </p>
        ),
      },
      {
        q: "Can I change or cancel an order after paying?",
        a: (
          <p>
            No — confirmed orders cannot be cancelled or modified. We start picking and packing fresh
            produce against your slot right away. Please double-check your cart, address and slot
            before paying. See our{" "}
            <Link href="/policies/refund">cancellation &amp; refund policy</Link> for the full detail.
          </p>
        ),
      },
    ],
  },
  {
    title: "Delivery & slots",
    icon: "scooter-bold",
    items: [
      {
        q: "Which areas do you deliver to?",
        a: (
          <p>
            We deliver across Hyderabad and the Greater Hyderabad area — Kukatpally, KPHB, Madhapur,
            Gachibowli, Kondapur, Miyapur, Banjara Hills, Jubilee Hills and most pincodes inside the
            ORR. Enter your pincode in the location bar to confirm we serve you.
          </p>
        ),
      },
      {
        q: "What are the delivery slots?",
        a: (
          <p>
            Two fixed slots: a <strong>morning slot</strong> (7&ndash;11 AM) and an{" "}
            <strong>evening slot</strong> (5&ndash;9 PM). Order before 9 PM for next-day delivery in
            most pincodes. Full detail is in our{" "}
            <Link href="/policies/shipping">shipping policy</Link>.
          </p>
        ),
      },
      {
        q: "How do I track my delivery?",
        a: (
          <p>
            You&rsquo;ll get an SMS and email with a live link once your order is packed. You can also
            follow it from <Link href="/orders/track">Track order</Link> or under{" "}
            <Link href="/orders">your orders</Link>.
          </p>
        ),
      },
    ],
  },
  {
    title: "Returns & quality",
    icon: "shield-check-bold",
    items: [
      {
        q: "What if an item arrives damaged or incorrect?",
        a: (
          <p>
            We refund or replace, free of charge, any item that arrives damaged, spoiled, incorrect or
            missing. Report it within <strong>24 hours of delivery</strong> with a photo and your order
            number to <a href="mailto:hello@nutrigreenz.in">hello@nutrigreenz.in</a> or{" "}
            <a href="tel:+918888555411">+91 8888 555 411</a>.
          </p>
        ),
      },
      {
        q: "Can I return something I simply didn't like?",
        a: (
          <p>
            Because our produce is fresh and food-grade, we can&rsquo;t accept change-of-mind returns.
            Refunds and replacements are limited to damaged, spoiled, incorrect or missing items, as set
            out in our <Link href="/policies/refund">refund policy</Link>.
          </p>
        ),
      },
      {
        q: "How are refunds paid back?",
        a: (
          <p>
            To your original prepaid method (typically 3&ndash;7 business days) or instantly as Nutri
            Greenz wallet credit — your choice.
          </p>
        ),
      },
    ],
  },
  {
    title: "Loyalty & referrals",
    icon: "star-bold",
    items: [
      {
        q: "How does the loyalty programme work?",
        a: (
          <p>
            You earn points on eligible orders that you can redeem on future purchases. Track your
            balance and tier in your <Link href="/loyalty">loyalty wallet</Link>.
          </p>
        ),
      },
      {
        q: "What happens to points if my order is refunded?",
        a: (
          <p>
            Points earned on a refunded amount are reversed; any points you&rsquo;d already redeemed on
            that order are credited back to your balance.
          </p>
        ),
      },
      {
        q: "How do referrals work?",
        a: (
          <p>
            Share your code from the <Link href="/referral">referral page</Link>. When a friend places
            their first order, you both earn a reward. Programme rules apply.
          </p>
        ),
      },
    ],
  },
  {
    title: "Traceability & lot codes",
    icon: "qr-code-bold",
    items: [
      {
        q: "What is a lot code?",
        a: (
          <p>
            A unique code printed on every pack. It links that exact batch to the farm it came from, its
            harvest date and its lab report.
          </p>
        ),
      },
      {
        q: "How do I trace my product?",
        a: (
          <p>
            Enter or scan the lot code on our{" "}
            <Link href="/traceability">traceability page</Link> to see the farm, the harvest and the
            full quality report for your batch.
          </p>
        ),
      },
      {
        q: "Is everything really lab-tested?",
        a: (
          <p>
            Yes — 100% of lots are screened for pesticide residue, aflatoxin, heavy metals and
            adulteration before they ship. If a lot fails, it never reaches you. Read more on our{" "}
            <Link href="/lab">quality lab</Link> page.
          </p>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Help centre"
        title={
          <>
            Questions, <em className="italic text-ng-leaf">answered.</em>
          </>
        }
        description="Everything you need to know about ordering, delivery across Hyderabad, returns and traceability. Can't find it here? Our team is a message away."
      />

      <Section>
        <div className="grid lg:grid-cols-[230px_1fr] gap-12 lg:gap-16">
          {/* Category quick-nav */}
          <aside className="lg:sticky lg:top-24 self-start">
            <nav aria-label="FAQ categories" className="rounded-2xl border border-ng-line-soft bg-ng-paper p-2">
              <ul className="flex lg:flex-col gap-1 overflow-x-auto">
                {GROUPS.map((g) => (
                  <li key={g.title} className="shrink-0">
                    <a
                      href={`#${slug(g.title)}`}
                      className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13.5px] text-ng-ink-muted hover:bg-ng-sage/50 hover:text-ng-forest-deep transition-colors"
                    >
                      <Icon name={g.icon} size={17} className="text-ng-forest" />
                      {g.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Groups */}
          <div className="flex flex-col gap-14">
            {GROUPS.map((g) => (
              <Reveal key={g.title} as="section" y={16}>
                <div id={slug(g.title)} className="scroll-mt-28">
                  <h2 className="flex items-center gap-3 font-display text-[clamp(22px,3vw,30px)] text-ng-forest-deep tracking-tight">
                    <span className="h-9 w-9 rounded-lg bg-ng-sage/50 inline-flex items-center justify-center text-ng-forest-deep">
                      <Icon name={g.icon} size={19} />
                    </span>
                    {g.title}
                  </h2>
                  <div className="mt-5 flex flex-col gap-3">
                    {g.items.map((item) => (
                      <details
                        key={item.q}
                        className="group rounded-2xl border border-ng-line-soft bg-ng-paper px-5 open:bg-ng-cream/40 transition-colors"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 list-none [&::-webkit-details-marker]:hidden">
                          <span className="font-medium text-[15.5px] text-ng-ink">{item.q}</span>
                          <Icon
                            name="alt-arrow-down-linear"
                            size={18}
                            className="text-ng-ink-muted shrink-0 transition-transform duration-300 group-open:rotate-180"
                          />
                        </summary>
                        <div className="pb-5 -mt-1 text-[15px] leading-relaxed text-ng-ink-muted [&_a]:text-ng-forest [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-ng-forest-deep">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Still stuck */}
        <Reveal className="mt-16 rounded-3xl bg-ng-forest-deep text-ng-cream p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-[24px] text-ng-cream">Still have a question?</h2>
            <p className="mt-2 text-[15px] text-ng-cream/70 max-w-md">
              Our Hyderabad support team is happy to help with anything we haven&rsquo;t covered here.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors"
          >
            Contact us
            <Icon name="arrow-right-linear" size={17} />
          </Link>
        </Reveal>
      </Section>
    </PageShell>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
