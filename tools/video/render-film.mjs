// Renders tools/video/film (bundled) frame by frame in headless Chromium and encodes the picture track.
//   node tools/video/render-film.mjs                    → $LUMEN_VIDEO/film-picture.mp4
//   node tools/video/render-film.mjs --stills 4,20,45   → PNG stills for review
// Expects in $LUMEN_VIDEO: web/{index.html,film.js,voice.json}, frames/story/*.jpg, frames/leaf/*.jpg
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.LUMEN_VIDEO || path.join(process.env.TEMP || "/tmp", "lumen-video");
const FF = process.env.FFMPEG || "ffmpeg";
const FONTS = path.resolve("node_modules/@fontsource/inter/files");
const args = process.argv.slice(2);
const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
const from = args.includes("--from") ? Number(args[args.indexOf("--from") + 1]) : 0;
const WORKERS = Number(process.env.WORKERS || 4);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".png": "image/png" };

function resolve(url) {
  const p = decodeURIComponent(new URL(url).pathname);
  if (p === "/" || p === "/index.html") return path.join(ROOT, "web", "index.html");
  if (p === "/film.js") return path.join(ROOT, "web", "film.js");
  if (p === "/data/voice.json") return path.join(ROOT, "web", "voice.json");
  if (p.startsWith("/fonts/")) return path.join(FONTS, path.basename(p));
  if (p.startsWith("/story/")) return path.join(ROOT, "frames", "story", path.basename(p));
  if (p.startsWith("/leaf/")) return path.join(ROOT, "frames", "leaf", path.basename(p));
  return null;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-web-security"] });
async function openFilm() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.route("http://film.local/**", async (route) => {
    const f = resolve(route.request().url());
    if (!f || !fs.existsSync(f)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream" } });
  });
  await page.goto("http://film.local/index.html");
  await page.waitForFunction(() => window.film);
  await page.evaluate(() => window.film.init());
  return page;
}

if (stills) {
  const page = await openFilm();
  fs.mkdirSync(path.join(ROOT, "stills"), { recursive: true });
  for (const t of stills) {
    await page.evaluate((t) => window.film.seek(t), t);
    await page.screenshot({ path: path.join(ROOT, "stills", `s${String(t).replace(".", "_")}.png`) });
  }
  console.log("stills in", path.join(ROOT, "stills"));
  await browser.close();
  process.exit(0);
}

const probe = await openFilm();
const { duration, fps, timeline } = await probe.evaluate(() => {
  const ids = Array.from({ length: 28 }, (_, i) => "v" + String(i + 1).padStart(2, "0"));
  return { duration: window.film.duration, fps: window.film.fps,
    timeline: { duration: window.film.duration, demo0: window.film.demo0, voAt: Object.fromEntries(ids.map((id) => [id, window.film.voAt(id)])) } };
});
fs.writeFileSync(path.join(ROOT, "timeline.json"), JSON.stringify(timeline, null, 1));
await probe.close();
const total = Math.ceil(duration * fps);
const out = path.join(ROOT, "render");
fs.mkdirSync(out, { recursive: true });
const first = Math.floor(from * fps);
const per = Math.ceil((total - first) / WORKERS);
let done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const page = await openFilm();
  const a = first + w * per, b = Math.min(total, a + per);
  for (let i = a; i < b; i++) {
    const f = path.join(out, `f${String(i).padStart(5, "0")}.jpg`);
    if (fs.existsSync(f)) { done++; continue; }      // resumable
    await page.evaluate((t) => window.film.seek(t), i / fps);
    await page.screenshot({ path: f, type: "jpeg", quality: 94 });
    if (++done % 150 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${total - first} frames · ${(el / done).toFixed(2)} s/frame · ~${Math.round((total - first - done) * el / done / 60)} min left`);
    }
  }
  await page.close();
}));
await browser.close();
const pic = path.join(ROOT, "film-picture.mp4");
const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", path.join(out, "f%05d.jpg"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", pic], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status);
console.log("wrote", pic);
