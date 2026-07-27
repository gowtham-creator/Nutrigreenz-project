import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Privacy policy — Nutri Greenz",
  description:
    "How Nutri Greenz Farm Technologies Pvt. Ltd collects, uses, discloses and protects your information when you use the Nutrigreenz Platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/privacy"
      title="Privacy policy"
      intro="This Policy describes how we collect, use, disclose and protect your information when you use the Nutrigreenz Platform, and the choices you have over it."
      updated="25 July 2026"
      sections={[
        {
          id: "introduction",
          heading: "Introduction",
          body: (
            <p>
              {
                "This Privacy Policy (“Policy”) describes the policies and procedures on the collection, use, disclosure and protection of your information when you use our website located at "
              }
              <a href="https://www.nutrigreenz.farm">www.nutrigreenz.farm</a>
              {
                ", or the Nutrigreenz mobile application (collectively, the “Nutrigreenz Platform”) made available by "
              }
              <strong>Nutri Greenz Farm Technologies Pvt. Ltd</strong>
              {
                " (“Nutrigreenz”, “Company”, “we”, “us” and “our”), a private company established under the laws of India having its registered office at Plot 209/A, Visweswara Residency, Street No 9, Wester Hills, Addagutta Society, KPHB, Pragathi Nagar Road, Hyderabad, 500085, Telangana, India."
              }
            </p>
          ),
        },
        {
          id: "your-consent",
          heading: "Your consent",
          body: (
            <p>
              {
                "By using the Nutrigreenz Platform and the Services, you agree and consent to the collection, transfer, use, storage, disclosure and sharing of your information as described and collected by us in accordance with this Policy. If you do not agree with the Policy, please do not use, or access the Nutrigreenz Platform."
              }
            </p>
          ),
        },
        {
          id: "cookies",
          heading: "Cookies",
          body: (
            <>
              <p>
                {
                  "Our Nutrigreenz Platform and third parties with whom we partner, may use cookies, pixel tags, web beacons, mobile device IDs, “flash cookies” and similar files or technologies to collect and store information with respect to your use of the Services and third-party websites, including to:"
                }
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"Authenticate users."}</li>
                <li>{"Remember user preferences and settings."}</li>
                <li>{"Determine the popularity of content."}</li>
                <li>{"Deliver and measure the effectiveness of advertising campaigns."}</li>
                <li>
                  {
                    "Analyse site traffic and trends, and generally understand the online behaviours and interests of people who interact with our services."
                  }
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "uses",
          heading: "Uses of your information",
          body: (
            <>
              <p>{"We use your information for the following purposes:"}</p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"To provide, personalise, maintain, and improve our products and services."}</li>
                <li>{"To carry out our obligations arising from any contracts entered between you and us."}</li>
                <li>{"To administer and enhance the security of our Platform."}</li>
                <li>{"To provide you with information about services we consider similar to those you are using."}</li>
                <li>{"To understand our users and improve our Services."}</li>
                <li>{"To generate and review reports and data about our user base."}</li>
                <li>{"To measure the effectiveness of advertising we serve."}</li>
              </ul>
            </>
          ),
        },
        {
          id: "data-security",
          heading: "Data security precautions",
          body: (
            <p>
              {
                "We implement appropriate technical and security measures to protect your information, including using vault and tokenization services from PCI-compliant service providers. However, please be aware that the transmission of information via the internet is not completely secure, and we cannot guarantee the security of your data transmitted through the Nutrigreenz Platform. Once we have received your information, we employ strict safeguards to prevent unauthorized access."
              }
            </p>
          ),
        },
        {
          id: "opt-out",
          heading: "Opt-out",
          body: (
            <>
              <p>
                {
                  "You can manage your email preferences or unsubscribe from emails by following the “unsubscribe” instructions. However, you cannot opt out of receiving certain administrative notices or legal notices."
                }
              </p>
              <p>
                {
                  "If you wish to withdraw your consent for the use and disclosure of your personal information or request the deletion of your data, please write to us at "
                }
                <a href="mailto:customersupport@nutrigreenz.farm">customersupport@nutrigreenz.farm</a>
                {". Your request will take effect within 5 business days."}
              </p>
            </>
          ),
        },
        {
          id: "grievance",
          heading: "Grievance officer & platform security",
          body: (
            <>
              <p>
                {
                  "If you have any queries regarding the processing of your personal information, please email us at "
                }
                <a href="mailto:customersupport@nutrigreenz.farm">customersupport@nutrigreenz.farm</a>
                {" or contact our Grievance Officer at the following address:"}
              </p>
              <p>
                {"Nutrigreenz Grievance Officer"}
                <br />
                {"Plot 209/A, Visweswara Residency,"}
                <br />
                {"Street No 9, Wester Hills, Addagutta Society,"}
                <br />
                {"KPHB, Pragathi Nagar Road, Hyderabad,"}
                <br />
                {"500085, Telangana, India."}
              </p>
              <p>
                {"If you come across any abuse or violation of the Policy, please report it to "}
                <a href="mailto:customersupport@nutrigreenz.farm">customersupport@nutrigreenz.farm</a>
                {"."}
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
