import { PageShell, PageHero } from "@/components/ng/page-shell";
import { listFarms } from "@/lib/content";
import { FarmsBrowser } from "@/components/ng/farms-browser";
import { pageMeta } from "@/lib/seo";

export const revalidate = 60;


export const metadata = pageMeta({
  title: "Our partner farms · Nutri Greenz",
  description:
    "Meet the farms and farmers who grow Nutri Greenz oils, ghee and honey, with the region, practices and story of each one.",
  path: "/farms",
});

export default async function FarmsPage() {
  // Reads the DB (falls back to the static sample content when unconfigured/empty).
  const farms = await listFarms();

  return (
    <PageShell>
      <PageHero
        tone="forest"
        serifTitle
        image="/images/farms/farms-hero.webp"
        eyebrow="42 partner farms · 7 states"
        title={<>The hands that <em className="italic text-ng-leaf">feed your pantry.</em></>}
        description="We name every farmer we buy from. Each farm is a long-term partnership, with a minimum 3-year contract, soil-health programmes and financing to help it convert to organic."
      />

      <FarmsBrowser farms={farms} />
    </PageShell>
  );
}
