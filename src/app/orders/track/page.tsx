import Link from "next/link";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Input } from "@/components/ng/input";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";

export const metadata = {
  robots: { index: false, follow: true },
  title: "Track your order · Nutrigreenz",
  description: "Live delivery status for any Nutrigreenz order. By order ID and phone.",
};

const SEE = [
  { icon: "delivery", text: "Real-time delivery progress with carrier ETA" },
  { icon: "qr-code-bold", text: "Lot codes for every item in the order" },
  { icon: "phone-bold", text: "Driver contact in the final-mile window" },
  { icon: "shield-check-bold", text: "One-tap report-issue if something's off" },
];

export default function TrackOrderPage() {
  return (
    <AccountShell active="orders">
      <div className="space-y-8">
        <div>
          <span className="ng-eyebrow inline-flex items-center gap-2">
            <Icon name="map-arrow-square-bold" size={14} />
            No account needed
          </span>
          <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
            Track any <em className="italic text-ng-leaf">Nutrigreenz order.</em>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
            Type the order ID and the phone number you used at checkout. We&apos;ll show you exactly
            where it is.
          </p>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
          <form className="relative space-y-5 overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper p-8 shadow-[var(--shadow-ng-card)]">
            <span aria-hidden className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-ng-leaf/10 blur-2xl" />
            <div className="relative space-y-5">
              <Input label="Order ID" placeholder="NG-25-1042" prefix={<Icon name="hashtag-linear" size={17} />} />
              <Input label="Phone or email used at checkout" placeholder="+91 98xxx xxxxx" prefix={<Icon name="phone-bold" size={17} />} />
              <Button variant="primary" size="lg" fullWidth>
                Track my order →
              </Button>
              <p className="text-center text-[12px] text-ng-ink-soft">
                Lost your order ID?{" "}
                <Link href="/orders" className="text-ng-forest hover:underline">
                  View your order history
                </Link>{" "}
                and we&apos;ll list every order tied to your number.
              </p>
            </div>
          </form>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-ng-line bg-ng-sage/30 p-6">
              <h3 className="flex items-center gap-2 font-display text-[18px] text-ng-forest-deep">
                <Icon name="eye-bold" size={17} className="text-ng-forest" />
                What you&apos;ll see
              </h3>
              <ul className="mt-4 space-y-3 text-[14px] text-ng-ink-muted">
                {SEE.map((s) => (
                  <li key={s.text} className="flex items-start gap-2.5">
                    <Icon name={s.icon} size={17} className="mt-0.5 shrink-0 text-ng-leaf" />
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-ng-forest-deep p-6 text-ng-cream">
              <div className="text-[11px] uppercase tracking-wider text-ng-clay">Need help</div>
              <p className="mt-1 font-display text-[18px] leading-tight">
                Reach our care team. Most replies under 2 hours.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href="tel:+918888555411"
                  className="rounded-xl bg-ng-cream/10 px-4 py-3 text-center text-[13px] transition-colors hover:bg-ng-cream/20"
                >
                  Call us
                </Link>
                <Link
                  href="mailto:care@nutrigreenz.farm"
                  className="rounded-xl bg-ng-clay px-4 py-3 text-center text-[13px] font-semibold text-ng-forest-deep transition-colors hover:bg-ng-clay-deep"
                >
                  Email care
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AccountShell>
  );
}
