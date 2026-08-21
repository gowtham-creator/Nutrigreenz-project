/** Render the four-face pack artwork. node branding/render-4panel.mjs */
import { chromium } from "playwright";
const dir = process.cwd() + "/branding";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 700 }, deviceScaleFactor: 3 });
const errs = []; p.on("pageerror", e => errs.push(String(e)));
await p.goto("file://" + dir + "/labels/ghee-4panel.html", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.locator(".sheet").screenshot({ path: dir + "/previews/ghee-4panel.png" });
console.log("rendered · page errors:", errs.length, errs.slice(0,2).join(" | "));
await b.close();
