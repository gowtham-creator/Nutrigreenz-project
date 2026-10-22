import { listFarms } from "@/lib/content";
import { TraceabilityView, type TraceFarm } from "./traceability-client";
import { pageMeta } from "@/lib/seo";

// Reads the real farms table (revalidated) so the "partner farm" showcase is a
// live, DB-backed farm rather than a static sample.
export const revalidate = 60;

export const metadata = pageMeta({
  title: "Trace your pack · Nutri Greenz",
  description:
    "Type the lot code from your Nutri Greenz label to see the farm, harvest, pressing and lab results behind it.",
  path: "/traceability",
});

export default async function TraceabilityPage() {
  // listFarms() falls back to the seeded sample content when Supabase is
  // unconfigured or the table is empty, so `farm` is effectively always present.
  const farms = await listFarms();
  const first = farms[0] ?? null;
  const farm: TraceFarm | null = first
    ? {
        id: first.id,
        name: first.name,
        region: first.region,
        hectares: first.hectares,
        partneredSince: first.partneredSince,
        story: first.story,
      }
    : null;

  return <TraceabilityView farm={farm} />;
}
