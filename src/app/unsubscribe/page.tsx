import Link from "next/link";
import type { Metadata } from "next";
import { unsubscribeByToken } from "@/lib/marketing-audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe · Nutri Greenz",
  // An unsubscribe confirmation has no business in search results.
  robots: { index: false, follow: false },
};

/**
 * Public unsubscribe landing page.
 *
 * Reached from the footer of every marketing email. Opting out happens on load
 * rather than behind a confirm button: mail clients and corporate scanners
 * pre-fetch links, so a one-click flow is the reliable one, and the cost of an
 * accidental unsubscribe (they resubscribe) is far lower than the cost of an
 * opt-out that silently did not take.
 *
 * An unknown or already-used token shows the same confirmation. Someone probing
 * tokens learns nothing from the response, and a customer clicking an old link
 * from a second device is not told their unsubscribe failed.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (t) await unsubscribeByToken(t);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-ng-sage/40">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ng-forest-deep"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h1 className="font-display text-[26px] leading-tight text-ng-forest-deep">
        You&rsquo;re unsubscribed
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ng-ink-muted">
        We won&rsquo;t send you offers or campaigns any more. You&rsquo;ll still get
        messages about orders you place &mdash; order confirmations, delivery updates
        and invoices &mdash; because those are about a purchase, not marketing.
      </p>
      <p className="mt-3 text-[13px] text-ng-ink-soft">
        Changed your mind? Email us at{" "}
        <a
          href="mailto:nutrigreenzfarm@gmail.com"
          className="font-medium text-ng-forest underline underline-offset-2"
        >
          nutrigreenzfarm@gmail.com
        </a>{" "}
        and we&rsquo;ll switch offers back on.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-ng-forest-deep px-5 py-2.5 text-[13.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest"
      >
        Back to the shop
      </Link>
    </main>
  );
}
