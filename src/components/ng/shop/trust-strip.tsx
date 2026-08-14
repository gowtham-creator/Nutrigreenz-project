import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { FSSAI_LICENCE, FssaiMark } from "../fssai-mark";

/**
 * ShopTrustStrip — the four storefront guarantees, between the hero and the
 * listing on Shop and category pages.
 *
 * ── Why the icons changed ─────────────────────────────────────────────────
 *
 * The marks were Lucide: a tick-badge for the FSSAI licence, a conical flask
 * for the lab, footprints for traceability, a van for delivery. Three of the
 * four were metaphors for an idea rather than pictures of a thing — footprints
 * in particular asked the reader to decode "trail" before arriving at "you can
 * trace this lot".
 *
 * A licence looks like a certificate. A lot code is scanned off a QR square.
 * Drawn as the object itself, none of them need decoding.
 *
 * ── Why the discs went ────────────────────────────────────────────────────
 *
 * Each mark sat in a cream rounded square, drawn in gold on cream — a pale
 * icon on a pale field, at 20px, inside a container competing with it for
 * attention. Four of those in a row is the shape of a template rather than a
 * statement, which is exactly what it looked like.
 *
 * The marks are bare now, at 26px in forest ink, with hairline rules dividing
 * the four columns so the band reads as one considered strip rather than four
 * floating tiles. Contrast comes from the ink, not from a container.
 *
 * The licence number stays on the FSSAI line: displaying it is a Legal
 * Metrology requirement, not a design choice, so it is not something to trade
 * away for a tidier row.
 */

const PILLARS: { icon: UiIconName | "fssai"; title: string; note: string }[] = [
  {
    /* The real regulator mark, drawn by <FssaiMark> so it cannot be shown
       without the licence number beside it. */
    icon: "fssai",
    title: "FSSAI certified",
    note: FSSAI_LICENCE ? `Lic. ${FSSAI_LICENCE}` : "Licensed food business",
  },
  {
    icon: "flask",
    title: "Lab-tested every lot",
    note: "Purity report per batch",
  },
  {
    icon: "qr",
    title: "Lot-traceable",
    note: "Scan back to the farm",
  },
  {
    icon: "delivery",
    title: "Free delivery ₹599+",
    note: "Cold-chain where needed",
  },
];

export function ShopTrustStrip() {
  return (
    <div className="border-y border-ng-line-soft bg-ng-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-1 px-5 sm:grid-cols-2 md:grid-cols-4 md:px-8">
        {PILLARS.map((p, i) => (
          <div
            key={p.title}
            className={[
              "flex items-center gap-3.5 py-5",
              // Rules between columns only, never on the outer edges, and only
              // once the grid has more than one column to divide.
              i > 0 ? "sm:border-l sm:border-ng-line-soft sm:pl-6" : "",
              i >= 2 ? "sm:border-t md:border-t-0" : "",
              i === 2 ? "sm:border-l-0 md:border-l" : "",
            ].join(" ")}
          >
            {p.icon === "fssai" ? (
              /* showNumber={false}: the number is already the `note` line
                 directly beneath, and printing it twice in one cell would be
                 noise rather than compliance. */
              <FssaiMark height={26} showNumber={false} className="shrink-0" />
            ) : (
              <UiIcon name={p.icon} size={26} className="shrink-0 text-ng-forest" />
            )}
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
