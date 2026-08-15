import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Cookie policy · Nutri Greenz",
  description:
    "How Nutri Greenz uses cookies and similar local storage. To keep you signed in, remember your cart and delivery area, and understand how the site is used.",
};

export default function CookiePolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/cookies"
      title="Cookie policy"
      intro="Cookies and similar browser storage keep you signed in, remember your cart and delivery area, and help us improve the site. Here is what we use and why."
      updated="1 June 2026"
      sections={[
        {
          id: "what-are-cookies",
          heading: "What cookies are",
          body: (
            <p>
              Cookies are small files a website stores in your browser. Alongside them we use{" "}
              <strong>local storage</strong> — for example to remember your chosen delivery area and
              cart between visits. Together we refer to these as &ldquo;cookies&rdquo; on this page.
            </p>
          ),
        },
        {
          id: "types",
          heading: "How we use them",
          body: (
            <>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>
                  <strong>Essential</strong> — keep you signed in, hold your cart, and remember your
                  delivery pincode and onboarding state. The site cannot work properly without these.
                </li>
                <li>
                  <strong>Preferences</strong> — remember choices like your default address and slot so
                  you don&rsquo;t re-enter them each time.
                </li>
                <li>
                  <strong>Analytics</strong> — help us understand which pages and products are useful so
                  we can improve the experience. These are aggregated and never used to identify you
                  personally.
                </li>
              </ul>
              <p>We do not use cookies to sell your data or for cross-site advertising.</p>
            </>
          ),
        },
        {
          id: "managing",
          heading: "Managing cookies",
          body: (
            <>
              <p>
                You can clear or block cookies and local storage from your browser settings at any
                time. Note that disabling essential storage will stop core features. Such as staying
                signed in or keeping items in your cart, from working.
              </p>
              <p>
                For how this fits into the wider picture of the data we hold, see our{" "}
                <a href="/policies/privacy">privacy policy</a>.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
