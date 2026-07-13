import { AccountShell } from "@/components/ng/account/account-shell";
import { Icon } from "@/components/ui/icon";
import { AddressBook } from "@/components/ng/address/address-book";

export const metadata = {
  title: "Saved Addresses — Nutrigreenz",
  description: "Manage your delivery addresses for faster, traceable checkout.",
};

export default function AddressesPage() {
  return (
    <AccountShell active="addresses">
      <div className="mb-8">
        <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
          <Icon name="map-point-bold" size={14} />
          Your account
        </span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          Saved <em className="italic text-ng-leaf">addresses</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          Keep your home, work and other delivery spots ready so checkout takes seconds. Set a
          default for one-tap orders.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <AddressBook />

        <aside className="h-fit rounded-2xl border border-ng-line-soft bg-ng-sage/30 p-6 shadow-[var(--shadow-ng-card)]">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-ng-forest-deep text-ng-cream">
            <Icon name="map-point-bold" size={22} />
          </span>
          <h2 className="font-display text-[20px] leading-tight text-ng-forest-deep">
            Delivery coverage
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ng-ink-muted">
            We currently deliver across Hyderabad, shipping every Tuesday and Friday. Enter a valid
            6-digit pincode to confirm your area is in our cold-chain network.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] text-ng-ink-muted">
            <li className="flex items-start gap-2">
              <Icon name="check-circle-bold" size={15} className="mt-0.5 text-ng-leaf" />
              Free shipping on orders above ₹599
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check-circle-bold" size={15} className="mt-0.5 text-ng-leaf" />
              Live trace codes on every label
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check-circle-bold" size={15} className="mt-0.5 text-ng-leaf" />
              Hyderabad-wide and growing
            </li>
          </ul>
        </aside>
      </div>
    </AccountShell>
  );
}
