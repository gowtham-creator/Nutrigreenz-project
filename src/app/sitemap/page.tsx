import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// A page of links: useful to people and to crawlers following them, but not a
// result anyone searches for. It used to inherit the home page's title and
// description, which made it a duplicate of the home page.
export const metadata: Metadata = {
  ...pageMeta({
    title: "Sitemap · Nutri Greenz",
    description: "Every page on nutrigreenz.farm in one list: the shop, our partner farms, the journal, quality and traceability, help and policies.",
    path: "/sitemap",
  }),
  robots: { index: false, follow: true },
};

interface Node { label: string; href?: string; children?: Node[]; note?: string }

const TREE: Node[] = [
  {
    label: "Customer storefront",
    note: "Public web · headless commerce",
    children: [
      { label: "Home", href: "/" },
      {
        label: "Shop",
        href: "/shop",
        children: [
          { label: "Cold-Pressed Oils", href: "/shop/oils" },
          { label: "Ghee", href: "/shop/ghee" },
          { label: "Honey", href: "/shop/honey" },
        ],
      },
      { label: "Product detail", href: "/products/groundnut-cold-pressed-oil" },
      { label: "Cart", href: "/cart" },
      { label: "Checkout", href: "/checkout" },
      { label: "Sign in / Register", href: "/auth" },
      {
        label: "Account",
        href: "/account",
        children: [
          { label: "Orders", href: "/account/orders" },
          { label: "Subscriptions", href: "/account/subscriptions" },
          { label: "Loyalty wallet", href: "/loyalty" },
          { label: "Referral", href: "/referral" },
        ],
      },
      {
        label: "Trust & story",
        children: [
          { label: "Our farms (42)", href: "/farms" },
          { label: "Traceability scanner", href: "/traceability" },
          { label: "Quality lab", href: "/lab" },
          { label: "Journal", href: "/journal" },
        ],
      },
    ],
  },
  {
    label: "Admin portal",
    note: "Operations · internal only",
    children: [
      { label: "Overview", href: "/admin" },
      { label: "Catalog & pricing", href: "/admin/catalog" },
      { label: "Orders & fulfilment", href: "/admin/orders" },
      { label: "Inventory & batches", href: "/admin/inventory" },
      { label: "Marketing & comms", href: "/admin/marketing" },
      { label: "People & farms", href: "/admin/people" },
      { label: "Config & integrations", href: "/admin/config" },
    ],
  },
  {
    label: "Captain field PWA",
    note: "Mobile-installable · for farm pickup teams",
    children: [
      { label: "Captain dashboard", href: "/captain" },
      { label: "Today's pickups", href: "/captain/pickups" },
      { label: "Lot intake", href: "/captain/intake" },
      { label: "Settlement", href: "/captain/settle" },
    ],
  },
  {
    label: "Community bundle",
    note: "Group buy · 8-12 households at member rates",
    children: [
      { label: "Bundle landing", href: "/community/bundle" },
      { label: "Bundle inventory", href: "/community/bundle/inventory" },
      { label: "Bundle checkout", href: "/community/bundle/checkout" },
    ],
  },
];

const TONE_BY_DEPTH = [
  "bg-ng-forest text-ng-cream",
  "bg-ng-sage/60 text-ng-forest-deep border-ng-line",
  "bg-ng-paper text-ng-ink border-ng-line-soft",
  "bg-ng-cream text-ng-ink-muted border-ng-line-soft",
];

function NodeBlock({ node, depth = 0 }: { node: Node; depth?: number }) {
  const tone = TONE_BY_DEPTH[Math.min(depth, TONE_BY_DEPTH.length - 1)];
  const Inner = (
    <div className={`rounded-2xl px-4 py-3 border ${tone}`}>
      <div className="font-display text-[15px] leading-tight">{node.label}</div>
      {node.note ? <div className="text-[11px] mt-0.5 opacity-70">{node.note}</div> : null}
      {node.href ? <div className="text-[10px] mt-1 font-mono opacity-50">{node.href}</div> : null}
    </div>
  );
  return (
    <li className="relative pl-6 mb-3 last:mb-0">
      <span className="absolute left-0 top-5 h-px w-5 bg-ng-line" />
      {node.href ? <Link href={node.href} className="block hover:opacity-80 transition-opacity">{Inner}</Link> : Inner}
      {node.children?.length ? (
        <ul className="mt-3 ml-3 border-l border-dashed border-ng-line space-y-0">
          {node.children.map((c) => (
            <NodeBlock key={c.label} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function SitemapPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Information architecture"
        title={<>The full <em className="italic text-ng-leaf">Nutri Greenz map.</em></>}
        description="Every route in the system. Storefront, admin, captain PWA, and community bundle. Click any node to jump to that page."
      />

      <Section>
        <div className="grid lg:grid-cols-2 gap-10">
          {TREE.map((root) => (
            <article key={root.label} className="rounded-3xl bg-ng-paper border border-ng-line-soft p-6 md:p-8">
              <ul className="space-y-0">
                <NodeBlock node={root} />
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-ng-sage/30 border border-ng-line p-8">
          <h2 className="font-display text-[28px] text-ng-forest-deep">Notes on the IA</h2>
          <ul className="mt-4 grid md:grid-cols-2 gap-3 text-[14px] text-ng-ink-muted">
            <li>• Customer storefront is rendered statically via Next.js App Router + ISR for product pages.</li>
            <li>• Admin portal lives behind RBAC; only ops + finance + content roles can sign in.</li>
            <li>• Captain PWA is installable on Android. Used by 12 pickup staff across the south.</li>
            <li>• Community bundle is gated by member code. Co-located households unlock 12-15% off list.</li>
          </ul>
        </div>
      </Section>
    </PageShell>
  );
}
