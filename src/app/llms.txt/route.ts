import { BRAND, SITE_URL } from "@/lib/seo";
import { CATEGORY_GUIDES } from "@/lib/category-guides";
import { searchName, sizeRange, variantsBySize } from "@/lib/product-seo";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";

/**
 * /llms.txt — the brand, its products and its key pages in plain Markdown.
 *
 * Google has said it does not use this file, but other AI crawlers read it,
 * and it costs one route. It exists mainly to state who Nutri Greenz is, in
 * one place, in words a model can quote: AI answers were mixing the brand up
 * with similarly named microgreens businesses.
 *
 * Products come from the live catalogue, so the file never lists something
 * the shop does not sell. When the catalogue read falls back to samples, the
 * product section is left out rather than filled with them.
 */
export const revalidate = 3600;

const PAGES: [string, string, string][] = [
  ["About Nutri Greenz", "/about", "Who we are, the founders and the company behind the brand"],
  ["Partner farms", "/farms", "The named farms and dairies we buy from"],
  ["Quality lab", "/lab", "What every lot is tested for before it ships"],
  ["Traceability", "/traceability", "How a pack is traced back to its farm and harvest"],
  ["Journal", "/journal", "Articles on cold-pressed oil, ghee, honey and farming"],
  ["FAQ", "/faq", "Orders, delivery, payments and products"],
  ["Contact", "/contact", "Phone, email and office address"],
  ["Shipping policy", "/policies/shipping", "Where and how we deliver"],
];

export async function GET() {
  const catalog = await getStorefrontCatalog().catch(() => null);
  const live = catalog?.live ? catalog : null;

  const lines: string[] = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.summary}`,
    "",
    BRAND.disambiguation,
    "",
    "## Facts",
    "",
    `- Brand: ${BRAND.name} (also written ${BRAND.alternateNames.join(", ")})`,
    `- Company: ${BRAND.legalName}, CIN ${BRAND.cin}`,
    ...(BRAND.fssai ? [`- FSSAI licence: ${BRAND.fssai}`] : []),
    `- Office: ${Object.values(BRAND.address).slice(0, 4).join(", ")}, India`,
    `- Website: ${SITE_URL}`,
    `- Phone: ${BRAND.telephone}`,
    `- Email: ${BRAND.email}`,
    "- Delivery: across Hyderabad, Telangana",
    "",
  ];

  if (live) {
    lines.push("## Products", "");
    for (const c of live.categories) {
      const products = live.products.filter((p) => p.tags?.includes(c.slug));
      if (products.length === 0) continue;
      const guide = CATEGORY_GUIDES[c.slug];
      lines.push(`### [${guide?.h1 ?? c.title}](${SITE_URL}/shop/${c.slug})`, "");
      for (const p of products) {
        const sizes = sizeRange(variantsBySize(p).map((v) => v.label));
        const use = guide?.uses[p.slug];
        const detail = [use, sizes ? `Sizes: ${sizes}.` : ""].filter(Boolean).join(" ");
        lines.push(`- [${searchName(p.title)}](${SITE_URL}/products/${p.slug})${detail ? `: ${detail}` : ""}`);
      }
      lines.push("");
    }
  }

  lines.push("## Guides", "");
  for (const [slug, guide] of Object.entries(CATEGORY_GUIDES)) {
    for (const a of guide.answers) lines.push(`- [${a.question}](${SITE_URL}/shop/${slug}): ${a.answer}`);
  }
  lines.push("", "## Pages", "");
  for (const [name, path, about] of PAGES) lines.push(`- [${name}](${SITE_URL}${path}): ${about}`);

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
