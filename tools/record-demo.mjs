// Renders story mode to devpost/demo/lumen-demo.mp4 (+ a README teaser GIF), frame-perfect, with the
// synthesized sound cues mixed in as the camera hears them. Needs ffmpeg and the web preview on :5173.
//   npm run build:web && npx http-server preview-web -p 5173 -s &  then  npm run record:demo
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tsImport } from "tsx/esm/api";

const FPS = Number(process.env.FPS || 24);
const W = 1280, H = 720;
const out = "devpost/demo";
const tmp = process.env.TMPDIR_DEMO || "/tmp/lumen-demo-frames";
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

// The story is deterministic in Lens time, so the frames are split across parallel workers: each
// fast-forwards to its first frame, then renders its share.
const WORKERS = Number(process.env.WORKERS || 3);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function openStory() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto("http://localhost:5173/?test&noframe");
  await page.waitForFunction(() => window.lumen);
  const info = await page.evaluate(() => { lumen.startStory(); return { length: lumen.storyLength, start: lumen.storyStartTime() }; });
  return { page, ...info };
}
const probe = await openStory();
const length = probe.length;
await probe.page.close();
const frames = Math.ceil(length * FPS);
const per = Math.ceil(frames / WORKERS);
let done = 0;
const results = await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const { page, start } = await openStory();
  const first = w * per;
  const last = Math.min(frames, first + per);
  await page.evaluate((t) => lumen.storyFrame(t), first / FPS);
  for (let i = first; i < last; i++) {
    if (i > first) await page.evaluate((dt) => lumen.storyFrame(dt), 1 / FPS);
    await page.screenshot({ path: `${tmp}/f${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    if (++done % (FPS * 10) === 0) console.log(`frame ${done}/${frames}`);
  }
  // The last worker has played (fast-forwarded) the whole story, so its cue log is complete.
  const cues = w === WORKERS - 1 ? await page.evaluate(() => lumen.cueLog()) : null;
  return { cues, start };
}));
const { cues, start } = results[WORKERS - 1];
await browser.close();

// ---- soundtrack: mix cues (equal-power pan) into a stereo 16-bit WAV ----
const { renderCue, SAMPLE_RATE } = await tsImport("../Assets/Lumen/Core/SoundSynth.ts", import.meta.url);
const startT = start; // cue times are Lens time; the story started at `start`
const n = Math.ceil(length * SAMPLE_RATE);
const L = new Float32Array(n), R = new Float32Array(n);
for (const c of cues) {
  const s = renderCue(c.id);
  const at = Math.round((c.t - startT) * SAMPLE_RATE);
  const a = ((c.pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * c.gain * 1.6, gr = Math.sin(a) * c.gain * 1.6;
  for (let i = 0; i < s.length && at + i < n; i++) { if (at + i < 0) continue; L[at + i] += s[i] * gl; R[at + i] += s[i] * gr; }
}
const buf = Buffer.alloc(44 + n * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
}
writeFileSync(`${tmp}/soundtrack.wav`, buf);

// ---- encode ----
const ff = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
ff(["-framerate", String(FPS), "-i", `${tmp}/f%05d.jpg`, "-i", `${tmp}/soundtrack.wav`, "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-crf", "24", "-preset", "slow", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-shortest", `${out}/lumen-demo.mp4`]);
// Teaser GIF for the README: pick-up → red port → redirect (story 21–36 s), 10 fps, 640 px.
ff(["-ss", "21", "-t", "15", "-framerate", String(FPS), "-i", `${tmp}/f%05d.jpg`, "-vf",
  "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
  `${out}/lumen-teaser.gif`]);
console.log(`wrote ${out}/lumen-demo.mp4 and ${out}/lumen-teaser.gif (${frames} frames, ${cues.length} sound cues)`);
