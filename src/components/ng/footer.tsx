import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "./button";
import { FooterScene } from "./footer-scene";
import { Icon } from "@/components/ui/icon";

const SOCIALS = [
  { name: "instagram", icon: "simple-icons:instagram", label: "Instagram" },
  { name: "facebook", icon: "simple-icons:facebook", label: "Facebook" },
  { name: "youtube", icon: "simple-icons:youtube", label: "YouTube" },
  { name: "x", icon: "simple-icons:x", label: "X" },
] as const;

const NAV_GROUPS = [
  {
    title: "Shop",
    links: [
      { label: "All produce", href: "/shop" },
      { label: "Cold-pressed oils", href: "/shop/oils" },
      { label: "A2 Ghee", href: "/shop/ghee" },
      { label: "Honey & sweeteners", href: "/shop/honey" },
      { label: "Millets & grains", href: "/shop/millets" },
      { label: "Superfoods", href: "/shop/superfoods" },
      { label: "Gifting hampers", href: "/shop/gifting" },
    ],
  },
  {
    title: "Our story",
    links: [
      { label: "Our partner farms", href: "/farms" },
      { label: "Traceability", href: "/traceability" },
      { label: "Quality lab", href: "/lab" },
      { label: "Journal", href: "/journal" },
      { label: "Press & media", href: "/press" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Track order", href: "/orders/track" },
      { label: "FAQs", href: "/faq" },
      { label: "Shipping & returns", href: "/policies/shipping" },
      { label: "Refund policy", href: "/policies/refund" },
      { label: "Contact us", href: "/contact" },
      { label: "Bulk & corporate", href: "/wholesale" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="relative text-ng-cream pt-14 md:pt-20 pb-44 md:pb-52 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--ng-forest-deep) 0%, var(--ng-forest-deep) 38%, var(--ng-forest) 100%)",
      }}
    >
      {/* decorative wash — softened so it layers gently with the scene */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 18% 6%, rgba(111,170,62,0.30), transparent 60%), radial-gradient(ellipse 45% 40% at 92% 20%, rgba(181,134,47,0.18), transparent 60%)",
        }}
      />

      {/* hand-illustrated tonal farm landscape, anchored to the bottom */}
      <FooterScene />

      {/* readability scrim — a gentle vertical wash from the link-column band
          down through the legal bar, keeping the cream text crisp over the now
          much taller, denser scene without dimming the illustration itself */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-0 h-[60%] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,31,18,0.30) 38%, rgba(10,31,18,0.52) 78%, rgba(10,31,18,0.70) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        {/* Top: newsletter */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 mb-20 pb-16 border-b border-ng-cream/15">
          <div className="space-y-4">
            <Logo variant="wordmark" tone="white" className="h-8" />
            <p className="font-display text-[clamp(28px,3.4vw,42px)] leading-[1.1] text-ng-cream max-w-md">
              No middlemen. No mystery. Real food from real farmers.
            </p>
            <p className="text-[15px] text-ng-cream/70 max-w-md">
              Born in soil. Built for tomorrow. Get harvest news, recipes from our partner kitchens, and member-only offers.
            </p>
          </div>
          <div className="flex flex-col gap-4 justify-end">
            <form className="flex gap-3 items-stretch">
              <input
                type="email"
                aria-label="Email address"
                placeholder="your@email.com"
                className="h-12 flex-1 rounded-xl border border-ng-cream/35 bg-ng-cream/10 px-4 text-[15px] text-ng-cream outline-none transition-colors placeholder:text-ng-cream/60 focus:border-ng-clay focus:bg-ng-cream/15"
              />
              <Button variant="gold" size="md" className="shrink-0">Subscribe</Button>
            </form>
            <p className="text-[12px] text-ng-cream/50">
              We send one letter a month. No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="font-display text-[15px] tracking-wider uppercase text-ng-clay mb-5">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-ng-cream/70 hover:text-ng-cream transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Find us */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-display text-[15px] tracking-wider uppercase text-ng-clay mb-5">
              Find us
            </h4>
            <address className="not-italic text-[14px] text-ng-cream/70 space-y-1 mb-6">
              <p>Nutrigreenz Farm Technologies Pvt. Ltd.</p>
              <p>Plot 7, KPHB Colony, Kukatpally</p>
              <p>Hyderabad, Telangana 500072</p>
              <p>+91 8888 555 411</p>
              <p>hello@nutrigreenz.in</p>
            </address>
            <div className="flex gap-3">
              {SOCIALS.map((s) => (
                <Link
                  key={s.name}
                  href={`https://${s.name}.com/nutrigreenz`}
                  aria-label={s.label}
                  className="h-11 w-11 md:h-9 md:w-9 inline-flex items-center justify-center rounded-full border border-ng-cream/20 hover:border-ng-clay text-ng-cream hover:text-ng-clay transition-colors"
                >
                  <Icon name={s.icon} size={16} label={s.label} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[12px] text-ng-cream/70">
          <p>© {new Date().getFullYear()} Nutrigreenz Farm Pvt. Ltd. — FSSAI 10822005000123</p>
          <ul className="flex gap-6">
            <li><Link href="/policies/privacy" className="hover:text-ng-cream">Privacy</Link></li>
            <li><Link href="/policies/terms" className="hover:text-ng-cream">Terms</Link></li>
            <li><Link href="/policies/cookies" className="hover:text-ng-cream">Cookies</Link></li>
            <li><Link href="/sitemap" className="hover:text-ng-cream">Sitemap</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
