// Records the demo walkthrough in the REAL Lens Studio preview (not the web twin) — step 1 of 2.
// Needs: Lens Studio open on this project (it writes .mcp.json with its MCP endpoint), ffmpeg on PATH or FFMPEG.
//   node tools/record-lens-studio.mjs
// It starts the LEAF scenario `demo_story` (Assets/Lumen/Leaf/Demo_Story.ts), which pinches the Lens's real SIK
// interactables on a fixed timeline, turns the preview camera on the same timeline through the MCP
// `MovePreviewCamera` tool, and records only the Lens Studio window (nothing else on screen) with ffmpeg.
// Output: the raw take + its timing in TMPDIR_LS; tools/compose-lens-studio-video.mjs builds the final video.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FF = process.env.FFMPEG || "ffmpeg";
const TMP = process.env.TMPDIR_LS || path.join(process.env.TEMP || "/tmp", "lumen-ls-rec");
fs.mkdirSync(TMP, { recursive: true });

// ---- minimal MCP-over-HTTP client (one session per caller, so camera moves don't queue behind the scenario run)
const cfg = JSON.parse(fs.readFileSync(".mcp.json", "utf8")).mcpServers["lens-studio"];
async function session(name) {
  let sid = null, id = 0;
  const rpc = async (method, params, notify) => {
    const body = { jsonrpc: "2.0", method, params };
    if (!notify) body.id = ++id;
    const h = { ...cfg.headers, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (sid) h["mcp-session-id"] = sid;
    const r = await fetch(cfg.url, { method: "POST", headers: h, body: JSON.stringify(body) });
    sid = r.headers.get("mcp-session-id") || sid;
    const t = await r.text();
    if (notify) return null;
    const m = t.match(/^data: (.*)$/m);
    return JSON.parse(m ? m[1] : t).result;
  };
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name, version: "1" } });
  await rpc("notifications/initialized", {}, true);
  return (tool, args) => rpc("tools/call", { name: tool, arguments: args || {} });
}

// ---- layout (spec space r/f/u cm, Assets/Lumen/Core/LumenLayout.ts) → preview world, camera reset at origin facing −Z
const EYE = 165;
const W = (r, f, u) => ({ x: r, y: u - EYE, z: -f });
const HUB = W(-33, 56, 86), CART = W(-46, 2, 107), PUMPS = W(-96, 102, 122), PUMPS_TRACE = W(-66, 102, 128), KINK = W(-9, 22.5, 104), POLE = W(-60, 104, 140);

// Camera timeline (seconds after the scenario's first frame). Pinch times live in Demo_Story.ts.
const SHOTS = [
  [0, HUB], [3.2, CART], [10.6, HUB], [16.4, PUMPS_TRACE], [19.4, HUB], [27.8, CART], [30.6, HUB], [35.2, PUMPS],
  [38.8, KINK], [44.0, POLE], [54.0, CART],
];
// Sound cues as the Lens plays them (AudioCues.ts) — mixed by the video tools.
const CUES = [
  [5.0, "tick"], [5.05, "markers"], [13.6, "red"], [25.0, "green"], [27.3, "confirm"],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [31.3 + i * 1.2, "alarm"]),
  [42.5, "resolved"], [45.0, "tick"], [47.5, "tick"], [50.0, "tick"], [52.5, "tick"], [55.0, "markers"],
];
const LENGTH = 57;

const cam = await session("lumen-rec-camera");
const runner = await session("lumen-rec-runner");
await cam("MovePreviewCamera", { action: "reset" });
await runner("open_leaf_panel");

// ---- find the Preview panel inside the Lens Studio window (ffmpeg captures only that window)
const title = execFileSync("powershell", ["-NoProfile", "-Command", "(Get-Process -Name 'Lens Studio').MainWindowTitle"]).toString().trim();
const grab = (extra) => [...extra, "-f", "gdigrab", "-framerate", "30", "-i", `title=${title}`];

const logs = await session("lumen-rec-logs");

const recStart = Date.now();
const ff = spawn(FF, ["-hide_banner", "-loglevel", "error", "-y", ...grab([]), "-t", String(LENGTH + 8),
  "-vf", "fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
  path.join(TMP, "video.mp4")], { stdio: "inherit" });

const run = runner("run_leaf_scenario", {
  scenarioId: "demo_story", onDevice: false,
  // No LEAF status text in the video: only warnings would draw, and the end-of-run report hides at once.
  parameters: { __leaf__log_level: "WARN", __leaf__diagnostic_report_duration_ms: "0" },
});

// t0 = the Lens-side timestamp of Demo_Story's "[Lumen demo] t0" print. Read through the
// MCP log tool in tail mode (it never touches the preview); the printed timestamp is exact even if we see it late.
let t0 = null;
const today = new Date();
while (t0 === null) {
  await new Promise((r) => setTimeout(r, 400));
  const res = await logs("RunAndCollectLogsTool", { mode: "tail", tailBytes: 60000 });
  const j = JSON.parse(res.content[0].text);
  for (const p of j.prints || []) {
    const m = p.match(/^I (\d\d):(\d\d):(\d\d)\.(\d\d\d) .*\[Lumen demo\] t0/);
    if (!m) continue;
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), +m[1], +m[2], +m[3], +m[4]).getTime();
    if (t >= recStart - 2000) t0 = t;
  }
  if (Date.now() - recStart > 40000) throw new Error("demo_story never started");
}
console.log("scenario started", ((t0 - recStart) / 1000).toFixed(2), "s into the recording");

// Smooth pans: interpolate the look-at target over 0.9 s.
let cur = SHOTS[0][1];
await cam("MovePreviewCamera", { action: "lookAt", ...cur });
for (const [t, target] of SHOTS.slice(1)) {
  const wait = t0 + t * 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const from = cur, steps = 12;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k * k * (3 - 2 * k);
    await cam("MovePreviewCamera", { action: "lookAt", x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e });
    await new Promise((r) => setTimeout(r, 60));
  }
  cur = target;
}
const result = await run;
console.log("demo_story:", JSON.stringify(result.content?.[0]?.text || result));
await new Promise((r) => ff.on("exit", r));

// The composer (tools/compose-lens-studio-video.mjs) cuts the full-window take into the final video.
fs.writeFileSync(path.join(TMP, "take.json"), JSON.stringify({ t0: (t0 - recStart) / 1000, length: LENGTH, cues: CUES }, null, 1));
console.log("take saved in", TMP, "— now run: node tools/compose-lens-studio-video.mjs");
