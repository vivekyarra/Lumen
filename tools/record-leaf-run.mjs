// Records the Lens Studio window while all 10 LEAF scenarios run in the preview (proof footage for the video).
//   node tools/record-leaf-run.mjs        → $TMPDIR_LS/leaf.mp4 + leaf.json (per-scenario start/end/status)
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FF = process.env.FFMPEG || "ffmpeg";
const TMP = process.env.TMPDIR_LS || path.join(process.env.TEMP || "/tmp", "lumen-leaf-rec");
fs.mkdirSync(TMP, { recursive: true });
const SCENARIOS = ["test_idle_is_quiet", "test_pickup_shows_markers", "test_switch_syringe_changes_markers",
  "test_trace_lights_correct_line", "test_red_port_redirects", "test_push_logs_and_returns_idle",
  "test_alarm_shows_and_resolves", "test_handoff_line_check", "test_ik_reach_controls", "test_self_test_dc1_dc10"];

const cfg = JSON.parse(fs.readFileSync(".mcp.json", "utf8")).mcpServers["lens-studio"];
let sid = null, id = 0;
async function rpc(method, params, notify) {
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
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "lumen-leaf-rec", version: "1" } });
await rpc("notifications/initialized", {}, true);
const call = (name, args) => rpc("tools/call", { name, arguments: args || {} });
await call("open_leaf_panel");
await call("MovePreviewCamera", { action: "reset" });
// Tilt down at the bedside without turning (the Lens anchors to the start heading, not the pitch).
await call("MovePreviewCamera", { action: "lookAt", x: 0, y: -70, z: -60 });

const title = execFileSync("powershell", ["-NoProfile", "-Command", "(Get-Process -Name 'Lens Studio').MainWindowTitle"]).toString().trim();
const recStart = Date.now();
const ff = spawn(FF, ["-hide_banner", "-loglevel", "error", "-y", "-f", "gdigrab", "-framerate", "30", "-i", `title=${title}`,
  "-vf", "fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
  path.join(TMP, "leaf.mp4")], { stdio: ["pipe", "inherit", "inherit"] });

const runs = [];
for (const s of SCENARIOS) {
  const a = (Date.now() - recStart) / 1000;
  const r = await call("run_leaf_scenario", { scenarioId: s, onDevice: false, parameters: { __leaf__diagnostic_report_duration_ms: "1500" } });
  const status = JSON.parse(r.content[0].text).status;
  runs.push({ scenario: s, start: a, end: (Date.now() - recStart) / 1000, status });
  console.log(s, status);
}
await new Promise((r) => setTimeout(r, 2000));
ff.stdin.write("q");
await new Promise((r) => ff.on("exit", r));
fs.writeFileSync(path.join(TMP, "leaf.json"), JSON.stringify(runs, null, 1));
console.log("saved", path.join(TMP, "leaf.mp4"));
