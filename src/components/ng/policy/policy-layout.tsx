import Link from "next/link";
import { type ReactNode } from "react";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";

export interface PolicySection {
  /** Stable id used for the in-page anchor + nav link. */
  id: string;
  heading: string;
  body: ReactNode;
}

const POLICY_NAV = [
  { href: "/policies/shipping", label: "Shipping & delivery" },
  { href: "/policies/refund", label: "Cancellation & refunds" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms of service" },
  { href: "/policies/cookies", label: "Cookies" },
  { href: "/policies/attributions", label: "Attributions" },
] as const;

/**
 * Shared chrome for every /policies/* page. Renders the storefront PageShell,
 * a forest hero, a sticky policy switcher, and a readable single-column body
 * built from a list of {@link PolicySection}s.
 */
export function PolicyLayout({
  activeHref,
  eyebrow = "Policies",
  title,
  intro,
  updated,
  sections,
}: {
  activeHref: string;
  eyebrow?: string;
  title: string;
  intro: string;
  /** Human-readable "last updated" line, e.g. "1 June 2026". */
  updated: string;
  sections: PolicySection[];
}) {
  return (
    <PageShell>
      <PageHero tone="forest" eyebrow={eyebrow} title={title} description={intro}>
        <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-ng-cream/60">
          <Icon name="calendar-minimalistic-bold" size={15} />
          Last updated · {updated}
        </p>
      </PageHero>

      <Section>
        <div className="grid lg:grid-cols-[230px_1fr] gap-12 lg:gap-16">
          {/* Sticky policy switcher */}
          <aside className="lg:sticky lg:top-24 self-start">
            <nav aria-label="Policies" className="rounded-2xl border border-ng-line-soft bg-ng-paper p-2">
              <ul className="flex lg:flex-col gap-1 overflow-x-auto">
                {POLICY_NAV.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.href} className="shrink-0">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "block rounded-xl px-4 py-2.5 text-[13.5px] font-semibold bg-ng-forest text-ng-cream"
                            : "block rounded-xl px-4 py-2.5 text-[13.5px] text-ng-ink-muted hover:bg-ng-sage/50 hover:text-ng-forest-deep transition-colors"
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <p className="mt-5 px-1 text-[12.5px] leading-relaxed text-ng-ink-soft">
              Questions about any of this?{" "}
              <Link href="/contact" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">
                Talk to our team
              </Link>
              .
            </p>
          </aside>

          {/* Policy body */}
          <div className="max-w-2xl">
            <div className="flex flex-col gap-12">
              {sections.map((s) => (
                <Reveal key={s.id} as="section" className="scroll-mt-28" y={16}>
                  <div id={s.id}>
                    <h2 className="font-display text-[clamp(22px,3vw,30px)] leading-tight text-ng-forest-deep tracking-tight">
                      {s.heading}
                    </h2>
                    <div className="mt-4 flex flex-col gap-4 text-[15.5px] leading-relaxed text-ng-ink-muted [&_strong]:text-ng-ink [&_strong]:font-semibold [&_a]:text-ng-forest [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-ng-forest-deep">
                      {s.body}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-14 rounded-2xl border border-ng-line-soft bg-ng-cream/60 p-6">
              <p className="text-[14px] leading-relaxed text-ng-ink-muted">
                If you have questions about these policies, write to{" "}
                <strong className="text-ng-ink font-semibold">Nutri Greenz Farm Technologies Pvt. Ltd</strong>,
                1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction, Prashanth Nagar,
                Kukatpally, Hyderabad, Telangana 500072, or email{" "}
                <a
                  href="mailto:customersupport@nutrigreenz.farm"
                  className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep"
                >
                  customersupport@nutrigreenz.farm
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
