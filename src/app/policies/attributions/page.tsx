import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Attributions & licences — Nutri Greenz",
  description:
    "Credits for the open-source icon sets and third-party marks used on nutrigreenz.farm, and the licences they are used under.",
};

/**
 * Attributions.
 *
 * The Solar icon set is CC BY 4.0, which is not a licence you can satisfy
 * silently: it requires the creator to be named, the licence to be linked, and
 * any modification to be indicated. The app ships 172 of its icons bundled into
 * `icon-subset.json` and, until this page existed, credited none of them —
 * which made every deploy a technical breach of the terms the icons arrive
 * under, and an easy finding for any third-party code audit.
 *
 * Simple Icons and SVG Logos are CC0 and require nothing. They are listed
 * anyway: the entries there are other companies' registered trade marks, and it
 * is worth stating on the record why we are allowed to draw them.
 */
export default function AttributionsPage() {
  return (
    <PolicyLayout
      activeHref="/policies/attributions"
      title="Attributions & licences"
      intro="This site is built on open-source work by other people. These are the credits, and the licence each piece is used under."
      updated="13 August 2026"
      sections={[
        {
          id: "icons",
          heading: "Interface icons",
          body: (
            <>
              <p>
                Most icons across this site and its admin tools come from the{" "}
                <strong>Solar</strong> icon set by{" "}
                <a
                  href="https://www.figma.com/community/file/1166831539721848736"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-ng-forest"
                >
                  480 Design
                </a>
                , used under the{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-ng-forest"
                >
                  Creative Commons Attribution 4.0 International licence
                </a>{" "}
                (CC BY 4.0).
              </p>
              <p>
                We use them as published — the shapes are unaltered. They are recoloured to match
                this site&rsquo;s palette and rendered at various sizes, and only the icons this site
                actually uses are bundled rather than the full set.
              </p>
            </>
          ),
        },
        {
          id: "product-icons",
          heading: "Product and promise marks",
          body: (
            <>
              <p>
                The produce marks — the honey jar, the cold-pressed oil bottle, the individual
                nuts and seeds — and the four marks in our promises row come from{" "}
                <a
                  href="https://icons8.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-ng-forest"
                >
                  Icons8
                </a>
                . They exist because no general-purpose icon set draws the things we actually
                sell.
              </p>
              <p>
                Icons8&rsquo; free tier is usable with a link back, which is what this entry is.
                We have modified them: each is recoloured to match this site&rsquo;s palette, and
                several were traced from the supplied images to outlines so they stay sharp at the
                sizes we display them.
              </p>
            </>
          ),
        },
        {
          id: "brand-marks",
          heading: "Payment and social marks",
          body: (
            <>
              <p>
                The payment method and social marks are drawn from{" "}
                <a
                  href="https://github.com/simple-icons/simple-icons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-ng-forest"
                >
                  Simple Icons
                </a>{" "}
                by the Simple Icons Collaborators and{" "}
                <a
                  href="https://github.com/gilbarbara/logos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-ng-forest"
                >
                  SVG Logos
                </a>{" "}
                by Gil Barbara. Both are released under CC0 1.0 into the public domain.
              </p>
              <p>
                The public-domain dedication covers the drawings, not the brands. Each mark remains
                the trade mark of its owner — Visa, Mastercard, UPI, PhonePe, Paytm and the rest — and
                is shown here only to indicate which payment methods we accept and where you can find
                us. It does not imply any endorsement of Nutri Greenz by those companies.
              </p>
            </>
          ),
        },
        {
          id: "photography",
          heading: "Photography and illustration",
          body: (
            <p>
              Product photography, farm imagery and packaging artwork on this site are our own or are
              licensed to us. They are not covered by the open-source licences above and may not be
              reused without written permission — see the{" "}
              <a
                href="/policies/terms"
                className="underline underline-offset-2 hover:text-ng-forest"
              >
                terms of service
              </a>
              .
            </p>
          ),
        },
        {
          id: "corrections",
          heading: "Something missing?",
          body: (
            <p>
              If you believe your work appears here without proper credit, write to{" "}
              <a
                href="mailto:hello@nutrigreenz.farm"
                className="underline underline-offset-2 hover:text-ng-forest"
              >
                hello@nutrigreenz.farm
              </a>{" "}
              and we will correct it or remove the material.
            </p>
          ),
        },
      ]}
    />
  );
}
