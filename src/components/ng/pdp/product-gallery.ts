import { GALLERY, type GalleryPanel } from "./gallery-manifest";

/**
 * Resolve the generated gallery panels for one product SKU.
 *
 * The panels are authored per PRODUCT (groundnut oil), while the storefront
 * sells per SKU (`cold-pressed-groundnut-oil-1l`). Most panels — sourcing,
 * comparison, how-to-use — are identical across sizes of the same oil, so they
 * are shared. Nutrition is not: "servings per container" is 65 for a litre and
 * 32 for 500 ml, so the size-matched panel is chosen and a size with no panel
 * gets none rather than a wrong one.
 *
 * Matching is explicit rather than fuzzy. A substring match would eventually
 * hand groundnut panels to a groundnut-and-something blend, and putting one
 * product's artwork on another product's page is the exact defect the PDP
 * gallery was already fixed for once.
 */

/**
 * Product-key → the slug TOKENS that identify it.
 *
 * Token sets, not prefixes. The first version matched on prefixes and silently
 * failed in production: the live slug is `groundnut-cold-pressed-oil` while the
 * prefix list expected `cold-pressed-groundnut-oil` — the same words in a
 * different order — so no panel ever rendered. Matching on the words present
 * survives naming that reorders or drops a qualifier.
 *
 * `not` is what keeps this honest. Buffalo ghee must never inherit the A2 cow
 * ghee panels: those bullets say "A2 desi cow milk", which would be a false
 * claim on a different animal's product.
 */
const SLUG_MATCH: Record<string, { all: string[]; any?: string[]; not?: string[] }> = {
  "groundnut-oil": { all: ["groundnut"], not: ["blend"] },
  "a2-cow-ghee": {
    all: ["ghee"],
    any: ["a2", "gir", "desi"],
    not: ["buffalo"],
  },
};

/** Pack size parsed off a slug: `…-1l` → `1l`. Live slugs often carry none. */
function sizeOf(slug: string): string | null {
  const m = slug.toLowerCase().match(/-(\d+(?:\.\d+)?(?:l|ml|g|kg))$/);
  return m ? m[1] : null;
}

function productKeyFor(slug: string): string | null {
  const tokens = new Set(slug.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  for (const [key, rule] of Object.entries(SLUG_MATCH)) {
    if (!rule.all.every((t) => tokens.has(t))) continue;
    if (rule.any && !rule.any.some((t) => tokens.has(t))) continue;
    if (rule.not?.some((t) => tokens.has(t))) continue;
    return key;
  }
  return null;
}

export interface ResolvedPanel {
  src: string;
  alt: string;
  label: string;
}

/** The nutrition slide's label — Gallery matches on it to swap by size. */
export const NUTRITION_LABEL = "Nutrition facts";

const LABELS: Record<string, string> = {
  hero: "Front of pack",
  ingredient: "What's inside",
  sourcing: "Where it comes from",
  benefits: "Why it's good",
  // Deliberately generic: the oil panel compares cold-pressed against refined,
  // the ghee panel compares bilona against creamery. One fixed label would be
  // wrong on one of them.
  comparison: "How it compares",
  usage: "How to use it",
  nutrition: NUTRITION_LABEL,
};

/**
 * Generated panels for a SKU, in swipe order. Empty when the product has no
 * authored set — the caller then falls back to its own placeholders.
 */
export function galleryPanelsFor(slug: string, title: string): ResolvedPanel[] {
  const key = productKeyFor(slug);
  if (!key) return [];
  const entry = GALLERY[key];
  if (!entry) return [];

  const out: ResolvedPanel[] = entry.panels.map((p: GalleryPanel) => ({
    src: p.src,
    alt: `${title} — ${LABELS[p.name] ?? p.name}`,
    label: LABELS[p.name] ?? p.name,
  }));

  /*
   * Nutrition.
   *
   * When the slug names a size, use that one. Live slugs usually do not —
   * `groundnut-cold-pressed-oil` carries no size, and requiring one meant the
   * nutrition slide was dropped from every real product page. So fall back to
   * the first authored size; the gallery then re-points it to whichever size
   * the shopper actually selects, which is the authoritative step anyway.
   */
  const sizes = Object.keys(entry.nutritionBySize);
  const size = sizeOf(slug);
  const nutrition =
    (size ? entry.nutritionBySize[size] : undefined) ??
    (sizes.length > 0 ? entry.nutritionBySize[sizes[0]] : undefined);

  if (nutrition) {
    out.push({
      src: nutrition,
      alt: `${title} — nutrition facts`,
      label: LABELS.nutrition,
    });
  }

  return out;
}

/** Nutrition panels for a SKU's product, keyed by pack size. */
export function nutritionBySizeFor(slug: string): Record<string, string> | undefined {
  const key = productKeyFor(slug);
  return key ? GALLERY[key]?.nutritionBySize : undefined;
}
