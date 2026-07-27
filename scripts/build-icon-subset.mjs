/**
 * Build an OFFLINE Iconify subset containing only the icons this app actually
 * uses, so the storefront never calls the public Iconify CDN at runtime.
 *
 * Why: `@iconify/react` lazy-fetches icon data from api.iconify.design unless a
 * collection is registered locally. That means a network round-trip before any
 * icon paints, no icons at all on networks that block the CDN, and a
 * third-party request for every visitor. Bundling the whole `solar` set is not
 * an option (6.2 MB), so we extract just what is referenced.
 *
 * Run: `node scripts/build-icon-subset.mjs`
 * Output: src/components/ui/icon-subset.json
 *
 * Re-run this whenever new icons are introduced — the script prints any name it
 * could not resolve so a typo surfaces immediately instead of silently falling
 * back to the network.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/* ── 1. collect every icon name referenced in the codebase ───────────────── */

// Icons arrive two ways: as a JSX prop (`name="bag-4-bold"`) and as plain data
// on config objects (`{ icon: "leaf-bold" }`), which the nav/pillar/section
// arrays use heavily. Both must be captured or icons go missing at runtime.
const PATTERNS = [
  /\bname=["']([a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9-]+)?)["']/g,
  /\bicon:\s*["']([a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9-]+)?)["']/g,
  /\bicon=["']([a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9-]+)?)["']/g,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(p);
  }
  return out;
}

const referenced = new Set();
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) referenced.add(m[1]);
  }
}

/* ── 2. split by collection prefix (bare names are `solar`) ──────────────── */

const byPrefix = new Map();
for (const raw of referenced) {
  const [prefix, name] = raw.includes(":") ? raw.split(":") : ["solar", raw];
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
  byPrefix.get(prefix).add(name);
}

/* ── 3. extract each icon from its installed @iconify-json package ───────── */

const COLLECTIONS = ["solar", "simple-icons", "logos"];
const subsets = [];
const missing = [];

for (const prefix of COLLECTIONS) {
  const wanted = byPrefix.get(prefix);
  if (!wanted || wanted.size === 0) continue;

  let full;
  try {
    full = JSON.parse(
      readFileSync(join(ROOT, "node_modules", `@iconify-json/${prefix}/icons.json`), "utf8"),
    );
  } catch {
    console.warn(`  ! @iconify-json/${prefix} is not installed — skipping`);
    continue;
  }

  const icons = {};
  const aliases = {};
  for (const name of wanted) {
    if (full.icons?.[name]) {
      icons[name] = full.icons[name];
    } else if (full.aliases?.[name]) {
      // Resolve the alias AND carry its parent, or the icon won't render.
      aliases[name] = full.aliases[name];
      const parent = full.aliases[name].parent;
      if (parent && full.icons?.[parent]) icons[parent] = full.icons[parent];
    } else {
      missing.push(`${prefix}:${name}`);
    }
  }

  subsets.push({
    prefix,
    icons,
    ...(Object.keys(aliases).length ? { aliases } : {}),
    width: full.width,
    height: full.height,
    lastModified: full.lastModified,
  });

  console.log(`  ${prefix}: ${Object.keys(icons).length} icons, ${Object.keys(aliases).length} aliases`);
}

/* ── 4. write the bundle ─────────────────────────────────────────────────── */

const OUT = join(SRC, "components/ui/icon-subset.json");
writeFileSync(OUT, JSON.stringify(subsets));
const kb = (statSync(OUT).size / 1024).toFixed(1);

console.log(`\n  wrote ${OUT.replace(ROOT + "/", "")} (${kb} KB)`);
console.log(`  referenced names: ${referenced.size}`);

if (missing.length) {
  console.log(`\n  ⚠ ${missing.length} name(s) not found in any installed collection —`);
  console.log(`    these will still fall back to the Iconify CDN at runtime:`);
  for (const m of missing.sort()) console.log(`      · ${m}`);
  console.log(`    Fix the name, or install the collection that provides it.`);
}
