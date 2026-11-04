// Step 2 of 2: builds devpost/demo/lumen-lens-studio.mp4 from the take saved by tools/record-lens-studio.mjs.
//   node tools/compose-lens-studio-video.mjs
// Layout (1920×1080): intro cards → ~8 s of the WHOLE Lens Studio window (proof it is the real app) → the story,
// zoomed onto the SPECS display area of the Preview panel, with captions in the side margins (never over the
// Lens) → end card. The Lens's own sound cues are mixed in at the moments it plays them.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FF = process.env.FFMPEG || "ffmpeg";
const TMP = process.env.TMPDIR_LS || path.join(process.env.TEMP || "/tmp", "lumen-ls-rec");
const OUT = "devpost/demo/lumen-lens-studio.mp4";
const take = JSON.parse(fs.readFileSync(path.join(TMP, "take.json"), "utf8"));
// SPECS display area inside the Lens Studio window capture (w:h:x:y). Measured on a 1920-wide window; override with BOX.
const BOX = process.env.BOX || "620:708:839:186";

const BG = "0x101418", CYAN = "0x3FE0FF", WHITE = "0xF4F7FA", DIM = "0x9AA4AE", AMBER = "0xFFB020";
const font = (bold) => "C\\:/Windows/Fonts/" + (bold ? "seguisb.ttf" : "segoeui.ttf");
let nText = 0;
function text(s, { x, y, size, color = WHITE, bold = true, from, to, center = false }) {
  const f = path.join(TMP, `t${nText++}.txt`);
  fs.writeFileSync(f, s);
  const tf = f.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
  const xs = center ? `(w-text_w)/2` : String(x);
  const en = from !== undefined ? `:enable='between(t,${from},${to})'` : "";
  return `drawtext=fontfile='${font(bold)}':textfile='${tf}':fontsize=${size}:fontcolor=${color}:line_spacing=${Math.round(size * 0.28)}:x=${xs}:y=${y}${en}`;
}

const TITLE = 4.0, PROBLEM = 5.5, PRE = 1.0, FULL_STORY = 7.0, END = 7.0;
const storyEnd = take.length;
const zoomLen = storyEnd - FULL_STORY;

// Captions on the zoomed story, in story seconds.
const CAPTIONS = [
  [7, 11, `Holding
furosemide.

Every port answers:
green = safe,
red = why not.`],
  [11, 17, `Port B is red:
Midazolam runs
in that line.

Its line lights up
to its pump. Lumen
points to the
safe port.`],
  [17, 21, `Port A, Distal:
compatible.

Push here.`],
  [21, 25, `Pushed. Logged.

The Lens goes
quiet.`],
  [25, 30, `Out of view,
Pump 2 alarms.

A chime and an
arrow lead the
nurse to it.`],
  [30, 33.2, `The line glows
amber all the way
to the kink.`],
  [33.2, 38, `Kink fixed.
Resolved.

Quiet again.`],
  [38, 49, `Shift handoff:
one pinch on the
pole lights every
line, bag to port.`],
  [49, storyEnd, `Lines checked:
4 of 4.`],
];

const v = [];
// Intro card 1: name + hook.
v.push(`color=c=${BG}:s=1920x1080:r=30:d=${TITLE},` + [
  text("Lumen", { center: true, y: 360, size: 150, color: CYAN }),
  text("Which IV port is safe for the drug in my hand?", { center: true, y: 580, size: 56 }),
  text("An AR Lens for SPECS · for ICU nurses", { center: true, y: 690, size: 40, color: DIM, bold: false }),
].join(",") + ",fade=t=in:st=0:d=0.5[c1]");
// Intro card 2: the problem.
v.push(`color=c=${BG}:s=1920x1080:r=30:d=${PROBLEM},` + [
  text("An ICU patient can have several IV drugs running at once.", { center: true, y: 380, size: 50 }),
  text("Before every push the nurse must know:", { center: true, y: 470, size: 50, color: DIM, bold: false }),
  text("which line is this, and is it safe for this drug?", { center: true, y: 560, size: 56, color: AMBER }),
  text("Today: trace tangled tubes by hand, check a chart away from the bed.", { center: true, y: 680, size: 38, color: DIM, bold: false }),
].join(",") + "[c2]");
// The whole Lens Studio window: pre-roll (Lens starting) + the first seconds of the story.
const s0 = Math.max(0, take.t0 - PRE), s1 = take.t0 + FULL_STORY, s2 = take.t0 + storyEnd;
v.push(`[0:v]split[ra][rb]`);
v.push(`[ra]trim=start=${s0.toFixed(3)}:end=${s1.toFixed(3)},setpts=PTS-STARTPTS,scale=1920:-2,pad=1920:1080:0:(oh-ih)/2:color=${BG},` +
  text("● LIVE in Lens Studio 5.24.1  ·  SPECS 27 preview  ·  this repo's project", { x: 40, y: 1080 - 46, size: 30, color: CYAN }) + "[full]");
// Zoomed SPECS display view with side captions.
const zoomCaps = CAPTIONS.map(([a, b, s]) => text(s, { x: 64, y: 300, size: 40, from: (a - FULL_STORY).toFixed(2), to: (b - FULL_STORY).toFixed(2) }));
v.push(`[rb]trim=start=${s1.toFixed(3)}:end=${s2.toFixed(3)},setpts=PTS-STARTPTS,crop=${BOX},scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=${BG},` + [
  text("LIVE · Lens Studio", { x: 1478, y: 300, size: 36, color: CYAN }),
  text("What a SPECS wearer\nsees: the 37° display\narea of the preview.", { x: 1478, y: 365, size: 30, color: WHITE, bold: false }),
  text("Pinches: a LEAF scenario\ndriving the Lens's real\nSIK interactables —\nthe same as a\nmouse pinch.", { x: 1478, y: 530, size: 27, color: DIM, bold: false }),
  ...zoomCaps,
].join(",") + "[zoom]");
// End card.
v.push(`color=c=${BG}:s=1920x1080:r=30:d=${END},` + [
  text("Lumen", { center: true, y: 300, size: 130, color: CYAN }),
  text("The right line, the safe port, where you look.", { center: true, y: 480, size: 54 }),
  text("Built in Lens Studio 5.24.1 through the Lens Studio MCP · SIK · LEAF", { center: true, y: 600, size: 38, color: DIM, bold: false }),
  text("10 / 10 LEAF scenarios pass in the Lens Studio preview", { center: true, y: 660, size: 38, color: DIM, bold: false }),
  text("github.com/vivekyarra/Lumen", { center: true, y: 780, size: 44, color: CYAN }),
].join(",") + ",fade=t=out:st=" + (END - 0.8) + ":d=0.8[c3]");
v.push(`[c1][c2][full][zoom][c3]concat=n=5:v=1:a=0[vout]`);

// Audio: the Lens's cues at their story times.
const storyStart = TITLE + PROBLEM + PRE; // output time of story t = 0
const inputs = ["-i", path.join(TMP, "video.mp4")];
const a = [];
take.cues.forEach(([t, name], i) => {
  inputs.push("-i", `Assets/Lumen/Audio/lumen_${name}.wav`);
  const ms = Math.round((storyStart + t) * 1000);
  a.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
});
const total = TITLE + PROBLEM + (s1 - s0) + zoomLen + END;
a.push(take.cues.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${take.cues.length}:normalize=0,volume=0.9,apad,atrim=0:${total.toFixed(2)}[aout]`);

execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", [...v, ...a].join(";"),
  "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT], { stdio: "inherit" });
console.log("wrote", OUT, `(${total.toFixed(1)} s)`);
