import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";

interface Step { label: string; route?: string; tone?: "leaf" | "clay" | "terracotta" | "forest" | "sage" }
interface Flow {
  id: string;
  name: string;
  persona: string;
  successCriteria: string;
  steps: Step[];
}

const FLOWS: Flow[] = [
  {
    id: "F1",
    name: "Discover → first order",
    persona: "First-time visitor",
    successCriteria: "Place an order under 6 min; lot code visible at unboxing.",
    steps: [
      { label: "Home", route: "/", tone: "leaf" },
      { label: "Shop", route: "/shop", tone: "leaf" },
      { label: "Product detail", route: "/products/[slug]", tone: "leaf" },
      { label: "Add to cart", tone: "leaf" },
      { label: "Cart", route: "/cart", tone: "clay" },
      { label: "Auth (guest ok)", route: "/auth", tone: "clay" },
      { label: "Checkout", route: "/checkout", tone: "clay" },
      { label: "Order placed", tone: "forest" },
    ],
  },
  {
    id: "F2",
    name: "Trace a lot (post-purchase)",
    persona: "Member, just received a jar",
    successCriteria: "Show farmer + tests + harvest date in under 8 sec.",
    steps: [
      { label: "Scan QR on label", tone: "leaf" },
      { label: "Land on /traceability", route: "/traceability", tone: "leaf" },
      { label: "Auto-fill lot code", tone: "clay" },
      { label: "Receipt: farmer · pressed · lab", tone: "forest" },
      { label: "Tap “Visit farm”", tone: "forest" },
      { label: "Farm profile", route: "/farms/[id]", tone: "forest" },
    ],
  },
  {
    id: "F3",
    name: "Repeat purchase via subscription",
    persona: "Loyal member, ghee runs out monthly",
    successCriteria: "Subscribe + save 8% with two clicks.",
    steps: [
      { label: "Account", route: "/account", tone: "leaf" },
      { label: "Past orders", route: "/account/orders", tone: "leaf" },
      { label: "Reorder", tone: "clay" },
      { label: "Choose cadence (4w / 6w)", tone: "clay" },
      { label: "Confirm", tone: "forest" },
      { label: "Subscription active", tone: "forest" },
    ],
  },
  {
    id: "F4",
    name: "Refer a friend",
    persona: "Member, browsing in-app",
    successCriteria: "Shareable link + reward credited on first friend's order.",
    steps: [
      { label: "Account", route: "/account", tone: "leaf" },
      { label: "Referral page", route: "/referral", tone: "leaf" },
      { label: "Copy code + share", tone: "clay" },
      { label: "Friend lands on /shop", tone: "sage" },
      { label: "Friend orders", tone: "forest" },
      { label: "₹250 credit lands in wallet", tone: "forest" },
    ],
  },
  {
    id: "F5",
    name: "Community bundle group buy",
    persona: "Apartment captain organising a bulk order",
    successCriteria: "8 households commit + checkout in 24h window.",
    steps: [
      { label: "Bundle landing", route: "/community/bundle", tone: "clay" },
      { label: "Open new bundle", tone: "clay" },
      { label: "Add items + min qty", tone: "clay" },
      { label: "Share link to households", tone: "sage" },
      { label: "Members join", tone: "sage" },
      { label: "Captain closes & pays", tone: "forest" },
    ],
  },
  {
    id: "F6",
    name: "Admin · inbound lot intake",
    persona: "Ops team at the depot",
    successCriteria: "New lot tagged, lab requested, inventory live in 12 min.",
    steps: [
      { label: "Admin overview", route: "/admin", tone: "leaf" },
      { label: "Inventory & batches", route: "/admin/inventory", tone: "leaf" },
      { label: "New lot intake", tone: "clay" },
      { label: "Farm + farmer linked", tone: "clay" },
      { label: "Lab order created", tone: "terracotta" },
      { label: "Inventory updated", tone: "forest" },
    ],
  },
  {
    id: "F7",
    name: "Captain · field pickup",
    persona: "Field captain at the farm gate",
    successCriteria: "Sign-off + photo + bag tag in under 4 min per pickup.",
    steps: [
      { label: "Open PWA", route: "/captain", tone: "leaf" },
      { label: "Today's pickups", route: "/captain/pickups", tone: "leaf" },
      { label: "Tap pickup", tone: "clay" },
      { label: "Weigh + photo", tone: "clay" },
      { label: "Farmer signs", tone: "terracotta" },
      { label: "Sync when online", tone: "forest" },
    ],
  },
  {
    id: "F8",
    name: "Admin · pricing change",
    persona: "Category manager",
    successCriteria: "Price update live within 30 sec; lot history preserved.",
    steps: [
      { label: "Catalog", route: "/admin/catalog", tone: "leaf" },
      { label: "Find SKU", tone: "leaf" },
      { label: "New price + reason", tone: "clay" },
      { label: "Approver notified", tone: "terracotta" },
      { label: "Published", tone: "forest" },
    ],
  },
  {
    id: "F9",
    name: "Customer support escalation",
    persona: "Member with damaged delivery",
    successCriteria: "Resolution path opened in chat; replacement dispatched same day.",
    steps: [
      { label: "Order detail", route: "/orders/[id]", tone: "leaf" },
      { label: "Report issue", tone: "clay" },
      { label: "Chat with care", tone: "clay" },
      { label: "Approve replacement", tone: "terracotta" },
      { label: "New shipment scheduled", tone: "forest" },
    ],
  },
  {
    id: "F10",
    name: "Newsletter sign-up + first read",
    persona: "Browser exploring story",
    successCriteria: "Subscribe + read first journal article in same session.",
    steps: [
      { label: "Home / Journal", route: "/", tone: "leaf" },
      { label: "Subscribe form", tone: "clay" },
      { label: "Welcome email", tone: "sage" },
      { label: "Article opened", route: "/journal/[slug]", tone: "forest" },
    ],
  },
  {
    id: "F11",
    name: "Loyalty wallet redemption",
    persona: "Member at checkout",
    successCriteria: "Redeem up to 30% of order value in one step.",
    steps: [
      { label: "Cart", route: "/cart", tone: "leaf" },
      { label: "Apply wallet credit", tone: "clay" },
      { label: "Cap auto-set at 30%", tone: "clay" },
      { label: "Checkout", route: "/checkout", tone: "forest" },
      { label: "Wallet balance updated", tone: "forest" },
    ],
  },
  {
    id: "F12",
    name: "Press / press-kit request",
    persona: "Journalist or partner",
    successCriteria: "Get to the press kit + a contact in under 90 sec.",
    steps: [
      { label: "About / Press", tone: "leaf" },
      { label: "Press kit download", tone: "clay" },
      { label: "Contact PR", tone: "forest" },
    ],
  },
];

const TONE_MAP: Record<string, string> = {
  leaf: "bg-ng-leaf-soft/50 text-ng-forest-deep border-ng-leaf-soft",
  clay: "bg-ng-clay/20 text-ng-clay-deep border-ng-clay/40",
  terracotta: "bg-ng-terracotta/15 text-ng-terracotta border-ng-terracotta/30",
  forest: "bg-ng-forest text-ng-cream border-ng-forest-deep",
  sage: "bg-ng-sage/60 text-ng-forest-deep border-ng-line",
};

export default function FlowMapPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="User journeys · F1 · F12"
        title={<>Twelve flows, <em className="italic text-ng-leaf">one pantry.</em></>}
        description="Every user journey across customer, admin, captain, and community surfaces. Each flow ends in a measurable success criterion."
      />

      <Section>
        <div className="space-y-7">
          {FLOWS.map((f) => (
            <article key={f.id} className="rounded-3xl bg-ng-paper border border-ng-line-soft p-6 md:p-8">
              <header className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-5">
                <span className="font-mono text-[12px] tracking-wider text-ng-clay-deep">{f.id}</span>
                <h2 className="font-display text-[24px] text-ng-forest-deep flex-1">{f.name}</h2>
                <span className="text-[12px] text-ng-ink-soft">Persona: <span className="text-ng-ink-muted">{f.persona}</span></span>
              </header>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {f.steps.map((s, i) => (
                  <div key={`${f.id}-${i}`} className="flex items-center">
                    <div className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium ${TONE_MAP[s.tone ?? "leaf"]}`}>
                      <div className="leading-tight">{s.label}</div>
                      {s.route ? <div className="text-[10px] font-mono opacity-60 mt-0.5">{s.route}</div> : null}
                    </div>
                    {i < f.steps.length - 1 ? (
                      <svg width="16" height="12" viewBox="0 0 16 12" className="mx-1.5 text-ng-ink-soft shrink-0">
                        <path d="M0 6h13M10 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-ng-ink-soft border-t border-ng-line-soft pt-4">
                <span className="uppercase tracking-wider text-ng-forest font-semibold mr-2">Success</span>
                {f.successCriteria}
              </p>
            </article>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
