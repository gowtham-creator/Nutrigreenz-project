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

/** Product-key → the SKU slug prefixes it covers. */
const SLUG_PREFIXES: Record<string, string[]> = {
  "groundnut-oil": ["cold-pressed-groundnut-oil", "wood-pressed-groundnut-oil", "groundnut-oil"],
  "a2-cow-ghee": ["a2-gir-cow-ghee", "a2-desi-cow-ghee", "a2-cow-ghee"],
};

/** Pack size parsed off the end of a SKU slug: `…-1l` → `1l`. */
function sizeOf(slug: string): string | null {
  const m = slug.toLowerCase().match(/-(\d+(?:\.\d+)?(?:l|ml|g|kg))$/);
  return m ? m[1] : null;
}

function productKeyFor(slug: string): string | null {
  const s = slug.toLowerCase();
  for (const [key, prefixes] of Object.entries(SLUG_PREFIXES)) {
    if (prefixes.some((p) => s.startsWith(p))) return key;
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

  // Nutrition only when a panel exists for THIS pack size.
  const size = sizeOf(slug);
  const nutrition = size ? entry.nutritionBySize[size] : undefined;
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
