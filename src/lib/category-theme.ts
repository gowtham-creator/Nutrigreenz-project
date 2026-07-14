/**
 * category-theme — a tasteful, per-category storefront palette.
 *
 * Each product category earns its own on-brand look so an Oils page doesn't read
 * like Honey, Ghee, Rice or Spices. The base stays farm/forest (greens + cream);
 * every theme is a *tint + accent* layered over that base, echoing the product's
 * real-life colour (amber honey, buttery ghee, terracotta spice, wheaten rice …).
 *
 * Values are plain CSS strings applied via inline `style` (sanctioned arbitrary
 * values) and lean on the shared `ng-*` tokens (e.g. `var(--ng-cream)`) so the
 * global design tokens stay untouched. Resolution mirrors `getProductStory`:
 * try each key (resolved category id, then the breadcrumb/route slug), first hit
 * wins, and a safe cream/forest `default` catches everything else.
 */

export interface CategoryTheme {
  /** Stable canonical key (category id) — useful for data-attributes/debugging. */
  key: string;
  /** Page-level background wash for the PDP + category listing (CSS `background`). */
  bg: string;
  /** Bounded hero overlay wash for the category listing hero (CSS `background`). */
  heroWash: string;
  /** Signature accent colour (hex) — decorative halos, hairlines, glyph, chips. */
  accent: string;
  /** Darker, text-safe accent (hex) for hairlines/labels on light surfaces. */
  accentDeep: string;
  /** Low-alpha accent wash (rgba) for tinted section bands. */
  soft: string;
  /** Accent halo (rgba) for gallery glows + placeholder halos. */
  halo: string;
  /** Background gradient (CSS) for empty <PhotoPlaceholder> stages. */
  placeholderBg: string;
}

/** The raw palette seed for a category; `bg`/`heroWash` are derived from it. */
interface Seed {
  accent: string;
  accentDeep: string;
  /** Warm/earthy tint that sits at the top of the page before it fades to cream. */
  tintTop: string;
  halo: string;
  soft: string;
  placeholderBg: string;
}

/**
 * Build a full theme from a seed. The page wash fades the tint back into the
 * base `--ng-cream` within ~620px so tall pages settle onto the farm/forest base
 * instead of a long, garish colour fade; the hero wash is a bounded, richer band.
 */
function build(key: string, s: Seed): CategoryTheme {
  return {
    key,
    accent: s.accent,
    accentDeep: s.accentDeep,
    soft: s.soft,
    halo: s.halo,
    placeholderBg: s.placeholderBg,
    bg: `radial-gradient(1100px 560px at 50% -40px, ${s.halo}, transparent 72%), linear-gradient(180deg, ${s.tintTop} 0px, var(--ng-cream) 620px)`,
    heroWash: `radial-gradient(ellipse 78% 66% at 6% -14%, ${s.halo}, transparent 60%), radial-gradient(ellipse 60% 56% at 100% 4%, ${s.halo}, transparent 64%), linear-gradient(180deg, ${s.tintTop} 0%, ${s.tintTop} 42%, var(--ng-cream) 100%)`,
  };
}

/* Palette seeds — each echoes the category's real produce colour, kept subtle so
 * headings/body keep their contrast. Gold is used only where the produce is
 * genuinely golden (ghee/honey); other categories lean green/earthy/terracotta. */
const SEEDS: Record<string, Seed> = {
  // Oils — warm golden-green (amber/olive over cream).
  oils: {
    accent: "#8F8A2E", accentDeep: "#6E6A22", tintTop: "#F3F0D8",
    halo: "rgba(143,138,46,0.13)", soft: "rgba(143,138,46,0.08)",
    placeholderBg: "linear-gradient(135deg,#F6F4DE 0%,#EFEBCE 60%,#E7E2C0 100%)",
  },
  // Ghee — warm buttery gold.
  ghee: {
    accent: "#C79A3A", accentDeep: "#8A6420", tintTop: "#FAF3DA",
    halo: "rgba(199,154,58,0.15)", soft: "rgba(199,154,58,0.09)",
    placeholderBg: "linear-gradient(135deg,#FCF6DF 0%,#F5ECCB 60%,#EFE3B8 100%)",
  },
  // Honey — deep amber / warm gold.
  honey: {
    accent: "#DE9327", accentDeep: "#B0741A", tintTop: "#FBF1D3",
    halo: "rgba(222,147,39,0.16)", soft: "rgba(222,147,39,0.10)",
    placeholderBg: "linear-gradient(135deg,#FDF4D6 0%,#F8E9BE 60%,#F2DDA6 100%)",
  },
  // Rice — soft wheat / cream.
  rice: {
    accent: "#C2A867", accentDeep: "#98814A", tintTop: "#F8F4DF",
    halo: "rgba(194,168,103,0.13)", soft: "rgba(194,168,103,0.08)",
    placeholderBg: "linear-gradient(135deg,#FAF6E3 0%,#F2ECD3 60%,#EAE2C1 100%)",
  },
  // Spices — warm terracotta / paprika.
  spices: {
    accent: "#C24A2E", accentDeep: "#993A22", tintTop: "#F8EBDF",
    halo: "rgba(194,74,46,0.13)", soft: "rgba(194,74,46,0.085)",
    placeholderBg: "linear-gradient(135deg,#FAEEE2 0%,#F2DBC9 60%,#EAC9B2 100%)",
  },
  // Millets & grains — earthy oat/grain.
  millets: {
    accent: "#A98A4E", accentDeep: "#846A3A", tintTop: "#F5F1DE",
    halo: "rgba(169,138,78,0.12)", soft: "rgba(169,138,78,0.08)",
    placeholderBg: "linear-gradient(135deg,#F7F3E0 0%,#EFE9D0 60%,#E6DDBE 100%)",
  },
  // Pulses & dals — deeper earthy soil.
  pulses: {
    accent: "#9C6F42", accentDeep: "#7A5730", tintTop: "#F5EFDD",
    halo: "rgba(156,111,66,0.12)", soft: "rgba(156,111,66,0.08)",
    placeholderBg: "linear-gradient(135deg,#F6F1DD 0%,#EEE4CC 60%,#E4D6B8 100%)",
  },
  // Stone-ground flours — pale oat/wheat.
  flours: {
    accent: "#BBA476", accentDeep: "#8F7A50", tintTop: "#F7F3E2",
    halo: "rgba(187,164,118,0.12)", soft: "rgba(187,164,118,0.08)",
    placeholderBg: "linear-gradient(135deg,#F9F5E6 0%,#F1EBD6 60%,#E8DFC6 100%)",
  },
  // Superfoods — fresh leaf-green (moringa/spirulina).
  superfoods: {
    accent: "#4E9A5A", accentDeep: "#3A7845", tintTop: "#EEF4E4",
    halo: "rgba(78,154,90,0.14)", soft: "rgba(78,154,90,0.09)",
    placeholderBg: "linear-gradient(135deg,#F0F5E6 0%,#E3EDD5 60%,#D6E4C4 100%)",
  },
  // Seasonal fruits — warm orchard/mango blush.
  fruits: {
    accent: "#DB7A3C", accentDeep: "#AE5D28", tintTop: "#FBEFDD",
    halo: "rgba(219,122,60,0.14)", soft: "rgba(219,122,60,0.09)",
    placeholderBg: "linear-gradient(135deg,#FDF2E1 0%,#F7E3CB 60%,#F0D3B2 100%)",
  },
  // Gifting hampers — refined forest/sage with a whisper of green.
  gifting: {
    accent: "#3E7A52", accentDeep: "#2C5C3C", tintTop: "#EEF3E7",
    halo: "rgba(62,122,82,0.13)", soft: "rgba(62,122,82,0.08)",
    placeholderBg: "linear-gradient(135deg,#F1F4EA 0%,#E4EBDB 60%,#D8E2CC 100%)",
  },
  // Safe fallback — the site's existing cream/forest look.
  default: {
    accent: "#66BF73", accentDeep: "#1F4D2E", tintTop: "#F4F6EC",
    halo: "rgba(102,191,115,0.12)", soft: "rgba(178,199,178,0.15)",
    placeholderBg: "linear-gradient(135deg,#F5F2E0 0%,#F5F2E0 40%,#ECE7D2 100%)",
  },
};

/** Canonical theme registry, keyed by category id (+ `default`). */
const THEMES: Record<string, CategoryTheme> = Object.fromEntries(
  Object.entries(SEEDS).map(([key, seed]): [string, CategoryTheme] => [key, build(key, seed)]),
);

/**
 * Map the various slug/tag spellings the storefront may pass (singular product
 * tags, live-catalog aliases) onto a canonical theme key. Keys the PDP/category
 * pages already pass (`oils`, `ghee`, …) fall through unchanged.
 */
const ALIASES: Record<string, string> = {
  oil: "oils",
  "cold-pressed-oils": "oils",
  millet: "millets",
  grains: "millets",
  "millets-grains": "millets",
  spice: "spices",
  masalas: "spices",
  superfood: "superfoods",
  pulse: "pulses",
  dals: "pulses",
  flour: "flours",
  fruit: "fruits",
  gifts: "gifting",
};

/**
 * Resolve the theme for a product/category. Tries each provided key in order
 * (e.g. the resolved category id, then the breadcrumb/route slug) and returns
 * the first match, always falling back to the safe cream/forest `default`.
 */
export function getCategoryTheme(...keys: (string | undefined)[]): CategoryTheme {
  for (const raw of keys) {
    if (!raw) continue;
    const k = raw.toLowerCase();
    const theme = THEMES[ALIASES[k] ?? k];
    if (theme) return theme;
  }
  return THEMES.default;
}
