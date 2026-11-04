// Renders devpost/screenshots/*.png from the web preview: npm run screenshots (server must be running on :5173).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "devpost/screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:5173/?test&noframe");
await page.waitForFunction(() => window.lumen);
const shot = async (name, fn) => {
  await page.evaluate(fn);
  await page.evaluate(() => lumen.step(0.05));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("wrote", name);
};
const hub = { r: -33, f: 42, u: 92 };
await shot("01-quiet-idle", () => { lumen.reset(); lumen.lookAt({ r: -36, f: 30, u: 96 }); });
await shot("02-holding-furosemide", () => { lumen.driver.pinchSyringe("S1"); lumen.step(0.4); lumen.lookAt({ r: -36, f: 30, u: 96 }); });
await shot("03-red-port-redirect", (h) => { lumen.driver.pinchPort("B"); lumen.lookAt({ r: -33, f: 42, u: 96 }); });
await shot("04-green-port-push-here", () => { lumen.driver.pinchPort("A"); lumen.lookAt({ r: -33, f: 42, u: 94 }); });
await shot("05-confirmed-log", () => { lumen.driver.pinchPush(); lumen.step(0.4); lumen.lookAt({ r: -40, f: 20, u: 98 }); });
await shot("06-alarm-edge-arrow", () => { lumen.step(4); lumen.lookAt({ r: -27, f: 56, u: 88 }); });
await shot("07-alarm-pump-and-kink", () => { lumen.lookAt({ r: -50, f: 60, u: 112 }); });
await shot("08-morphine-all-green", () => { lumen.driver.pinchResolved(); lumen.step(8); lumen.driver.pinchSyringe("S2"); lumen.step(0.4); lumen.lookAt({ r: -33, f: 42, u: 94 }); });
await shot("09-trace-piv-line", () => { lumen.driver.pinchSyringe("S2"); lumen.driver.pinchPort("D"); lumen.lookAt({ r: -20, f: 85, u: 100 }); });
await shot("10-handoff-line-check", () => { lumen.step(9); lumen.driver.pinchPole(); lumen.step(2.6); lumen.lookAt({ r: -55, f: 70, u: 120 }); });
await browser.close();
