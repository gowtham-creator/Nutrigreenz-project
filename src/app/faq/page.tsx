import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "FAQs — Nutri Greenz",
  description:
    "Answers to common questions about Nutrigreenz — payments, wallet recharge and autopay, cashback offers and refunds.",
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const GROUPS: { title: string; icon: string; items: QA[] }[] = [
  {
    title: "Payments",
    icon: "bag-4-bold",
    items: [
      {
        q: "What should I do if my payment fails?",
        a: (
          <p>
            {
              "In case of a payment failure, please retry ensuring correct account details, billing address and password (for net banking), and make sure your Internet connection is not disrupted in the process. If your amount has been debited after a payment failure, it is usually rolled back to your source bank account within 7 business days. You can always contact our Customer Care helpdesk with your concern for any clarification further required."
            }
          </p>
        ),
      },
      {
        q: "What payment methods do you accept?",
        a: (
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>{"Credit card"}</li>
            <li>{"Debit card"}</li>
            <li>{"Net banking"}</li>
            <li>{"Wallets — Paytm, Amazon Pay, PayZapp, Freecharge, PhonePe"}</li>
            <li>{"UPI — Google Pay, BHIM"}</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: "Wallet & autopay",
    icon: "scale-bold",
    items: [
      {
        q: "How do I recharge my wallet?",
        a: (
          <ol className="list-decimal pl-5 flex flex-col gap-1.5">
            <li>{"Login to the Nutrigreenz app."}</li>
            <li>{"Select Wallet from the Menu."}</li>
            <li>{"Enter the amount and make payment from the various wallet / UPI / net banking options."}</li>
          </ol>
        ),
      },
      {
        q: "How can I recharge my wallet automatically when my balance goes below Rs.100?",
        a: (
          <ol className="list-decimal pl-5 flex flex-col gap-1.5">
            <li>{"Tap the Wallet icon at the top right of the home screen."}</li>
            <li>{"Select the auto-pay payment option and click Apply."}</li>
            <li>{"Select the preferable payment method."}</li>
            <li>{"After making the payment you’ll receive a payment confirmation screen."}</li>
          </ol>
        ),
      },
      {
        q: "When will autopay be triggered?",
        a: <p>{"Every time your wallet balance reaches Rs 100, the wallet will be loaded automatically."}</p>,
      },
      {
        q: "Where can I edit or delete the autopay configuration?",
        a: (
          <ol className="list-decimal pl-5 flex flex-col gap-1.5">
            <li>{"Login to the Nutrigreenz app."}</li>
            <li>{"Select Account and Preferences from the Menu section."}</li>
            <li>{"Select the top-right three dots to edit or delete the autopay feature."}</li>
          </ol>
        ),
      },
      {
        q: "What happens in case of low funds in my wallet?",
        a: (
          <p>
            {
              "Due to a low wallet balance, your services get stopped. So you have to maintain the balance to continue delivery."
            }
          </p>
        ),
      },
    ],
  },
  {
    title: "Cashback & offers",
    icon: "star-bold",
    items: [
      {
        q: "When will the cashback be credited?",
        a: (
          <p>
            {
              "Cashback is always credited when you recharge your wallet. If you haven’t received it, please wait for 24 hours for it to reflect in your wallet."
            }
          </p>
        ),
      },
      {
        q: "What are the live cashback offers?",
        a: (
          <ol className="list-decimal pl-5 flex flex-col gap-1.5">
            <li>{"Go to Wallet & payment modes from the Menu section in your Nutrigreenz app."}</li>
            <li>{"Select the auto-pay mode (cashback will be provided one time)."}</li>
          </ol>
        ),
      },
    ],
  },
  {
    title: "Refunds",
    icon: "shield-check-bold",
    items: [
      {
        q: "How much time is taken to process a refund?",
        a: (
          <p>
            {"Refunds will be processed within 5-7 working days. See our "}
            <Link href="/policies/refund">cancellation &amp; refund policy</Link>
            {" for full details."}
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
        description="Everything you need to know about payments, your wallet and autopay, cashback offers and refunds. Can't find it here? Our team is a message away."
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
                      className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13.5px] text-ng-ink-muted hover:bg-ng-sage/50 hover:text-ng-forest-deep transition-colors whitespace-nowrap"
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
                    <span className="h-9 w-9 rounded-lg bg-ng-cream inline-flex items-center justify-center text-ng-forest-deep">
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
