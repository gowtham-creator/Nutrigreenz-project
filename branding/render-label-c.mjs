/**
 * Re-render label C (the groundnut front panel) from its source HTML.
 *
 * The shipped preview carried a typo — the net-volume line read "1 Lℎ" because
 * the markup used &#8462; (U+210E PLANCK CONSTANT, a mathematical italic h)
 * after the litre mark. That is fixed in nutrigreenz-labels.html, so the PNG
 * has to be regenerated rather than patched, or the next render brings it back.
 *
 * Shoots the FIRST `.label` in the document — the groundnut front panel — at
 * 3x so the type stays crisp when it is scaled onto a bottle.
 *
 * Run: node branding/render-label-c.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "branding/labels/nutrigreenz-labels.html");
const OUT = path.join(ROOT, "branding/previews/front-oil.png");

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 3 });
await page.goto(pathToFileURL(SRC).href, { waitUntil: "networkidle" });

/*
 * `.keyline` is the die cut guide — a dashed rule showing where the label will
 * be trimmed. It belongs on artwork going to a printer and nowhere near a
 * product photograph, where it reads as a dotted border someone forgot to
 * remove.
 */
await page.addStyleTag({ content: ".keyline{display:none !important}" });

const label = page.locator(".label").first();
await label.waitFor({ state: "visible" });
await label.screenshot({ path: OUT });

await browser.close();
console.log("wrote", path.relative(ROOT, OUT));
