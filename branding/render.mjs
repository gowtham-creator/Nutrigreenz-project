import { chromium } from "playwright";
const dir = "/Users/gowthamreddy/nutrigreenz project/branding";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("file://" + dir + "/labels/nutrigreenz-labels.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1200); // let webfonts settle
// full sheet
await page.screenshot({ path: `${dir}/previews/sheet-full.png`, fullPage: true });
// each product row
const prods = await page.locator(".product").all();
const names = ["oil", "ghee", "honey"];
for (let i = 0; i < prods.length; i++) {
  await prods[i].screenshot({ path: `${dir}/previews/label-${names[i]}.png` });
}
console.log("rendered", prods.length, "products · errors:", errs.length, errs.slice(0,3).join(" | "));
await b.close();
