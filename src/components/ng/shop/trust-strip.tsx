import { Icon } from "@/components/ui/icon";

const PILLARS = [
  {
    icon: "shield-check-bold",
    title: "FSSAI certified",
    note: "Lic. 10024051000987",
  },
  {
    icon: "test-tube-bold",
    title: "Lab-tested every lot",
    note: "Purity report per batch",
  },
  {
    icon: "qr-code-bold",
    title: "Lot-traceable",
    note: "Scan back to the farm",
  },
  {
    icon: "delivery-bold",
    title: "Free delivery ₹599+",
    note: "Cold-chain where needed",
  },
];

/**
 * ShopTrustStrip — editorial band of the four storefront trust pillars.
 * Sits between the hero and the listing on Shop / category pages.
 */
export function ShopTrustStrip() {
  return (
    <div className="border-b border-ng-line-soft bg-ng-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 px-5 sm:grid-cols-2 md:grid-cols-4 md:px-8">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="group flex items-center gap-3 py-5 md:gap-3.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ng-cream text-ng-forest ring-1 ring-ng-line-soft transition-colors duration-300 group-hover:bg-ng-leaf/15 group-hover:text-ng-forest-deep">
              <Icon name={p.icon} size={20} className="text-ng-clay" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight text-ng-forest-deep">
                {p.title}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-tight text-ng-ink-muted">{p.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
