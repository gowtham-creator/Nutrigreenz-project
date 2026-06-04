import Link from "next/link";
import Image from "next/image";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { PRODUCTS } from "@/components/ng/data";

const LINES = [
  { ...PRODUCTS[0]!, qty: 2, podPrice: 568 },
  { ...PRODUCTS[4]!, qty: 1, podPrice: 1340 },
  { ...PRODUCTS[7]!, qty: 1, podPrice: 478 },
];

export default function CommunityBundleCheckout() {
  const subtotal = LINES.reduce((s, l) => s + l.podPrice * l.qty, 0);
  const retailEquivalent = LINES.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0);
  const savings = retailEquivalent - subtotal;

  return (
    <PageShell>
      {/* Pod context strip */}
      <div className="bg-ng-forest-deep text-ng-cream">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-5">
          <Link href="/community/bundle/inventory" className="text-[12px] text-ng-clay hover:underline">← Back to inventory</Link>
          <h1 className="font-display text-[28px] leading-tight mt-2">Confirm your pod order</h1>
          <p className="text-[13px] text-ng-cream/70 mt-1">Madhapur pod · May cycle · pickup 23 May, 17:00–20:00</p>
        </div>
      </div>

      <Section>
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
          {/* Left: Order */}
          <div className="space-y-7">
            {/* Lines */}
            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7">
              <h2 className="font-display text-[18px] text-ng-forest-deep mb-5">Your bag · {LINES.length} items</h2>
              <ul className="divide-y divide-ng-line-soft">
                {LINES.map((l) => (
                  <li key={l.id} className="py-4 flex gap-4 items-center">
                    <div className="relative size-16 rounded-xl overflow-hidden bg-ng-sage shrink-0">
                      <Image src={l.image} alt={l.title} fill className="object-cover" sizes="64px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] truncate">{l.title}</div>
                      <div className="text-[12px] text-ng-ink-soft mt-0.5">{l.unit} · qty {l.qty}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-[16px] text-ng-forest-deep">₹{(l.podPrice * l.qty).toLocaleString()}</div>
                      <div className="text-[11px] text-ng-ink-soft line-through">₹{((l.price ?? 0) * l.qty).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pickup */}
            <div className="rounded-3xl bg-ng-sage/30 border border-ng-line p-7">
              <span className="ng-eyebrow">Pickup point</span>
              <h2 className="font-display text-[22px] text-ng-forest-deep mt-2 leading-tight">
                Captain Sneha's home, Madhapur
              </h2>
              <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed">
                14 Jubilee Hills Road No. 36, Madhapur, Hyderabad 500081. Sneha will message you 24h before pickup with apartment + parking details.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-[12.5px]">
                <Tile label="Cycle closes" value="22 May, 22:00" />
                <Tile label="Pickup window" value="23 May, 17:00–20:00" />
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7">
              <h2 className="font-display text-[18px] text-ng-forest-deep mb-5">Payment</h2>
              <div className="space-y-3">
                {[
                  { label: "UPI · pay now", note: "Razorpay · 0.4% fee", active: true },
                  { label: "Card", note: "Visa, Mastercard, Rupay", active: false },
                  { label: "Wallet credit · ₹251 available", note: "Cap 30% of order", active: false },
                ].map((p) => (
                  <label key={p.label} className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer ${p.active ? "border-ng-forest bg-ng-forest/5" : "border-ng-line-soft bg-ng-cream"}`}>
                    <input type="radio" name="pay" defaultChecked={p.active} className="accent-ng-forest" />
                    <div className="flex-1">
                      <div className="text-[14px] font-medium">{p.label}</div>
                      <div className="text-[11.5px] text-ng-ink-soft mt-0.5">{p.note}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <aside className="lg:sticky lg:top-24 self-start space-y-5">
            <div className="rounded-3xl bg-ng-forest-deep text-ng-cream p-7">
              <div className="text-[10.5px] uppercase tracking-wider text-ng-clay">You're saving</div>
              <div className="font-display text-[44px] text-ng-clay leading-none mt-2">₹{savings.toLocaleString()}</div>
              <p className="text-[12.5px] text-ng-cream/70 mt-3">
                vs ordering individually. Same lot, same farmer. Last-mile cost = 0.
              </p>
            </div>

            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7">
              <h3 className="font-display text-[18px] text-ng-forest-deep mb-4">Summary</h3>
              <dl className="space-y-2.5 text-[13.5px]">
                <Row label="Subtotal (pod price)" value={`₹${subtotal.toLocaleString()}`} />
                <Row label="Pickup" value="Free" />
                <Row label="Captain commission" value="Included" muted />
                <Row label="Taxes" value="Inclusive" muted />
              </dl>
              <div className="mt-5 pt-5 border-t border-ng-line-soft flex justify-between items-baseline">
                <span className="text-[13px] text-ng-ink-soft">Total</span>
                <span className="font-display text-[28px] text-ng-forest-deep">₹{subtotal.toLocaleString()}</span>
              </div>
              <Button variant="primary" fullWidth className="mt-5" asChild>
                <Link href="/account">Place pod order →</Link>
              </Button>
              <p className="text-[11.5px] text-ng-ink-soft text-center mt-3">By placing this order you accept Captain pickup terms.</p>
            </div>
          </aside>
        </div>
      </Section>
    </PageShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ng-cream border border-ng-line-soft px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft">{label}</div>
      <div className="font-display text-[15px] text-ng-forest-deep mt-1">{value}</div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? "text-ng-ink-soft" : "text-ng-ink"}>{label}</dt>
      <dd className={muted ? "text-ng-ink-soft" : "text-ng-ink font-medium"}>{value}</dd>
    </div>
  );
}
