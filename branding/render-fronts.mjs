import { chromium } from "playwright";
const dir = "/Users/gowthamreddy/nutrigreenz project/branding";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 3 });
await page.goto("file://" + dir + "/labels/nutrigreenz-labels.html", { waitUntil: "networkidle" });
// hide print-only guides for a clean sticker
await page.addStyleTag({ content: ".keyline{display:none!important} .label{box-shadow:none!important}" });
await page.waitForTimeout(1000);
const names = ["oil", "ghee", "honey"];
const prods = await page.locator(".product").all();
for (let i = 0; i < prods.length; i++) {
  const front = prods[i].locator(".panel-wrap").first().locator(".label");
  await front.screenshot({ path: `${dir}/previews/front-${names[i]}.png` });
}
console.log("captured fronts:", names.join(", "));
await b.close();
