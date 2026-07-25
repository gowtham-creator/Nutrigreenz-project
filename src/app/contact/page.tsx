import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us — Nutri Greenz",
  description:
    "Get in touch with Nutrigreenz Farm Technologies Pvt Ltd. Our team is in Kukatpally, Hyderabad. Email customersupport@nutrigreenz.farm or call +91 94918 93370 — we reply within one business day.",
};

const CHANNELS = [
  {
    icon: "letter-bold",
    title: "Email",
    value: "customersupport@nutrigreenz.farm",
    href: "mailto:customersupport@nutrigreenz.farm",
    note: "For anything — orders, quality, wholesale.",
  },
  {
    icon: "phone-bold",
    title: "Phone & WhatsApp",
    value: "+91 94918 93370",
    href: "tel:+919491893370",
    note: "Mon–Sat, 9 AM – 7 PM IST.",
  },
  {
    icon: "map-point-bold",
    title: "Visit us",
    value: "Kukatpally, Hyderabad",
    href: "https://maps.google.com/?q=Prashanth+Nagar+Kukatpally+Hyderabad+500072",
    note: "Prashanth Nagar, Hyderabad 500072.",
  },
];

const HOURS = [
  { day: "Monday – Friday", time: "9:00 AM – 7:00 PM" },
  { day: "Saturday", time: "9:00 AM – 5:00 PM" },
  { day: "Sunday", time: "Closed (deliveries continue)" },
];

export default function ContactPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            We&rsquo;d love to <em className="italic text-ng-leaf">hear from you.</em>
          </>
        }
        description="Questions about an order, a quality concern, a wholesale enquiry, or just want to say hello? Reach us however suits you — a real person in Hyderabad will get back to you."
      />

      <Section className="!pt-10">
        {/* Channels */}
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.05} className="h-full">
              <a
                href={c.href}
                className="group block h-full rounded-2xl border border-ng-line-soft bg-ng-paper p-7 hover:border-ng-leaf hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-12 w-12 rounded-xl bg-ng-sage/50 inline-flex items-center justify-center text-ng-forest-deep">
                  <Icon name={c.icon} size={24} />
                </div>
                <h2 className="mt-5 text-[13px] uppercase tracking-wider text-ng-ink-muted">{c.title}</h2>
                <p className="mt-1 font-display text-[20px] text-ng-forest-deep group-hover:text-ng-forest">{c.value}</p>
                <p className="mt-2 text-[14px] text-ng-ink-muted">{c.note}</p>
              </a>
            </Reveal>
          ))}
        </div>

        {/* Form + sidebar */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-16 items-start">
          <Reveal className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 md:p-9">
            <h2 className="font-display text-[clamp(24px,3.4vw,34px)] text-ng-forest-deep tracking-tight">
              Send us a message
            </h2>
            <p className="mt-2 mb-7 text-[15px] text-ng-ink-muted">
              Fill this in and we&rsquo;ll reply within one business day.
            </p>
            <ContactForm />
          </Reveal>

          <div className="flex flex-col gap-6">
            <Reveal delay={0.06} className="rounded-3xl bg-ng-forest-deep text-ng-cream p-7">
              <h3 className="font-display text-[20px] text-ng-cream flex items-center gap-2">
                <Icon name="map-point-bold" size={20} className="text-ng-clay" />
                Our address
              </h3>
              <address className="mt-4 not-italic text-[15px] leading-relaxed text-ng-cream/80">
                Nutrigreenz Farm Technologies Pvt Ltd
                <br />
                1st Floor, H.No. 5-35/167, Double Road,
                <br />
                Near Moosapet Y Junction, Prashanth Nagar,
                <br />
                Kukatpally, Hyderabad, Telangana 500072
              </address>
              <a
                href="https://maps.google.com/?q=Prashanth+Nagar+Kukatpally+Hyderabad+500072"
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-ng-clay hover:text-ng-cream transition-colors"
              >
                Open in Maps
                <Icon name="arrow-right-up-linear" size={15} />
              </a>
            </Reveal>

            <Reveal delay={0.12} className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7">
              <h3 className="font-display text-[20px] text-ng-forest-deep flex items-center gap-2">
                <Icon name="clock-circle-bold" size={20} className="text-ng-forest" />
                Support hours
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {HOURS.map((h) => (
                  <li key={h.day} className="flex justify-between gap-4 text-[14.5px]">
                    <span className="text-ng-ink-muted">{h.day}</span>
                    <span className="text-ng-ink font-medium text-right">{h.time}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-ng-ink-soft">
                Looking for a quick answer? Try the{" "}
                <Link href="/faq" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">
                  FAQs
                </Link>{" "}
                or{" "}
                <Link href="/orders/track" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">
                  track your order
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
