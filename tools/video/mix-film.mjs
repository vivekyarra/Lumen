// Mixes the Lumen film: picture + AI voice-over on its timeline + the Lens's own sound cues + the original score
// (ducked under the voice), loudness-normalized for YouTube (-14 LUFS).
//   node tools/video/mix-film.mjs   → devpost/demo/lumen-demo.mp4
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.LUMEN_VIDEO || path.join(process.env.TEMP || "/tmp", "lumen-video");
const FF = process.env.FFMPEG || "ffmpeg";
const OUT = process.env.OUT || "devpost/demo/lumen-demo.mp4";
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, "timeline.json"), "utf8"));
const take = JSON.parse(fs.readFileSync(path.join(ROOT, "story", "take.json"), "utf8"));

const music = path.join(ROOT, "music.wav");
execFileSync("node", ["tools/video/make_music.mjs", music, String(tl.duration), JSON.stringify({
  reveal: 38.2, zoom: 43.5, demo0: tl.demo0, demoEnd: tl.demo0 + 52, omt: tl.demo0 + 30.8, logo1: 8.4, logo2: 140.5,
})], { stdio: "inherit" });

const inputs = ["-i", path.join(ROOT, "film-picture.mp4"), "-i", music];
const f = [];
const vo = [];
let n = 2;
for (const [id, at] of Object.entries(tl.voAt)) {
  inputs.push("-i", path.join(ROOT, "vo", id + ".mp3"));
  const ms = Math.round(at * 1000);
  f.push(`[${n}:a]aresample=48000,adelay=${ms}|${ms}[v${n}]`); vo.push(`[v${n}]`); n++;
}
const cues = [[4.2, "tick"], [4.25, "markers"], ...take.cues.map(([t, name]) => [tl.demo0 + t, name])];
const cu = [];
for (const [t, name] of cues) {
  if (t > tl.demo0 + 52.6) continue;
  inputs.push("-i", `Assets/Lumen/Audio/lumen_${name}.wav`);
  const ms = Math.round(t * 1000);
  f.push(`[${n}:a]aresample=48000,adelay=${ms}|${ms},volume=0.55[c${n}]`); cu.push(`[c${n}]`); n++;
}
f.push(`${vo.join("")}amix=inputs=${vo.length}:normalize=0,apad,atrim=0:${tl.duration}[vo]`);
f.push(`[vo]asplit=2[vomix][vokey]`);
f.push(`${cu.join("")}amix=inputs=${cu.length}:normalize=0,apad,atrim=0:${tl.duration}[cues]`);
f.push(`[1:a]volume=0.45[mus]`);  // score sits ~6 dB under the old mix
f.push(`[mus][vokey]sidechaincompress=threshold=0.012:ratio=9:attack=25:release=600:makeup=1[duck]`);
f.push(`[vomix][cues][duck]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=9[aout]`);
execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", f.join(";"),
  "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", OUT], { stdio: "inherit" });
console.log("wrote", OUT);
