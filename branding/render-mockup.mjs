import { chromium } from "playwright";
const dir = "/Users/gowthamreddy/nutrigreenz project/branding";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1320, height: 980 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("file://" + dir + "/labels/bottle-mockup.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator(".stage").screenshot({ path: `${dir}/previews/bottle-shelf.png` });
const units = await page.locator(".unit").all();
const names = ["oil", "ghee", "honey"];
for (let i = 0; i < units.length; i++) {
  await units[i].screenshot({ path: `${dir}/previews/mockup-${names[i]}.png` });
}
console.log("mockup rendered · errors:", errs.length, errs.slice(0,2).join(" | "));
await b.close();
