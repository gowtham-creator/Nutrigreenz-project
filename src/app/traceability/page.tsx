import { listFarms } from "@/lib/content";
import { TraceabilityView, type TraceFarm } from "./traceability-client";

// Reads the real farms table (revalidated) so the "partner farm" showcase is a
// live, DB-backed farm rather than a static sample.
export const revalidate = 60;

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
