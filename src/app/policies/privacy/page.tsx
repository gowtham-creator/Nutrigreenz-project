import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Privacy policy — Nutri Greenz",
  description:
    "How Nutri Greenz collects, uses and protects your personal data — accounts, orders, delivery addresses and payments — and the choices you have over it.",
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/privacy"
      title="Privacy policy"
      intro="We collect only what we need to deliver fresh produce to your door and run your account. This page explains what we hold, why, and the control you have over it."
      updated="1 June 2026"
      sections={[
        {
          id: "what-we-collect",
          heading: "What we collect",
          body: (
            <>
              <p>To run your account and fulfil orders, we collect:</p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li><strong>Account details</strong> — your name, mobile number and email.</li>
                <li><strong>Delivery information</strong> — saved addresses, pincode and slot preferences.</li>
                <li><strong>Order history</strong> — what you bought, lot codes delivered, and loyalty activity.</li>
                <li><strong>Payment metadata</strong> — confirmation and reference IDs from our payment partners. We never store your full card or UPI credentials.</li>
                <li><strong>Usage data</strong> — basic device and browsing signals to keep the site fast and secure.</li>
              </ul>
            </>
          ),
        },
        {
          id: "how-we-use",
          heading: "How we use your data",
          body: (
            <>
              <p>We use your information to:</p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>Process and deliver your orders on the slot you chose.</li>
                <li>Operate your loyalty wallet and any referrals.</li>
                <li>Send order, delivery and service updates by SMS and email.</li>
                <li>Provide support and resolve quality claims.</li>
                <li>Keep the platform secure and prevent fraud.</li>
              </ul>
              <p>
                We send marketing only with your consent, and every promotional message includes a
                clear way to opt out. You will always receive transactional messages about an order
                you placed.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          heading: "Who we share it with",
          body: (
            <>
              <p>
                We do not sell your personal data. We share it only with trusted partners who help us
                operate, and only to the extent they need:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li><strong>Payment gateways</strong> (e.g. Razorpay, PhonePe) to process prepaid orders securely.</li>
                <li><strong>Delivery and logistics partners</strong> to bring your box to your door.</li>
                <li><strong>Communication providers</strong> for SMS and email updates.</li>
              </ul>
              <p>
                We may disclose information where required by Indian law or to protect our rights and
                the safety of our customers.
              </p>
            </>
          ),
        },
        {
          id: "your-rights",
          heading: "Your choices & rights",
          body: (
            <>
              <p>You can, at any time:</p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>View and update your profile and addresses from <a href="/account">your account</a>.</li>
                <li>Unsubscribe from marketing while keeping order updates.</li>
                <li>Request a copy of your data, or ask us to correct or delete it.</li>
              </ul>
              <p>
                To exercise any of these, email <a href="mailto:hello@nutrigreenz.in">hello@nutrigreenz.in</a>.
                We respond to verified requests within a reasonable time.
              </p>
            </>
          ),
        },
        {
          id: "security-retention",
          heading: "Security & retention",
          body: (
            <p>
              We protect your data with encryption in transit and access controls, and keep it only as
              long as needed to provide our service and meet legal and tax obligations. See our{" "}
              <a href="/policies/cookies">cookie policy</a> for how we use cookies and similar
              technologies.
            </p>
          ),
        },
      ]}
    />
  );
}
