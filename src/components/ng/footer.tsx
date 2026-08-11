import Link from "next/link";
import { Button } from "./button";
import Image from "next/image";
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
      { label: "Cold-Pressed Oils", href: "/shop/oils" },
      { label: "Ghee", href: "/shop/ghee" },
      { label: "Honey", href: "/shop/honey" },
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
      className="relative text-ng-cream pt-14 md:pt-20 pb-56 md:pb-52 overflow-hidden"
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

      {/*
        Photographic farm horizon, anchored to the bottom.

        This replaces the drawn scene, which ran full-strength edge to edge: the
        tree line climbed through the link columns and the sun sat behind the
        FIND US address, so every line of that block read against moving shapes.

        The photograph is chosen for what it does NOT contain — the upper part
        is an almost empty dusk sky, so the columns sit on flat tone rather than
        on detail. It is anchored bottom and faded out at its top edge, letting
        the footer's own gradient own the area behind the text and the image own
        the horizon beneath it.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[62%] select-none"
        style={{
          maskImage: "linear-gradient(180deg, transparent 0%, black 42%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 42%)",
        }}
      >
        <Image
          src="/images/brand/footer-farm.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom"
          quality={80}
        />
      </div>

      {/* readability scrim — a gentle vertical wash from the link-column band
          down through the legal bar, keeping the cream text crisp over the now
          much taller, denser scene without dimming the illustration itself */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,31,18,0.55) 0%, rgba(10,31,18,0.40) 30%, rgba(10,31,18,0.30) 62%, rgba(10,31,18,0.55) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        {/* Top: Harvest Letter — one calm, centered newsletter band */}
        <div className="mb-16 border-b border-ng-cream/15 pb-14 md:pb-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="ng-eyebrow text-ng-clay">Harvest Letter</span>
            <h2 className="mt-4 font-display text-[clamp(28px,4vw,44px)] leading-[1.08] text-ng-cream">
              Born in soil. Built for tomorrow.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-ng-cream/70">
              No middlemen, no mystery — just harvest news, seasonal recipes from our
              partner kitchens, and the occasional member-only offer.
            </p>

            <form className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="email"
                aria-label="Email address"
                placeholder="your@email.com"
                className="h-14 w-full flex-1 rounded-full border border-ng-cream/40 bg-ng-cream px-6 text-[15px] text-ng-forest-deep outline-none transition-colors placeholder:text-ng-forest/45 focus:border-ng-clay focus:ring-2 focus:ring-ng-clay/40"
              />
              <Button variant="gold" size="lg" className="w-full shrink-0 sm:w-auto">
                Subscribe
              </Button>
            </form>

            <p className="mt-4 text-[12px] text-ng-cream/60">
              One letter a month. No spam. Unsubscribe anytime.
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
          <div className="relative">
            {/* Soft local scrim — the sun + tallest tree row of the illustration
                rise highest behind this column, so a gentle contained deepening
                keeps the address perfectly crisp without dimming the scene
                elsewhere. Feathered edges blend into the forest background. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-4 -inset-y-3 rounded-3xl"
              style={{
                background:
                  "radial-gradient(ellipse 104% 96% at 50% 42%, rgba(10,31,18,0.78), rgba(10,31,18,0.46) 62%, transparent 82%)",
              }}
            />
            <div className="relative">
              <h4 className="font-display text-[15px] tracking-wider uppercase text-ng-clay mb-5">
                Find us
              </h4>
              <address className="not-italic text-[14px] text-ng-cream/75 space-y-1 mb-6">
                <p>Nutri Greenz Farm Technologies Pvt. Ltd</p>
                <p>1st Floor, H.No. 5-35/167, Double Road,</p>
                <p>Near Moosapet Y Junction, Prashanth Nagar,</p>
                <p>Kukatpally, Hyderabad, Telangana 500072</p>
                <p>+91 94918 93370</p>
                <p>customersupport@nutrigreenz.farm</p>
              </address>
              <div className="flex flex-wrap gap-3">
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
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[12px] text-ng-cream/70">
          <p>© {new Date().getFullYear()} Nutri Greenz Farm Technologies Pvt. Ltd. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li><Link href="/policies/privacy" className="inline-flex min-h-[44px] items-center hover:text-ng-cream">Privacy</Link></li>
            <li><Link href="/policies/terms" className="inline-flex min-h-[44px] items-center hover:text-ng-cream">Terms</Link></li>
            <li><Link href="/policies/cookies" className="inline-flex min-h-[44px] items-center hover:text-ng-cream">Cookies</Link></li>
            <li><Link href="/sitemap" className="inline-flex min-h-[44px] items-center hover:text-ng-cream">Sitemap</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
