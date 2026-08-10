import { requireApiPermission } from "@/lib/admin-api-guard";
import { getProduct } from "@/lib/catalog";
import { galleryPanelsFor, nutritionBySizeFor, NUTRITION_LABEL } from "@/components/ng/pdp/product-gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/products/[id]/pdp-images
 *
 * What the product page will ACTUALLY show, in order, with the origin of every
 * slide.
 *
 * ── Why this endpoint exists ──────────────────────────────────────────────
 *
 * The admin product form edits `gallery`, and that column is only one of the
 * sources the PDP draws from. The page composes:
 *
 *     lead image  →  operator gallery  →  generated panels  →  size nutrition
 *
 * where the generated panels come from a manifest in the codebase, not the
 * database. An operator editing the form therefore sees a fraction of the real
 * gallery and has no way to tell that a path they just added is already being
 * supplied by the manifest — which duplicates that slide on the live page. That
 * is not hypothetical: the groundnut page ran with roughly twenty images and
 * every panel doubled, and it was invisible from the admin.
 *
 * Reporting the composed list, tagged by source, makes the duplicate obvious
 * before it ships and shows which slides cannot be edited here at all.
 */

/** Where a slide came from, which decides whether the admin can change it. */
type Source = "lead" | "operator" | "generated" | "nutrition";

interface Slide {
  src: string;
  label: string;
  source: Source;
  /** False for generated slides — those live in the manifest, not the database. */
  editable: boolean;
  /** Set when this exact path is supplied more than once. */
  duplicateOf?: Source;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;

  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const slides: Slide[] = [];
  const seen = new Map<string, Source>();

  const push = (src: string, label: string, source: Source, editable: boolean) => {
    if (!src) return;
    const prior = seen.get(src);
    slides.push({ src, label, source, editable, ...(prior ? { duplicateOf: prior } : {}) });
    if (!prior) seen.set(src, source);
  };

  const lead = product.imageUrl ?? null;
  if (lead) push(lead, "Front of pack", "lead", true);

  /*
   * The page drops any gallery entry equal to the lead image, so this mirrors
   * that — otherwise the admin would report a slide the shopper never sees.
   */
  for (const src of product.gallery ?? []) {
    if (src && src !== lead) push(src, "Operator photo", "operator", true);
  }

  /*
   * Generated panels are matched on the SKU slug. The page also drops the
   * manifest's own front-of-pack when a real lead image exists, so that is
   * mirrored here rather than reported as a slide that will not render.
   */
  const panels = galleryPanelsFor(product.slug, product.name);
  for (const p of panels) {
    if (lead && p.label === "Front of pack") continue;
    const source: Source = p.label === NUTRITION_LABEL ? "nutrition" : "generated";
    push(p.src, p.label, source, false);
  }

  const sizes = nutritionBySizeFor(product.slug);

  return Response.json(
    {
      ok: true,
      product: { id: product.id, name: product.name, slug: product.slug },
      total: slides.length,
      duplicates: slides.filter((s) => s.duplicateOf).length,
      /** Pack sizes with their own nutrition panel; the gallery swaps by size. */
      nutritionSizes: sizes ? Object.keys(sizes) : [],
      slides,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
