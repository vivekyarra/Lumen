// Lumen web preview: a browser twin of the Lens Studio preview, driven by the same Core.
// Controls: WASD move · Q/E down/up · drag to look · click = pinch · F = SPECS FOV · H = hide help.
import * as THREE from "three";
import * as L from "../../Assets/Lumen/Core/LumenLayout";
import { LumenEvent, LumenStateMachine, invariantViolations } from "../../Assets/Lumen/Core/LumenState";
import { PortId, SyringeId } from "../../Assets/Lumen/Core/LumenData";
import { CueId } from "../../Assets/Lumen/Core/SoundSynth";
import { Driver, SCENARIOS, SceneProbe, runScenarios } from "../../Assets/Lumen/Core/Scenarios";
import { SPECS_FOV, boxesOverlap, LabelBox } from "../../Assets/Lumen/Core/ViewMath";
import { toThree } from "./coords";
import { LumenWorld } from "./world";
import { SpatialAudio } from "./audio";
import { luminance } from "./palette";
import { STORY_LENGTH, StoryAction, TITLE, captionAt, cuesBetween, lookAtTime } from "./story";

// Deterministic text metrics on every machine: wait for the bundled Inter before drawing any label.
try {
  await document.fonts.load('600 40px "Inter"');
} catch {
  // fall back to system fonts
}

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has("test");

// ---------------- renderer, camera, room ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("app")!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3138);
scene.fog = new THREE.Fog(0x2b3138, 400, 900);
const camera = new THREE.PerspectiveCamera(50, 1, 5, 2000);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(-100, 300, 150);
scene.add(sun);
// "Real room" stand-in (not Lens content): floor grid.
const grid = new THREE.GridHelper(800, 40, 0x56606b, 0x3d454e);
scene.add(grid);

const world = new LumenWorld(camera);
scene.add(world.root);
const audio = new SpatialAudio();

// ---------------- time ----------------
let lensTime = 0;
let lastReal = performance.now() / 1000;
let sm = makeMachine();

function makeMachine(): LumenStateMachine {
  const m = new LumenStateMachine(L.PORT_POS, undefined, lensTime);
  m.onEvent(onEvent);
  return m;
}

let alarmActiveSince = -1;
function onEvent(e: LumenEvent): void {
  const at = (p: { r: number; f: number; u: number }) => toThree(p);
  const cue = (id: CueId, p: { r: number; f: number; u: number }) => audio.play(id, at(p), lensTime);
  switch (e.type) {
    case "syringePicked": cue("tick", L.SYRINGE_LAYOUT[e.syringe].center); break;
    case "markersShown": cue("markers", L.CART_TEXT.chip.anchor); break;
    case "portFocusedRed": cue("red", L.PORT_POS[e.port]); break;
    case "portFocusedGreen": cue("green", L.PORT_POS[e.port]); break;
    case "pushConfirmed": cue("confirm", L.PORT_POS[e.port]); break;
    case "alarmStarted": alarmActiveSince = lensTime; break;
    case "alarmBeep": cue("alarm", L.PUMPS[e.pump].center); break;
    case "alarmResolved": alarmActiveSince = -1; cue("resolved", L.KINK_POS); break;
    case "handoffStep": cue("tick", L.PUMPS[e.line].center); break;
    case "handoffEnded": if (e.reason === "done") cue("markers", L.CART_TEXT.log.anchor); break;
    default: break;
  }
  if (e.type !== "alarmBeep") eventLog.push(`${lensTime.toFixed(2)} ${e.type}`);
}
const eventLog: string[] = [];

// ---------------- camera pose + controls ----------------
let yaw = 0;
let pitch = 0;
const eye = toThree(L.START_EYE);

function setLook(target: { r: number; f: number; u: number }): void {
  const d = toThree(target).sub(camera.position).normalize();
  pitch = Math.asin(d.y);
  yaw = Math.atan2(-d.x, -d.z);
  applyPose();
}

function applyPose(): void {
  camera.rotation.order = "YXZ";
  camera.rotation.set(pitch, yaw, 0);
  camera.updateMatrixWorld(true);
}

function resetCamera(): void {
  camera.position.copy(eye);
  setLook(L.WORK_TARGET);
}
resetCamera();

let specsFov = params.has("specs");
function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  if (specsFov) {
    camera.fov = SPECS_FOV.v;
    camera.aspect = Math.tan(((SPECS_FOV.h / 2) * Math.PI) / 180) / Math.tan(((SPECS_FOV.v / 2) * Math.PI) / 180);
    // letterbox to the SPECS aspect
    const vw = Math.min(w, h * camera.aspect);
    const vh = vw / camera.aspect;
    renderer.setViewport((w - vw) / 2, (h - vh) / 2, vw, vh);
    renderer.setScissor((w - vw) / 2, (h - vh) / 2, vw, vh);
    renderer.setScissorTest(true);
  } else {
    camera.fov = 50;
    camera.aspect = w / h;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
  }
  camera.updateProjectionMatrix();
  const frame = document.getElementById("specs-frame")!;
  // Outline of the SPECS display area inside the wide view.
  if (!specsFov) {
    const fx = Math.tan(((SPECS_FOV.h / 2) * Math.PI) / 180) / Math.tan(((camera.fov / 2) * Math.PI) / 180) / camera.aspect;
    const fy = Math.tan(((SPECS_FOV.v / 2) * Math.PI) / 180) / Math.tan(((camera.fov / 2) * Math.PI) / 180);
    frame.style.width = `${fx * 100}%`;
    frame.style.height = `${fy * 100}%`;
    frame.style.display = params.has("noframe") ? "none" : "block";
  } else {
    frame.style.display = "none";
  }
}
window.addEventListener("resize", resize);
resize();

const keys = new Set<string>();
let dragging = false;
let dragDist = 0;
let lastX = 0;
let lastY = 0;
const canvas = renderer.domElement;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  dragDist = 0;
  lastX = e.clientX;
  lastY = e.clientY;
  audio.unlock();
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  dragDist += Math.abs(dx) + Math.abs(dy);
  lastX = e.clientX;
  lastY = e.clientY;
  if (dragDist > 4) {
    yaw -= dx * 0.004;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * 0.004));
    applyPose();
  }
});
window.addEventListener("pointerup", (e) => {
  if (dragging && dragDist <= 4) pinchAt(e.clientX, e.clientY);
  dragging = false;
});
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === "a" && e.shiftKey) sm.debugTriggerAlarm(); // hidden debug trigger (spec: key A); Shift avoids clashing with WASD
  if (k === "f") { specsFov = !specsFov; resize(); }
  if (k === "h") document.body.classList.toggle("clean");
  if (k === "r") { storyStart = -1; document.body.classList.remove("story"); api.reset(); }
  if (k === "p") startStory();
  if (k === "m") audio.muted = !audio.muted;
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const raycaster = new THREE.Raycaster();
function pinchAt(clientX: number, clientY: number): string {
  const rect = canvas.getBoundingClientRect();
  const vp = new THREE.Vector4();
  renderer.getViewport(vp);
  const x = ((clientX - rect.left - vp.x) / vp.z) * 2 - 1;
  const y = -(((clientY - rect.top - (rect.height - vp.y - vp.w)) / vp.w) * 2 - 1);
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const hit = world.pick(raycaster, sm.view());
  if (!hit) { sm.pinchEmpty(); return "empty"; }
  switch (hit.kind) {
    case "syringe": sm.pinchSyringe(hit.id); return "syringe." + hit.id;
    case "port": sm.pinchPort(hit.id); return "port." + hit.id;
    case "push": sm.pinchPush(); return "push";
    case "resolved": sm.pinchResolved(); return "resolved";
    case "chip": sm.pinchChip(); return "chip";
    case "pole": sm.pinchPole(); return "pole";
  }
}

function moveCamera(dt: number): void {
  const speed = 80; // cm/s
  const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const d = new THREE.Vector3();
  if (keys.has("w")) d.add(f);
  if (keys.has("s")) d.sub(f);
  if (keys.has("d")) d.add(r);
  if (keys.has("a")) d.sub(r);
  if (keys.has("e")) d.y += 1;
  if (keys.has("q")) d.y -= 1;
  if (d.lengthSq() > 0) {
    camera.position.addScaledVector(d.normalize(), speed * dt);
    camera.updateMatrixWorld(true);
  }
}

// ---------------- frame ----------------
/** Bring the scene graph up to date with the state without drawing (cheap; used by the probe). */
function sync(): void {
  world.render(sm.view(), lensTime, camera);
  scene.updateMatrixWorld(true);
}

// ---------------- story mode ----------------
let storyStart = -1;
let storyT = -1;
const captionEl = document.getElementById("caption")!;
const titleEl = document.getElementById("title-card")!;
const pinchEl = document.getElementById("pinch")!;

function storyDo(a: StoryAction): void {
  const target = a.kind === "syringe" ? "syringe." + a.id : a.kind === "port" ? "port." + a.id : a.kind;
  switch (a.kind) {
    case "syringe": sm.pinchSyringe(a.id); break;
    case "port": sm.pinchPort(a.id); break;
    case "push": sm.pinchPush(); break;
    case "resolved": sm.pinchResolved(); break;
    case "pole": sm.pinchPole(); break;
  }
  // Show where the pinch landed (story mode only), animated in story time so recordings are exact.
  pinchTarget = target;
  pinchStartedAt = lensTime;
}

let pinchTarget = "";
let pinchStartedAt = -1;
function updatePinchRing(): void {
  const k = pinchStartedAt < 0 ? 1 : (lensTime - pinchStartedAt) / 0.7;
  if (k >= 1 || !pinchTarget) {
    pinchEl.style.opacity = "0";
    return;
  }
  const p = api.screenPoint(pinchTarget);
  if (!p) return;
  const scale = k < 0.4 ? 1.4 - (k / 0.4) * 0.85 : 0.55 + ((k - 0.4) / 0.6) * 0.35;
  pinchEl.style.left = p.x + "px";
  pinchEl.style.top = p.y + "px";
  pinchEl.style.opacity = String(k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6);
  pinchEl.style.transform = "scale(" + scale + ")";
}

function startStory(): void {
  api.reset();
  audio.unlock();
  storyStart = lensTime;
  storyT = 0;
  document.body.classList.add("clean", "story");
}

function updateStory(): void {
  if (storyStart < 0) return;
  const t = lensTime - storyStart;
  const due = cuesBetween(storyT, t);
  storyT = t;
  for (const a of due) storyDo(a);
  camera.position.copy(eye);
  setLook(lookAtTime(t));
  const cap = captionAt(t);
  captionEl.textContent = cap || "";
  captionEl.style.opacity = cap ? "1" : "0";
  updatePinchRing();
  titleEl.style.opacity = t >= TITLE.from ? String(Math.min(1, (t - TITLE.from) / 0.8)) : "0";
  if (t > STORY_LENGTH) {
    storyStart = -1;
    titleEl.style.opacity = "0";
    captionEl.style.opacity = "0";
    document.body.classList.remove("story");
  }
}

function frame(): void {
  world.render(sm.view(), lensTime, camera);
  audio.updateListener(camera);
  renderer.render(scene, camera);
}

function loop(): void {
  const now = performance.now() / 1000;
  const real = now - lastReal;
  lastReal = now;
  if (!TEST_MODE) {
    // Lens time follows the wall clock even on slow GPUs (the state machine handles big steps);
    // only camera motion is clamped so a hitch never teleports the viewer.
    lensTime += Math.min(real, 2);
    if (storyStart < 0) moveCamera(Math.min(real, 0.1));
    sm.update(lensTime);
    updateStory();
  }
  frame();
  requestAnimationFrame(loop);
}

// ---------------- probe (rendered-scene checks) ----------------
function specsCamera(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(SPECS_FOV.v, Math.tan(((SPECS_FOV.h / 2) * Math.PI) / 180) / Math.tan(((SPECS_FOV.v / 2) * Math.PI) / 180), 1, 2000);
  c.position.copy(camera.position);
  c.quaternion.copy(camera.quaternion);
  c.updateMatrixWorld(true);
  return c;
}

function shown(o: THREE.Object3D): boolean {
  let x: THREE.Object3D | null = o;
  while (x) { if (!x.visible) return false; x = x.parent; }
  return true;
}

function labelBoxes(): LabelBox[] {
  sync();
  const c = specsCamera();
  const out: LabelBox[] = [];
  for (const { id, label } of world.uiLabels) {
    const o = label.object;
    if (!shown(o) || label.text === null) continue;
    const g = (o as THREE.Mesh).geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, behind = false;
    for (const [x, y] of [[bb.min.x, bb.min.y], [bb.max.x, bb.min.y], [bb.min.x, bb.max.y], [bb.max.x, bb.max.y]]) {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(o.matrixWorld);
      const vc = v.clone().applyMatrix4(c.matrixWorldInverse);
      if (vc.z > 0) behind = true;
      v.project(c);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    if (behind || maxX < -1 || minX > 1 || maxY < -1 || minY > 1) continue; // not in the SPECS view
    out.push({ id, minX, maxX, minY, maxY });
  }
  return out;
}

const probe: SceneProbe = {
  visible(key, index) {
    sync();
    switch (key) {
      case "port.idleDot": return shown(world.ports[index as PortId].dot);
      case "port.ring": return shown(world.ports[index as PortId].ring);
      case "line.glow": return shown(world.lines[Number(index) as 1].glow);
      case "line.amber": { const a = world.lines[Number(index) as 1].amber; return !!a && shown(a); }
      case "pump.alarm": return shown(world.alarmPump);
      case "kink.ring": return shown(world.kinkRing);
      case "button.push": return shown(world.push);
      case "button.resolved": return shown(world.resolved);
      case "redirect.arrow": return shown(world.redirect) && world.redirect.children.length > 0;
      case "edgeArrow": return shown(world.edgeArrowMesh);
      case "chip": return shown(world.chip.object);
      case "log": return shown(world.log.object);
    }
  },
  text(key) {
    sync();
    const pick = (l: { text: string | null; object: THREE.Object3D }) => (shown(l.object) ? l.text : null);
    if (key.startsWith("port.")) return pick(world.ports[key.slice(5) as PortId].label);
    if (key.startsWith("pump.")) return pick(world.pumpLabels[Number(key.slice(5)) as 1]);
    if (key === "chip") return pick(world.chip);
    if (key === "log") return pick(world.log);
    if (key === "notice") return sm.view().noticeText ? pick(world.hint) : null;
    if (key === "kink") return pick(world.kinkLabel);
    if (key === "pumpAlarm") return pick(world.alarmText);
    if (key === "redirect") {
      const v = sm.view();
      return v.redirect && shown(world.redirect) ? pick(world.ports[v.redirect.to].label) : null;
    }
    return null;
  },
  lookAtHub() { camera.position.copy(eye); setLook(L.HUB_TARGET); sync(); },
  lookAtCart() { camera.position.copy(eye); setLook(L.CART_TARGET); sync(); },
  overlappingLabels() {
    const b = labelBoxes();
    const out: string[] = [];
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (boxesOverlap(b[i], b[j])) out.push(`${b[i].id}|${b[j].id}`);
    return out;
  },
  minUiDistanceCm() {
    sync();
    let min = Infinity;
    const p = new THREE.Vector3();
    world.overlay.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || !shown(o)) return;
      const mat = (o as THREE.Mesh).material as THREE.Material;
      if (!mat.visible) return;
      const g = (o as THREE.Mesh).geometry;
      g.computeBoundingSphere();
      p.copy(g.boundingSphere!.center).applyMatrix4(o.matrixWorld);
      min = Math.min(min, p.distanceTo(camera.position));
    });
    if (shown(world.edgeArrowMesh)) min = Math.min(min, 100);
    return min;
  },
  darkContentCount() {
    sync();
    let n = 0;
    world.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (!m || !shown(o) || !m.visible || m.map) return;
      if (m.color && luminance(m.color.getHex()) < 0.15) n++;
    });
    return n;
  },
  alarmSoundPlaying() {
    const last = audio.lastPlayedAt("alarm");
    return sm.isAlarmActive() && last !== null && lensTime - last <= 1.25;
  },
};

// ---------------- test / automation API ----------------
function step(sec: number): void {
  // Step in 1/30 s frames but land exactly on start + sec (summing 1/30 drifts below timer deadlines).
  const end = lensTime + sec;
  while (lensTime < end) {
    lensTime = Math.min(lensTime + 1 / 30, end);
    sm.update(lensTime);
  }
  frame();
}

const driver: Driver = {
  reset: () => api.reset(),
  pinchSyringe: (id: SyringeId) => { sm.pinchSyringe(id); frame(); },
  pinchPort: (id: PortId) => { sm.pinchPort(id); frame(); },
  pinchPush: () => { sm.pinchPush(); frame(); },
  pinchResolved: () => { sm.pinchResolved(); frame(); },
  pinchEmpty: () => { sm.pinchEmpty(); frame(); },
  pinchPole: () => { sm.pinchPole(); frame(); },
  triggerAlarm: () => { sm.debugTriggerAlarm(); frame(); },
  wait: (s: number) => step(s),
  view: () => sm.view(),
  probe: probe,
};

const api = {
  /** Story mode: start (deterministic), and advance one recording frame. */
  startStory: () => startStory(),
  storyFrame: (dt: number) => {
    const end = lensTime + dt;
    while (lensTime < end) {
      lensTime = Math.min(lensTime + 1 / 120, end);
      sm.update(lensTime);
      updateStory();
    }
    frame();
    return storyStart >= 0 ? lensTime - storyStart : -1;
  },
  storyLength: STORY_LENGTH,
  storyStartTime: () => storyStart,
  cueLog: () => audio.cueLog.slice(),
  reset(): void {
    lensTime += 100; // new session, fresh timers
    sm = makeMachine();
    audio.reset();
    alarmActiveSince = -1;
    eventLog.length = 0;
    resetCamera();
    frame();
  },
  driver,
  probe,
  view: () => sm.view(),
  step,
  events: () => eventLog.slice(),
  lookAt: (t: { r: number; f: number; u: number }) => { camera.position.copy(eye); setLook(t); frame(); },
  setPose: (yawDeg: number, pitchDeg: number, pos?: { r: number; f: number; u: number }) => {
    if (pos) camera.position.copy(toThree(pos));
    yaw = (-yawDeg * Math.PI) / 180;
    pitch = (pitchDeg * Math.PI) / 180;
    applyPose();
    frame();
  },
  /** Real-click helper: CSS pixel position of a target ("port.A", "syringe.S1", "push", "resolved"). */
  screenPoint: (target: string) => {
    frame();
    const vp = new THREE.Vector4();
    renderer.getViewport(vp);
    const p = world.screenPoint(target, camera, vp.z, vp.w);
    if (!p) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + vp.x + p.x, y: rect.top + (rect.height - vp.y - vp.w) + p.y };
  },
  runScenarios: (only?: string[]) => runScenarios(driver, only),
  invariants: () => invariantViolations(sm.view()),
  pinchAt: (x: number, y: number) => pinchAt(x, y),
  sceneObjectCount: () => { let n = 0; scene.traverse(() => n++); return n; },
  scenarioIds: SCENARIOS.map((s) => s.id),
  alarmActiveSince: () => alarmActiveSince,
};
(window as unknown as { lumen: typeof api }).lumen = api;

if (TEST_MODE) document.body.classList.add("clean");
if (params.has("story") && !TEST_MODE) startStory();
document.getElementById("play")!.addEventListener("click", (e) => { e.stopPropagation(); startStory(); });
frame();
requestAnimationFrame(loop);
