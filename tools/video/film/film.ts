// Lumen demo film — every frame is a pure function of time, so tools/video/render-film.mjs can render it
// frame-perfect. 3D shots reuse the Lens's own bedside (preview-web LumenWorld, Core meshes + state machine);
// the demo itself is real Lens Studio footage (tools/record-lens-studio.mjs), zoomed onto the SPECS view.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LumenWorld } from "../../../preview-web/src/world";
import { toThree, worldGeometry } from "../../../preview-web/src/coords";
import { COLORS } from "../../../preview-web/src/palette";
import * as L from "../../../Assets/Lumen/Core/LumenLayout";
import * as M from "../../../Assets/Lumen/Core/MeshGen";
import { LINE_IDS, LINES, DRUGS, LineId } from "../../../Assets/Lumen/Core/LumenData";
import { LumenStateMachine } from "../../../Assets/Lumen/Core/LumenState";
import { sampleCurve, SampledCurve, pointAtLength } from "../../../Assets/Lumen/Core/Curves";

// ------------------------------------------------------------------ data from the render tool
type Word = [number, number, string];
type Voice = Record<string, { text: string; duration: number; words: Word[] }>;
interface Take { t0: number; length: number; cues: [number, string][] }
const W = 1920, H = 1080, FPS = 30;
const BOX = { x: 865, y: 185, w: 620, h: 708 };        // SPECS display area inside the story take (window px)
const WIN = { w: 1920, h: 974 };
const STORY_FROM = -2.2;                                 // first extracted story frame, in story seconds
const HOLD = 1.2;                                        // before this story time the preview camera is still settling

// ------------------------------------------------------------------ timeline (seconds)
const VO_AT: Record<string, number> = {
  v01: 0.8, v02: 2.8, v03: 8.6,
  v04: 11.8, v05: 14.9, v06: 20.9, v07: 24.8, v08: 26.5, v09: 29.8,
  v10: 38.5,
  v11: 0.3, v12: 5.0, v13: 8.8, v14: 12.8, v15: 19.8, v16: 25.0, v17: 27.2, v18: 30.8, v19: 33.0, v20: 39.0, v21: 44.4, // story time
  v22: 98.6, v23: 101.0, v24: 108.8, v25: 115.6, v26: 125.4, v27: 129.9, v28: 135.2,
};
const DEMO0 = 45.6;                                      // global time of story t = 0
const STORY_VO = new Set(["v11", "v12", "v13", "v14", "v15", "v16", "v17", "v18", "v19", "v20", "v21"]);
export const DURATION = 142.6;
const T = {
  hook: [0, 11.4], problem: [11.4, 38.2], reveal: [38.2, DEMO0 + 0.2], demo: [DEMO0, DEMO0 + 52.8],
  why: [98.4, 115.4], built: [115.4, 129.6], close: [129.6, DURATION],
} as const;
function voStart(id: string): number { return STORY_VO.has(id) ? DEMO0 + VO_AT[id] : VO_AT[id]; }

// ------------------------------------------------------------------ math
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const eInOut = (k: number) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eBack = (k: number) => { k = clamp(k); const c = 1.55; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
/** Fade in over [a, a+i], out over [b-o, b]. */
const win = (t: number, a: number, b: number, i = 0.5, o = 0.5) => Math.min(eOut(prog(t, a, a + i)), 1 - eOut(prog(t, b - o, b)));
const inWin = (t: number, r: readonly [number, number]) => t >= r[0] && t < r[1];

// ------------------------------------------------------------------ DOM helpers
const layers = document.getElementById("layers")!;
function el(tag: string, cls: string, parent: HTMLElement, html?: string, style?: Partial<CSSStyleDeclaration>): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (style) Object.assign(e.style, style);
  parent.appendChild(e);
  return e;
}
function layer(): HTMLElement { return el("div", "layer", layers); }
function show(e: HTMLElement, o: number, tx = 0, ty = 0, sc = 1, blur = 0): void {
  const d = e as HTMLElement & { __disp?: string };
  if (d.__disp === undefined) d.__disp = e.style.display === "none" ? "" : e.style.display;
  e.style.opacity = String(clamp(o));
  e.style.display = o <= 0.001 ? "none" : d.__disp;
  e.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
  e.style.filter = blur > 0.05 ? `blur(${blur}px)` : "";
}
/** Kinetic headline: words rise in one after another. */
function words(parent: HTMLElement, text: string, cls: string, style?: Partial<CSSStyleDeclaration>) {
  const box = el("div", cls, parent, "", style);
  const spans = text.split(" ").map((w, i, a) => el("span", "word", box, w.replace(/\*(.+?)\*/g, '<span class="accent">$1</span>') + (i < a.length - 1 ? " " : "")));
  return {
    box,
    at(t: number, start: number, step = 0.08, dur = 0.55): void {
      spans.forEach((s, i) => {
        const k = eOut(prog(t, start + i * step, start + i * step + dur));
        s.style.opacity = String(k);
        s.style.transform = `translateY(${(1 - k) * 34}px)`;
        s.style.filter = k < 0.99 ? `blur(${(1 - k) * 10}px)` : "";
      });
    },
  };
}
function icon(name: string, color = "#3fe0ff", size = 64): string {
  const p: Record<string, string> = {
    eye: '<path d="M4 32 C16 12 48 12 60 32 C48 52 16 52 4 32 Z"/><circle cx="32" cy="32" r="10"/>',
    cube: '<path d="M32 6 L56 19 L56 45 L32 58 L8 45 L8 19 Z"/><path d="M8 19 L32 32 L56 19 M32 32 L32 58"/>',
    hand: '<path d="M20 34 V14 a4 4 0 0 1 8 0 V30 M28 12 a4 4 0 0 1 8 0 V30 M36 14 a4 4 0 0 1 8 0 V32 M44 22 a4 4 0 0 1 8 0 V40 C52 52 44 60 34 60 C24 60 18 54 14 46 L8 36 a4 4 0 0 1 7 -4 L20 38"/>',
    barcode: '<path d="M8 12 V52 M16 12 V52 M22 12 V52 M30 12 V52 M36 12 V52 M44 12 V52 M48 12 V52 M56 12 V52"/>',
    line: '<path d="M6 50 C20 50 18 14 32 14 C46 14 44 50 58 50"/><circle cx="6" cy="50" r="4"/><circle cx="58" cy="50" r="4"/>',
    pump: '<rect x="14" y="8" width="36" height="48" rx="6"/><rect x="21" y="16" width="22" height="12" rx="2"/><path d="M24 40 H40 M24 47 H34"/>',
    glasses: '<circle cx="18" cy="34" r="12"/><circle cx="46" cy="34" r="12"/><path d="M30 34 H34 M6 30 L2 22 M58 30 L62 22"/>',
    check: '<path d="M12 34 L26 48 L52 18"/>',
    agent: '<rect x="10" y="12" width="44" height="34" rx="8"/><path d="M22 54 H42 M24 26 L30 30 L24 34 M34 36 H42"/>',
    plug: '<path d="M22 8 V22 M42 8 V22 M14 22 H50 V34 C50 44 42 50 32 50 C22 50 14 44 14 34 Z M32 50 V60"/>',
    ls: '<rect x="8" y="8" width="48" height="48" rx="12"/><path d="M24 22 V42 H40"/>',
    code: '<path d="M22 18 L8 32 L22 46 M42 18 L56 32 L42 46 M36 12 L28 52"/>',
    flask: '<path d="M24 8 H40 M28 8 V26 L12 54 C10 58 12 60 16 60 H48 C52 60 54 58 52 54 L36 26 V8"/><path d="M18 44 H46"/>',
    web: '<circle cx="32" cy="32" r="24"/><path d="M8 32 H56 M32 8 C22 18 22 46 32 56 C42 46 42 18 32 8"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${p[name]}</svg>`;
}
/** Animated stroke-draw for an SVG inside e (0..1). */
function drawSvg(e: HTMLElement, k: number): void {
  e.querySelectorAll<SVGGeometryElement>("path,circle,rect").forEach((s) => {
    const len = (s as any).__len || ((s as any).__len = s.getTotalLength ? s.getTotalLength() : 200);
    s.style.strokeDasharray = String(len);
    s.style.strokeDashoffset = String(len * (1 - clamp(k)));
  });
}

// ------------------------------------------------------------------ 3D: the Lens's own bedside, cinematic
const canvas = document.getElementById("gl") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080d);
scene.fog = new THREE.FogExp2(0x05080d, 0.0019);
const camera = new THREE.PerspectiveCamera(38, W / H, 4, 4000);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0x9fc6ff, 0x05080d, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-80, 420, 160); scene.add(key);
const rim = new THREE.PointLight(0x3fe0ff, 2.2, 0, 0); rim.position.set(-160, 230, -260); scene.add(rim);
const fill = new THREE.PointLight(0x6a8cff, 0.8, 0, 0); fill.position.set(220, 140, 120); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: 0x070b11, roughness: 0.55, metalness: 0.35 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(1800, 60, 0x3fe0ff, 0x3fe0ff);
(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.07; grid.position.y = 0.3; scene.add(grid);

const world = new LumenWorld(camera);
scene.add(world.root);
// Restyle the stand-in room: dark matte surfaces with faint cyan edges, so the Lens's light is the hero.
const tubeMeshes: THREE.Mesh[] = [];
world.scenery.traverse((o) => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  const mat = m.material as THREE.MeshLambertMaterial;
  if (!mat || !mat.color) return;
  if (mat.color.getHex() === COLORS.tube) { tubeMeshes.push(m); return; }
  const c = mat.color.clone().multiplyScalar(0.34);
  m.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.08, transparent: mat.transparent, opacity: mat.opacity });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color: 0x3fe0ff, transparent: true, opacity: 0.16 }));
  m.add(edges);
});
for (const tm of tubeMeshes) tm.material = new THREE.MeshStandardMaterial({ color: 0xc9d6e2, emissive: 0x3a4a5a, emissiveIntensity: 0.5, roughness: 0.4, transparent: true, opacity: 0.9 });

// Animated tubes for the problem shot (drawn on one by one).
const curves: Record<LineId, SampledCurve> = {} as Record<LineId, SampledCurve>;
const drawTubes: Record<LineId, THREE.Mesh> = {} as Record<LineId, THREE.Mesh>;
const heads: Record<LineId, THREE.Mesh> = {} as Record<LineId, THREE.Mesh>;
const drawGroup = new THREE.Group(); scene.add(drawGroup);
for (const l of LINE_IDS) {
  curves[l] = sampleCurve(L.LINE_LAYOUT[l].control, L.CURVE_SAMPLES_PER_SEGMENT);
  drawTubes[l] = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xdfe8f0, emissive: 0x6f8aa0, emissiveIntensity: 0.6, roughness: 0.35 }));
  heads[l] = new THREE.Mesh(worldGeometry(M.sphere({ r: 0, f: 0, u: 0 }, 1.4, 12, 16)), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  drawGroup.add(drawTubes[l], heads[l]);
}
const drawCache: Record<string, THREE.BufferGeometry> = {};
function setDrawn(l: LineId, k: number): void {
  const c = curves[l];
  const n = Math.max(2, Math.round(c.points.length * clamp(k)));
  const keyName = l + ":" + n;
  if (!drawCache[keyName]) drawCache[keyName] = worldGeometry(M.tube(c.points.slice(0, n), L.TUBE_RADIUS * 1.25, 10, false));
  drawTubes[l].geometry = drawCache[keyName];
  drawTubes[l].visible = k > 0.001;
  const p = pointAtLength(c, c.totalLength * clamp(k));
  heads[l].position.copy(toThree(p));
  heads[l].visible = k > 0.001 && k < 0.999;
}
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.95, 0.55, 0.62);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function project(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
  const v = p.clone().project(camera);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, ok: v.z < 1 };
}
function lookCam(pos: THREE.Vector3, target: THREE.Vector3): void { camera.position.copy(pos); camera.lookAt(target); camera.updateMatrixWorld(); }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const HUB3 = toThree(L.HUB_TARGET);

/** Lumen state for the 3D shots, replayed from scratch each frame (deterministic). */
function viewAt(actions: [number, (m: LumenStateMachine) => void][], t: number) {
  const m = new LumenStateMachine(L.PORT_POS, undefined, 0);
  let now = 0;
  for (const [at, fn] of actions) {
    if (at > t) break;
    m.update(at); now = at; fn(m);
  }
  m.update(Math.max(now, t));
  return m.view();
}
function render3D(t: number, view: ReturnType<typeof viewAt>, tubesMode: "scene" | "draw"): void {
  for (const tm of tubeMeshes) tm.visible = tubesMode === "scene";
  drawGroup.visible = tubesMode === "draw";
  world.render(view, t, camera);
  composer.render();
}

// ------------------------------------------------------------------ footage (real Lens Studio recordings)
const fl = layer();
const footWrap = el("div", "abs", fl, "", { left: "0", top: "0", width: W + "px", height: H + "px", overflow: "hidden" });
const footImg = el("img", "footage", footWrap) as HTMLImageElement;
footImg.style.width = WIN.w + "px"; footImg.style.height = WIN.h + "px";
const boxFrame = el("div", "abs", fl, "", { border: "2px solid rgba(63,224,255,.55)", borderRadius: "26px", boxShadow: "0 0 50px rgba(63,224,255,.25)" });
const boxTag = el("div", "abs eyebrow", fl, "LIVE · Lens Studio preview · SPECS 27 view", { fontSize: "15px", letterSpacing: ".28em", color: "#3fe0ff" });
let footSrc = "";
async function setFootage(src: string): Promise<void> {
  if (src === footSrc) return;
  footSrc = src;
  footImg.src = src;
  try { await footImg.decode(); } catch (e) { /* missing frame: keep the last */ }
}
const storyFrame = (st: number) => `/story/f${String(Math.max(1, Math.round((st - STORY_FROM) * FPS) + 1)).padStart(5, "0")}.jpg`;
const leafFrame = (src: number) => `/leaf/f${String(Math.max(1, Math.floor(src * 6) + 1)).padStart(5, "0")}.jpg`;
/** Place the window image: scale + top-left. */
function placeWin(s: number, x: number, y: number, rx = 0, extra = ""): void {
  footImg.style.transform = `translate(${x}px, ${y}px) ${extra} rotateX(${rx}deg) scale(${s})`;
}
const FULL = { s: 0.86, x: (W - WIN.w * 0.86) / 2, y: (H - WIN.h * 0.86) / 2 + 20 };
const BOXS = 1000 / BOX.h;
const ZOOM = { s: BOXS, x: 960 - (BOX.x + BOX.w / 2) * BOXS, y: 40 - BOX.y * BOXS };

// ------------------------------------------------------------------ captions (word-synced)
const cap = document.getElementById("caption")!;
let voice: Voice = {};
const NO_CAPTION = new Set(["v07", "v08", "v18", "v22", "v28", "v03"]);
type Chunk = { a: number; b: number; words: { a: number; b: number; w: string }[] };
const chunks: Chunk[] = [];
function buildCaptions(): void {
  for (const id of Object.keys(VO_AT)) {
    if (NO_CAPTION.has(id) || !voice[id]) continue;
    const st = voStart(id);
    let cur: Chunk["words"] = [];
    const ws = voice[id].words;
    ws.forEach(([a, b, w], i) => {
      cur.push({ a: st + a, b: st + b, w });
      const txt = cur.map((x) => x.w).join(" ");
      if (txt.length > 46 || /[.?!:,]$/.test(w) && txt.length > 18 || i === ws.length - 1) {
        chunks.push({ a: cur[0].a - 0.05, b: cur[cur.length - 1].b, words: cur }); cur = [];
      }
    });
  }
  chunks.sort((x, y) => x.a - y.a);
  for (let i = 0; i < chunks.length; i++) chunks[i].b = Math.min(chunks[i].b + 0.55, i + 1 < chunks.length ? chunks[i + 1].a : 1e9);
}
let capKey = "";
function captionAt(t: number): void {
  const c = chunks.find((x) => t >= x.a && t < x.b);
  if (!c) { cap.style.opacity = "0"; return; }
  const k = c.a + ":" + c.words.filter((w) => t >= w.a).length;
  if (k !== capKey) {
    capKey = k;
    cap.innerHTML = c.words.map((w) => `<span class="word${t >= w.a ? " on" : ""}">${w.w} </span>`).join("");
  }
  cap.style.opacity = String(Math.min(eOut(prog(t, c.a, c.a + 0.2)), 1 - prog(t, c.b - 0.15, c.b)));
}
function wordAt(id: string, needle: string): number {
  const v = voice[id];
  const w = v.words.find((x) => x[2].toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(needle));
  return voStart(id) + (w ? w[0] : 0);
}

// ------------------------------------------------------------------ scenes (DOM)
// HOOK
const hook = layer();
const hookTag = el("div", "abs eyebrow", hook, "ICU · bedside", { left: "120px", top: "110px" });
const hookWord = words(hook, "This is *furosemide.*", "abs h1", { left: "120px", top: "150px", fontSize: "84px" });
const hookSub = words(hook, "Every IV line answers: *safe* — or why not.", "abs h3", { left: "120px", top: "262px", color: "#c4ccd6" });
const logo = layer();
logo.innerHTML = `<div class="abs" id="logoWrap" style="left:0;top:0;width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:26px">
  <div style="display:flex;align-items:center;gap:34px">
    <svg id="logoRing" width="150" height="150" viewBox="0 0 64 64" fill="none" stroke="#3fe0ff" stroke-width="3.4" stroke-linecap="round"><circle cx="32" cy="32" r="26"/><path d="M20 33 L29 42 L45 23"/></svg>
    <div id="logoWord" style="font-weight:800;font-size:190px;letter-spacing:-.03em;background:linear-gradient(100deg,#f4f7fa 0%,#f4f7fa 40%,#3fe0ff 50%,#f4f7fa 60%,#f4f7fa 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent">Lumen</div>
  </div>
  <div id="logoTag" class="h3" style="color:#8b97a6;font-weight:600">The right line. The safe port. Where you look.</div></div>`;
const logoRing = logo.querySelector("#logoRing") as unknown as HTMLElement;
const logoWord = logo.querySelector("#logoWord") as HTMLElement;
const logoTag = logo.querySelector("#logoTag") as HTMLElement;
const logoWrap = logo.querySelector("#logoWrap") as HTMLElement;
const logoGlow = el("div", "abs", logo, "", { left: "560px", top: "300px", width: "800px", height: "480px", borderRadius: "50%",
  background: "radial-gradient(closest-side, rgba(63,224,255,.22), rgba(63,224,255,0))" });

// PROBLEM
const prob = layer();
const maya = el("div", "abs", prob, `<div class="eyebrow">Meet Maya</div><div class="h2" style="margin-top:14px">ICU nurse · 12-hour shift</div>`, { left: "120px", top: "120px" });
const tags: Record<LineId, HTMLElement> = {} as Record<LineId, HTMLElement>;
for (const l of LINE_IDS) {
  tags[l] = el("div", "abs chip", prob, `<span style="width:10px;height:10px;border-radius:50%;background:#3fe0ff;box-shadow:0 0 12px #3fe0ff"></span>${DRUGS[LINES[l].drug].shortName}<span style="color:#8b97a6;font-weight:400">${LINES[l].rate}</span>`);
}
const tally = el("div", "abs", prob, "", { right: "120px", top: "130px", textAlign: "right" });
tally.innerHTML = `<div class="h1" style="font-size:120px"><span id="n1">4</span> <span style="color:#8b97a6;font-weight:600;font-size:44px">drugs</span></div>
  <div class="h1" style="font-size:120px"><span>4</span> <span style="color:#8b97a6;font-weight:600;font-size:44px">tubes</span></div>
  <div class="h1 accent" style="font-size:120px">1 <span style="font-weight:600;font-size:44px">tangle</span></div>`;
const tallyRows = Array.from(tally.children) as HTMLElement[];
const dim = el("div", "abs", prob, "", { left: "0", top: "0", width: W + "px", height: H + "px", background: "radial-gradient(ellipse at 50% 50%, rgba(5,8,13,.55), rgba(5,8,13,.92))" });
const q0 = words(prob, "Before every push, two questions.", "abs h3", { left: "0", width: W + "px", top: "300px", textAlign: "center", color: "#8b97a6" });
const q1 = words(prob, "Which *line* is this?", "abs h1", { left: "0", width: W + "px", top: "390px", textAlign: "center", fontSize: "110px" });
const q2 = words(prob, "Will my drug *react* with what's in it?", "abs h1", { left: "0", width: W + "px", top: "540px", textAlign: "center", fontSize: "78px" });
const today = el("div", "abs", prob, "", { left: "120px", top: "130px", width: "1100px" });
today.innerHTML = `<div class="eyebrow">Today</div>
  <div class="h2" style="margin-top:16px">Trace tubes by hand.<br><span style="color:#8b97a6">Check a chart across the room.</span></div>`;
const chart = el("div", "abs glass", prob, `<div class="eyebrow" style="font-size:14px">Y-site compatibility chart</div>
  <div style="display:grid;grid-template-columns:repeat(6,40px);gap:6px;margin-top:16px">${Array.from({ length: 36 }, (_, i) => `<div style="height:22px;border-radius:5px;background:${[0x3dff7a, 0xff4d4d, 0x2a3644][(i * 7 + (i >> 2)) % 3] === 0x2a3644 ? "#2a3644" : (i * 7 + (i >> 2)) % 3 === 0 ? "rgba(61,255,122,.55)" : "rgba(255,77,77,.55)"}"></div>`).join("")}</div>`,
  { left: "1260px", top: "300px", padding: "26px", width: "300px" });
const shift = el("div", "abs", prob, "", { left: "0", width: W + "px", top: "770px", textAlign: "center" });
shift.innerHTML = `<div class="h3" id="shiftTxt">Many times a shift. <span class="accent">Every shift.</span></div>
  <div id="ticks" style="display:flex;gap:10px;justify-content:center;margin-top:22px">${Array.from({ length: 24 }, () => `<div style="width:6px;height:34px;border-radius:3px;background:#3fe0ff"></div>`).join("")}</div>`;
const ticks = Array.from(shift.querySelectorAll("#ticks > div")) as HTMLElement[];
const shiftTxt = shift.querySelector("#shiftTxt") as HTMLElement;

// REVEAL
const rev = layer();
const revTitle = words(rev, "So we built *Lumen.*", "abs h1", { left: "0", width: W + "px", top: "430px", textAlign: "center", fontSize: "104px" });
const revSub = el("div", "abs eyebrow", rev, "An AR Lens for Snap SPECS", { left: "0", width: W + "px", top: "580px", textAlign: "center", fontSize: "24px" });
const appTag = el("div", "abs", rev, `<span class="tag">REAL APP</span><span class="h3" style="font-size:30px;margin-left:16px">Lens Studio 5.24.1 · this repo's <span class="accent">Lumen.esproj</span></span>`, { left: FULL.x + "px", top: FULL.y - 66 + "px" });
const calls = [
  { txt: "Preview · SPECS 27", x: 1150, y: 120 },
  { txt: "Scene: Lumen + LeafIndex", x: 120, y: 960 },
].map((c) => ({ ...c, e: el("div", "abs chip", rev, `<span style="width:10px;height:10px;border-radius:50%;background:#3fe0ff;box-shadow:0 0 14px #3fe0ff"></span>${c.txt}`, { left: c.x + "px", top: c.y + "px" }) }));

// DEMO side panels
const demo = layer();
const STEPS = [["Quiet", 0], ["Check", 5.0], ["Trace", 13.6], ["Push", 25.0], ["Alarm", 30.8], ["Handoff", 44.4]] as const;
const rail = el("div", "abs", demo, "", { left: "70px", top: "170px", width: "330px" });
rail.innerHTML = `<div class="eyebrow" style="font-size:16px;letter-spacing:.3em">The workflow</div>` + STEPS.map((s, i) =>
  `<div class="step" style="display:flex;align-items:center;gap:18px;margin-top:${i ? 26 : 30}px"><div class="num" style="width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;border:1.5px solid rgba(255,255,255,.14);color:#8b97a6">0${i + 1}</div><div class="lbl" style="font-weight:700;font-size:30px;color:#5d6876">${s[0]}</div></div>`).join("");
const stepEls = Array.from(rail.querySelectorAll(".step")) as HTMLElement[];
const state = el("div", "abs glass", demo, "", { left: "1500px", top: "170px", width: "360px", padding: "26px 26px 22px" });
const PORTROWS = [["A", "Distal", "Heparin"], ["B", "Medial", "Midazolam"], ["C", "Proximal", "Dobutamine"], ["D", "PIV", "NaCl 0.9%"]] as const;
state.innerHTML = `<div class="eyebrow" style="font-size:15px;letter-spacing:.3em">Lens state</div>
  <div style="margin-top:14px;font-size:18px;color:#8b97a6">Holding</div><div id="held" style="font-weight:700;font-size:28px;margin-top:4px">—</div>
  <div style="height:1px;background:rgba(255,255,255,.08);margin:18px 0 6px"></div>
  ${PORTROWS.map((p) => `<div class="prow" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0">
     <div><div style="font-weight:700;font-size:22px">Port ${p[0]} <span style="color:#8b97a6;font-weight:400">${p[1]}</span></div><div style="font-size:17px;color:#8b97a6;margin-top:2px">${p[2]}</div></div>
     <div class="badge" style="min-width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;border:1.5px solid rgba(255,255,255,.14);color:#5d6876">·</div></div>`).join("")}
  <div style="height:1px;background:rgba(255,255,255,.08);margin:8px 0 14px"></div>
  <div id="event" style="font-weight:600;font-size:20px;color:#8b97a6;min-height:52px">Quiet. Nothing to say.</div>`;
const held = state.querySelector("#held") as HTMLElement;
const rows = Array.from(state.querySelectorAll(".prow")) as HTMLElement[];
const badges = Array.from(state.querySelectorAll(".badge")) as HTMLElement[];
const evt = state.querySelector("#event") as HTMLElement;
const omt = el("div", "abs", demo, `<div class="h1" style="font-size:96px;text-shadow:0 0 40px rgba(0,0,0,.9)">One more thing.</div>`, { left: "0", width: W + "px", top: "470px", textAlign: "center" });

// WHY GLASSES
const why = layer();
const whyBg = el("div", "abs", why, "", { left: "0", top: "0", width: W + "px", height: H + "px", overflow: "hidden" });
const whyImg = el("img", "", whyBg, "", { position: "absolute", width: WIN.w * 1.9 + "px", height: WIN.h * 1.9 + "px", left: -BOX.x * 1.9 + 960 - BOX.w * 0.95 + "px", top: -BOX.y * 1.9 + 540 - BOX.h * 0.95 + "px", filter: "blur(18px) brightness(.35) saturate(1.2)" }) as HTMLImageElement;
const whyGlasses = el("div", "abs", why, icon("glasses", "#3fe0ff", 170), { left: "875px", top: "230px" });
const whyHead = words(why, "This only works on *glasses.*", "abs h1", { left: "0", width: W + "px", top: "430px", textAlign: "center" });
const PILLARS = [["eye", "Shares your view", "It sees what she sees."], ["cube", "Draws in the world", "On the real tube — not on a screen."], ["hand", "Leaves hands free", "Gloves on. Syringe in hand."]] as const;
const pillars = PILLARS.map((p, i) => el("div", "abs glass", why, `${icon(p[0], "#3fe0ff", 72)}<div class="h3" style="margin-top:22px;font-weight:700">${p[1]}</div><div class="body" style="margin-top:10px">${p[2]}</div>`,
  { left: 210 + i * 520 + "px", top: "360px", width: "420px", padding: "38px 40px", boxSizing: "border-box" }));
const PRINC = [["Silent until it matters", 2.5], ["Every answer on the thing it's about", 21.5]] as const;
const princ = PRINC.map((p, i) => {
  const c = el("div", "abs glass", why, "", { left: 250 + i * 740 + "px", top: "250px", width: "680px", height: "560px", overflow: "hidden", boxSizing: "border-box" });
  const holder = el("div", "abs", c, "", { left: "0", top: "0", width: "680px", height: "440px", overflow: "hidden" });
  const im = el("img", "", holder, "", { position: "absolute", width: WIN.w * 1.0 + "px", height: WIN.h * 1.0 + "px", left: -BOX.x + (680 - BOX.w) / 2 + "px", top: -BOX.y - 120 + "px" }) as HTMLImageElement;
  im.src = storyFrame(p[1]);
  el("div", "abs h3", c, p[0], { left: "34px", top: "468px", fontWeight: "700", fontSize: "34px" });
  return c;
});

// BUILT
const built = layer();
const bHead = el("div", "abs", built, `<div class="eyebrow">Under the hood</div><div class="h2" style="margin-top:14px">Built in <span class="accent">Lens Studio</span>, by a coding agent</div>`, { left: "0", width: W + "px", top: "84px", textAlign: "center" });
const NODES = [
  ["agent", "Coding agent", "Claude Code", -560, -150, "coding"],
  ["plug", "Lens Studio MCP", "wires the scene, runs tests", -560, 150, "mcp"],
  ["ls", "Lens Studio 5.24.1", "SPECS 27 · SIK", 560, -150, "lens"],
  ["flask", "LEAF", "pinches every control", 560, 150, "leaf"],
  ["code", "One TypeScript core", "data · state · layout", 0, 300, "built"],
] as const;
const CX = 960, CY = 560;
const hubDiv = el("div", "abs", built, `<div style="font-weight:800;font-size:54px">Lumen</div><div class="eyebrow" style="font-size:14px;margin-top:6px">the Lens</div>`,
  { left: CX - 130 + "px", top: CY - 130 + "px", width: "260px", height: "260px", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 35% 30%, #59e8ff, #138aa6 70%)", boxShadow: "0 0 80px rgba(63,224,255,.55), 0 0 0 18px rgba(63,224,255,.08), 0 0 0 44px rgba(63,224,255,.04)", color: "#03121a" });
const svgNS = "http://www.w3.org/2000/svg";
const wires = document.createElementNS(svgNS, "svg");
wires.setAttribute("width", String(W)); wires.setAttribute("height", String(H));
wires.style.position = "absolute"; wires.style.left = "0"; wires.style.top = "0";
built.insertBefore(wires, hubDiv);
const nodeEls = NODES.map((n) => {
  const e = el("div", "abs glass", built, `<div style="display:flex;align-items:center;gap:20px">${icon(n[0], "#3fe0ff", 54)}<div><div style="font-weight:700;font-size:30px">${n[1]}</div><div style="font-size:19px;color:#8b97a6;margin-top:4px">${n[2]}</div></div></div>`,
    { left: CX + n[3] - 200 + "px", top: CY + n[4] - 55 + "px", width: "400px", padding: "22px 26px", boxSizing: "border-box" });
  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("x1", String(CX)); line.setAttribute("y1", String(CY));
  line.setAttribute("x2", String(CX + n[3] * 0.78)); line.setAttribute("y2", String(CY + n[4] * 0.78));
  line.setAttribute("stroke", "#3fe0ff"); line.setAttribute("stroke-width", "2.5");
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("r", "6"); dot.setAttribute("fill", "#fff");
  dot.style.filter = "drop-shadow(0 0 8px #3fe0ff)";
  wires.appendChild(line); wires.appendChild(dot);
  return { e, line, dot, n };
});
const leafTag = el("div", "abs", built, `<span class="tag">ACTUAL LEAF RUN</span><span class="h3" style="font-size:28px;margin-left:16px">Snap's LEAF tests in the Lens Studio preview · 5× speed</span>`, { left: FULL.x + "px", top: FULL.y - 66 + "px" });
const SCEN = ["test_idle_is_quiet", "test_pickup_shows_markers", "test_switch_syringe_changes_markers", "test_trace_lights_correct_line", "test_red_port_redirects",
  "test_push_logs_and_returns_idle", "test_alarm_shows_and_resolves", "test_handoff_line_check", "test_ik_reach_controls", "test_self_test_dc1_dc10"];
const tests = el("div", "abs", built, "", { left: "0", top: "0", width: W + "px", height: H + "px" });
tests.innerHTML = `<div class="abs" style="left:150px;top:300px"><div class="eyebrow">LEAF · Lens Studio preview</div>
   <div style="font-weight:800;font-size:250px;letter-spacing:-.04em;line-height:1;margin-top:20px"><span id="cnt">0</span><span style="color:#3fe0ff">/10</span></div>
   <div class="h3" style="color:#8b97a6;margin-top:10px">scenarios pass</div></div>
  <div class="abs" style="left:900px;top:190px;width:880px">${SCEN.map((s) => `<div class="trow" style="display:flex;align-items:center;gap:18px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06)">
    <div class="tick" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(61,255,122,.14)">${icon("check", "#3dff7a", 26)}</div>
    <div style="font-family:Consolas,monospace;font-size:24px;color:#dfe6ee">${s}</div><div style="margin-left:auto;font-weight:700;color:#3dff7a;font-size:20px;letter-spacing:.1em">PASS</div></div>`).join("")}</div>`;
const trows = Array.from(tests.querySelectorAll(".trow")) as HTMLElement[];
const cnt = tests.querySelector("#cnt") as HTMLElement;

// CLOSE
const close = layer();
const NEXT = [["barcode", "Barcode scan", "know the syringe"], ["line", "Line tracking", "follow the real tubes"], ["pump", "Live pump data", "rates and alarms"]] as const;
const nHead = el("div", "abs", close, `<div class="eyebrow">Next</div>`, { left: "0", width: W + "px", top: "250px", textAlign: "center" });
const nCards = NEXT.map((n, i) => el("div", "abs glass", close, `<div style="display:flex;align-items:center;gap:22px">${icon(n[0], "#3fe0ff", 62)}<div><div style="font-weight:700;font-size:32px">${n[1]}</div><div style="font-size:20px;color:#8b97a6;margin-top:4px">${n[2]}</div></div></div>`,
  { left: 210 + i * 520 + "px", top: "400px", width: "460px", padding: "30px 34px", boxSizing: "border-box" }));
const endMeta = el("div", "abs", close, `<div class="h3" style="font-size:30px;color:#c4ccd6">github.com/<span class="accent">vivekyarra/Lumen</span></div>
  <div style="margin-top:14px;font-size:21px;color:#8b97a6">Lens Studio 5.24.1 · SPECS 27 · Lens Studio MCP · LEAF 10/10 · try the web twin: vivekyarra.github.io/Lumen</div>`, { left: "0", width: W + "px", top: "840px", textAlign: "center" });

// ------------------------------------------------------------------ per-frame
function hideAll(): void { for (const c of Array.from(layers.children) as HTMLElement[]) c.style.display = "none"; }
function on(l: HTMLElement): void { l.style.display = ""; }

async function seek(t: number): Promise<void> {
  hideAll();
  canvas.style.display = "none";
  captionAt(t);

  // ---------------- HOOK (3D)
  if (inWin(t, T.hook)) {
    canvas.style.display = "";
    const k = eInOut(prog(t, 0, 8.4));
    lookCam(V(lerp(70, 18, k), lerp(205, 150, k), lerp(70, -2, k)), V(lerp(-40, -30, k), lerp(70, 86, k), lerp(-90, -58, k)));
    const view = viewAt([[4.2, (m) => m.pinchSyringe("S1")]], t);
    render3D(t, view, "scene");
    canvas.style.opacity = String(1 - eOut(prog(t, 7.9, 8.5)));
    on(hook);
    show(hook, 1 - eOut(prog(t, 7.6, 8.3)));
    show(hookTag, eOut(prog(t, 0.5, 1.2)));
    hookWord.at(t, voStart("v01"));
    hookSub.at(t, wordAt("v02", "every"), 0.1);
    // logo
    if (t > 8.2) {
      on(logo);
      const a = eOut(prog(t, 8.3, 9.1));
      show(logoWrap, a, 0, 0, lerp(0.92, 1, a));
      drawSvg(logoRing, prog(t, 8.3, 9.4));
      logoWord.style.backgroundPosition = `${lerp(100, 0, eInOut(prog(t, 8.8, 10.4)))}% 0`;
      show(logoTag, eOut(prog(t, 9.4, 10.2)));
      show(logoGlow, a * (0.7 + 0.3 * Math.sin(t * 2)));
      show(logo, 1 - eOut(prog(t, 10.8, 11.4)));
    }
  }

  // ---------------- PROBLEM (3D)
  if (inWin(t, T.problem)) {
    canvas.style.display = "";
    on(prob);
    const a = prog(t, T.problem[0], T.problem[1]);
    const ang = lerp(-0.9, 0.55, eInOut(a));
    const rad = lerp(330, 210, eInOut(prog(t, 11.4, 21)));
    const tgt = V(-30, lerp(95, 100, a), -78);
    lookCam(V(tgt.x + Math.sin(ang) * rad, lerp(230, 180, a), tgt.z + Math.cos(ang) * rad), tgt);
    const drawK: Record<LineId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    LINE_IDS.forEach((l, i) => { drawK[l] = eInOut(prog(t, 15.2 + i * 1.1, 16.9 + i * 1.1)); setDrawn(l, drawK[l]); });
    // the gloved-finger trace: a slow, uncertain dot along line 2
    const tr = prog(t, 30.2, 36.5);
    if (tr > 0 && tr < 1) {
      const c = curves[2]; const p = pointAtLength(c, c.totalLength * (1 - (tr * 0.75 + 0.05 * Math.sin(tr * 25))));
      heads[2].position.copy(toThree(p)); heads[2].visible = true; heads[2].scale.setScalar(1.6);
    } else heads[2].scale.setScalar(1);
    const quiet = viewAt([], t);
    render3D(t, quiet, "draw");
    canvas.style.opacity = String(Math.min(eOut(prog(t, 11.4, 12.4)), 1 - eOut(prog(t, 37.6, 38.2))));
    show(maya, win(t, 11.8, 20.6, 0.6, 0.5), 0, (1 - eOut(prog(t, 11.8, 12.6))) * 20);
    LINE_IDS.forEach((l) => {
      const pump = toThree(L.PUMPS[LINES[l].pump].center);
      const pr = project(pump.clone().add(V(-6, 0, 0)));
      const o = win(t, 16.0 + (l - 1) * 1.1, 20.6, 0.5, 0.5);
      tags[l].style.left = pr.x - 260 + "px"; tags[l].style.top = pr.y - 22 + "px";
      show(tags[l], pr.ok ? o : 0, (1 - eOut(prog(t, 16 + (l - 1) * 1.1, 16.6 + (l - 1) * 1.1))) * -30);
    });
    tallyRows.forEach((r, i) => show(r, win(t, 15.2 + i * 1.8, 20.6), (1 - eOut(prog(t, 15.2 + i * 1.8, 15.9 + i * 1.8))) * 40));
    show(tally, 1);
    show(dim, win(t, 20.7, 29.7, 0.6, 0.6));
    show(q0.box, win(t, 20.9, 29.6)); q0.at(t, voStart("v06"), 0.06);
    show(q1.box, win(t, 24.7, 29.6)); q1.at(t, voStart("v07"), 0.1);
    show(q2.box, win(t, 26.4, 29.6)); q2.at(t, voStart("v08"), 0.07);
    show(today, win(t, 29.9, 37.9), (1 - eOut(prog(t, 29.9, 30.6))) * -30);
    const ck = prog(t, wordAt("v09", "checks"), wordAt("v09", "checks") + 1.6);
    show(chart, win(t, 31.2, 37.9) * (1 - 0.55 * eInOut(ck)), lerp(0, 420, eInOut(ck)), lerp(0, -120, eInOut(ck)), lerp(1, 0.55, eInOut(ck)), 4 * eInOut(ck));
    show(shift, win(t, wordAt("v09", "many") - 0.1, 37.9));
    show(shiftTxt, 1);
    ticks.forEach((d, i) => { const kk = eOut(prog(t, wordAt("v09", "many") + i * 0.11, wordAt("v09", "many") + i * 0.11 + 0.25)); d.style.opacity = String(kk); d.style.transform = `scaleY(${kk})`; });
  }

  // ---------------- REVEAL → zoom into the SPECS view (real footage)
  if (inWin(t, T.reveal)) {
    on(rev);
    const titleO = win(t, 38.3, 40.6, 0.4, 0.5);
    show(revTitle.box, titleO, 0, 0, lerp(1, 0.9, eInOut(prog(t, 39.8, 40.6))));
    revTitle.at(t, voStart("v10"), 0.1);
    show(revSub, win(t, wordAt("v10", "lens") - 0.1, 40.6, 0.4, 0.4));
    show(appTag, 0); calls.forEach((c) => show(c.e, 0)); show(boxFrame, 0); show(boxTag, 0);
    const fk = eOut(prog(t, 40.3, 41.6));                  // fly in
    const zk = eInOut(prog(t, 43.5, DEMO0));                // zoom to the SPECS box
    if (t > 40.2) {
      on(fl);
      await setFootage(storyFrame(Math.max(HOLD, t - DEMO0)));
      const s = lerp(FULL.s, ZOOM.s, zk), x = lerp(FULL.x, ZOOM.x, zk), y = lerp(FULL.y, ZOOM.y, zk);
      footWrap.style.perspective = "1600px";
      placeWin(s * lerp(0.8, 1, fk), x + (1 - fk) * 160, y + (1 - fk) * 140, (1 - fk) * 24);
      footWrap.style.opacity = String(fk);
      footImg.style.boxShadow = `0 40px 120px rgba(0,0,0,.6), 0 0 0 1px rgba(63,224,255,${0.25 * (1 - zk)})`;
      const bx = BOX.x * s + x, by = BOX.y * s + y;
      Object.assign(boxFrame.style, { left: bx + "px", top: by + "px", width: BOX.w * s + "px", height: BOX.h * s + "px" });
      show(boxFrame, eOut(prog(t, 42.6, 43.4)));
      show(boxTag, 0);
      // dim everything outside the SPECS box as we dive in
      footImg.style.filter = `brightness(${lerp(1, 0.35, zk)})`;
      show(appTag, win(t, 41.3, 43.6, 0.4, 0.3), 0, (1 - eOut(prog(t, 41.3, 41.8))) * 16);
      calls.forEach((c, i) => show(c.e, win(t, 41.9 + i * 0.35, 43.6, 0.35, 0.3), 0, (1 - eOut(prog(t, 41.9 + i * 0.35, 42.4 + i * 0.35))) * 14));
    }
  }

  // ---------------- DEMO (real footage, SPECS view)
  if (inWin(t, T.demo)) {
    const st = t - DEMO0;
    on(fl); on(demo);
    await setFootage(storyFrame(Math.min(Math.max(HOLD, st), 56.5)));
    placeWin(ZOOM.s, ZOOM.x, ZOOM.y);
    footWrap.style.opacity = "1";
    footImg.style.boxShadow = "none";
    // only the SPECS box stays lit: clip with a rounded mask
    footImg.style.filter = "";
    footWrap.style.clipPath = `inset(40px ${W - (ZOOM.x + (BOX.x + BOX.w) * ZOOM.s)}px ${H - 1040}px ${ZOOM.x + BOX.x * ZOOM.s}px round 26px)`;
    Object.assign(boxFrame.style, { left: ZOOM.x + BOX.x * ZOOM.s + "px", top: "40px", width: BOX.w * ZOOM.s + "px", height: "1000px" });
    show(boxFrame, 1);
    Object.assign(boxTag.style, { left: ZOOM.x + BOX.x * ZOOM.s + 26 + "px", top: "62px" });
    show(boxTag, win(t, DEMO0 + 0.3, T.demo[1], 0.6, 0.5));
    const sideIn = eOut(prog(st, 0.1, 1.0)), sideOut = 1 - eOut(prog(t, T.demo[1] - 0.6, T.demo[1]));
    show(rail, sideIn * sideOut, (1 - sideIn) * -60);
    show(state, sideIn * sideOut, (1 - sideIn) * 60);
    let cur = 0; STEPS.forEach((s, i) => { if (st >= s[1]) cur = i; });
    stepEls.forEach((e, i) => {
      const n = e.querySelector(".num") as HTMLElement, l = e.querySelector(".lbl") as HTMLElement;
      const act = i === cur, done = i < cur;
      const pulse = act ? 0.5 + 0.5 * Math.sin(st * 4) : 0;
      n.style.background = act ? "rgba(63,224,255,.18)" : done ? "rgba(61,255,122,.12)" : "transparent";
      n.style.borderColor = act ? "#3fe0ff" : done ? "rgba(61,255,122,.6)" : "rgba(255,255,255,.14)";
      n.style.color = act ? "#3fe0ff" : done ? "#3dff7a" : "#5d6876";
      n.style.boxShadow = act ? `0 0 ${18 + 14 * pulse}px rgba(63,224,255,.5)` : "none";
      l.style.color = act ? "#f4f7fa" : done ? "#9aa6b4" : "#5d6876";
    });
    held.textContent = st >= 5.0 ? "Furosemide 40 mg" : "—";
    held.style.color = st >= 5.0 ? "#3fe0ff" : "#5d6876";
    const verdict = ["ok", "bad", "bad", "ok"];
    badges.forEach((b, i) => {
      const k = eBack(prog(st, 5.3 + i * 0.12, 5.75 + i * 0.12));
      const v = st >= 5.3 ? verdict[i] : "idle";
      b.innerHTML = v === "ok" ? "✓" : v === "bad" ? "✕" : "·";
      b.style.color = v === "ok" ? "#3dff7a" : v === "bad" ? "#ff4d4d" : "#5d6876";
      b.style.borderColor = v === "ok" ? "rgba(61,255,122,.7)" : v === "bad" ? "rgba(255,77,77,.7)" : "rgba(255,255,255,.14)";
      b.style.background = v === "ok" ? "rgba(61,255,122,.12)" : v === "bad" ? "rgba(255,77,77,.12)" : "transparent";
      b.style.transform = `scale(${v === "idle" ? 1 : lerp(0.4, 1, k)})`;
    });
    rows.forEach((r, i) => {
      const focus = (i === 1 && st >= 13.6 && st < 25) || (i === 0 && st >= 25 && st < 30.6);
      r.style.background = focus ? "rgba(63,224,255,.08)" : "transparent";
      r.style.borderRadius = "12px"; r.style.margin = "0 -12px"; r.style.padding = "12px";
      r.style.boxShadow = focus ? "inset 0 0 0 1.5px rgba(63,224,255,.5)" : "none";
    });
    const events: [number, string, string][] = [
      [0, "Quiet. Nothing to say.", "#8b97a6"], [5.0, "Every port checked against the syringe.", "#f4f7fa"],
      [13.6, "Port B → Pump 1 · Midazolam. Use Distal.", "#ff8a8a"], [25.0, "Distal: compatible. Push here.", "#3dff7a"],
      [27.3, "Logged · CVC Distal. Quiet again.", "#3dff7a"], [31.3, "Pump 2 · downstream occlusion.", "#ffb020"],
      [42.5, "Kink resolved.", "#3dff7a"], [45.0, "Handoff: lines checked 1 of 4", "#3fe0ff"], [47.5, "Handoff: lines checked 2 of 4", "#3fe0ff"],
      [50.0, "Handoff: lines checked 3 of 4", "#3fe0ff"], [52.5, "Lines checked · 4 of 4", "#3dff7a"],
    ];
    let ev = events[0]; for (const e of events) if (st >= e[0]) ev = e;
    evt.textContent = ev[1]; evt.style.color = ev[2];
    evt.style.opacity = String(eOut(prog(st, ev[0], ev[0] + 0.4)));
    const om = win(st, 30.7, 32.8, 0.3, 0.4);
    show(omt, om, 0, 0, lerp(1.06, 1, eOut(prog(st, 30.7, 31.4))));
    footImg.style.filter = om > 0 ? `brightness(${1 - 0.55 * om})` : "";
  } else {
    footWrap.style.clipPath = "";
  }

  // ---------------- WHY GLASSES
  if (inWin(t, T.why)) {
    on(why);
    whyImg.src = storyFrame(lerp(14, 22, prog(t, 98.4, 115.4)));
    show(whyBg, win(t, 98.4, 115.4, 0.6, 0.5));
    show(whyGlasses, win(t, 98.5, 100.9, 0.3, 0.4), 0, 0, 1);
    drawSvg(whyGlasses, prog(t, 98.5, 99.7));
    show(whyHead.box, win(t, 98.5, 100.9, 0.3, 0.4)); whyHead.at(t, voStart("v22"), 0.09);
    const pt = [wordAt("v23", "sees"), wordAt("v23", "draws"), wordAt("v23", "hands")];
    pillars.forEach((p, i) => {
      const k = eOut(prog(t, pt[i] - 0.25, pt[i] + 0.45));
      show(p, Math.min(k, 1 - eOut(prog(t, 108.4, 108.9))), 0, (1 - k) * 60);
      drawSvg(p, prog(t, pt[i] - 0.2, pt[i] + 1.0));
    });
    const p2 = [wordAt("v24", "silent") - 0.2, wordAt("v24", "every") - 0.2];
    princ.forEach((c, i) => { const k = eOut(prog(t, p2[i], p2[i] + 0.6)); show(c, Math.min(k, 1 - eOut(prog(t, 114.9, 115.4))), 0, (1 - k) * 50, lerp(0.96, 1, k)); });
  }

  // ---------------- BUILT
  if (inWin(t, T.built)) {
    on(built);
    const dg = win(t, 115.4, 121.3, 0.5, 0.5);
    show(bHead, dg, 0, (1 - eOut(prog(t, 115.4, 116))) * -20);
    show(hubDiv, dg, 0, 0, lerp(0.6, 1, eBack(prog(t, 115.5, 116.3))));
    const when = [wordAt("v25", "coding"), wordAt("v25", "mcp") - 0.2, wordAt("v25", "lens"), wordAt("v25", "leaf"), wordAt("v25", "built") + 0.2];
    nodeEls.forEach((n, i) => {
      const k = eOut(prog(t, when[i] - 0.2, when[i] + 0.4));
      show(n.e, Math.min(k, dg), 0, (1 - k) * 24);
      const lk = eInOut(prog(t, when[i] - 0.1, when[i] + 0.5));
      n.line.setAttribute("x2", String(CX + n.n[3] * 0.78 * lk)); n.line.setAttribute("y2", String(CY + n.n[4] * 0.78 * lk));
      n.line.setAttribute("opacity", String(0.75 * Math.min(1, dg * 1.2)));
      const ph = ((t * 0.7 + i * 0.23) % 1);
      n.dot.setAttribute("cx", String(CX + n.n[3] * 0.78 * ph)); n.dot.setAttribute("cy", String(CY + n.n[4] * 0.78 * ph));
      n.dot.setAttribute("opacity", String(lk >= 1 ? dg : 0));
    });
    wires.style.display = dg > 0 ? "" : "none";
    // real LEAF run footage
    const lf = win(t, 121.2, 125.5, 0.5, 0.4);
    if (lf > 0) {
      on(fl);
      const src = 4.6 + (t - 121.2) * 5;
      await setFootage(leafFrame(src));
      footWrap.style.perspective = ""; footWrap.style.opacity = String(lf); footWrap.style.clipPath = "";
      const zk = eInOut(prog(t, 122.0, 123.2));
      const s = lerp(FULL.s, 1.55, zk), x = lerp(FULL.x, 960 - 1150 * 1.55, zk), y = lerp(FULL.y, 300 - 230 * 1.55, zk);
      placeWin(s, x, y);
      footImg.style.filter = ""; footImg.style.boxShadow = "0 40px 120px rgba(0,0,0,.6)";
      show(boxFrame, 0); show(boxTag, 0);
      show(leafTag, lf);
    } else show(leafTag, 0);
    const tk = prog(t, 125.4, 128.0);
    show(tests, win(t, 125.3, 129.6, 0.4, 0.4));
    let n = 0;
    trows.forEach((r, i) => { const k = eOut(prog(t, 125.5 + i * 0.22, 125.85 + i * 0.22)); if (k > 0.5) n++; show(r, k, (1 - k) * 40); });
    cnt.textContent = String(n);
    void tk;
  }

  // ---------------- CLOSE
  if (inWin(t, T.close)) {
    on(close);
    show(nHead, win(t, 129.7, 135.0, 0.4, 0.4));
    const wt = [wordAt("v27", "barcode"), wordAt("v27", "real"), wordAt("v27", "live")];
    nCards.forEach((c, i) => { const k = eOut(prog(t, wt[i] - 0.2, wt[i] + 0.4)); show(c, Math.min(k, 1 - eOut(prog(t, 134.6, 135.1))), 0, (1 - k) * 40); drawSvg(c, prog(t, wt[i] - 0.1, wt[i] + 0.9)); });
    if (t > 134.9) {
      on(logo);
      const a = eOut(prog(t, 135.0, 135.9));
      show(logoWrap, a, 0, -40, lerp(0.94, 1, a));
      drawSvg(logoRing, prog(t, 135.0, 136.2));
      logoWord.style.backgroundPosition = `${lerp(100, 0, eInOut(prog(t, 135.4, 137.2)))}% 0`;
      // tagline lands phrase by phrase with the voice
      const tw = [wordAt("v28", "right"), wordAt("v28", "safe"), wordAt("v28", "where")];
      const parts = ["The right line.", "The safe port.", "Where you look."];
      logoTag.innerHTML = parts.map((p, i) => `<span style="opacity:${eOut(prog(t, tw[i] - 0.2, tw[i] + 0.3))};${i === 2 ? "color:#3fe0ff" : ""}">${p}</span>`).join(" ");
      show(logoTag, 1);
      show(logoGlow, a * (0.7 + 0.3 * Math.sin(t * 2)));
      show(endMeta, eOut(prog(t, 138.6, 139.4)));
      show(logo, 1 - eOut(prog(t, DURATION - 1.2, DURATION)));
      show(close, 1);
    }
    show(endMeta, Math.min(eOut(prog(t, 138.6, 139.4)), 1 - eOut(prog(t, DURATION - 1.2, DURATION))));
  }
}

async function init(): Promise<void> {
  voice = await (await fetch("/data/voice.json")).json();
  buildCaptions();
  await document.fonts.ready;
}

(window as any).film = { init, seek, duration: DURATION, fps: FPS, voAt: (id: string) => voStart(id), demo0: DEMO0 };
