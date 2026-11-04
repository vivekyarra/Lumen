// Builds the virtual ICU bedside and the Lumen overlay from the shared Core, and renders a LumenView.
import * as THREE from "three";
import * as L from "../../Assets/Lumen/Core/LumenLayout";
import * as M from "../../Assets/Lumen/Core/MeshGen";
import {
  DEMO_DATA_LABEL, LINE_IDS, LINES, LineId, PORT_IDS, PortId, PumpId, SYRINGE_IDS, SyringeId, SYRINGES, TIMING,
} from "../../Assets/Lumen/Core/LumenData";
import * as S from "../../Assets/Lumen/Core/Strings";
import { LumenView } from "../../Assets/Lumen/Core/LumenState";
import { SampledCurve, pointAtLength, sampleCurve, slice } from "../../Assets/Lumen/Core/Curves";
import { Pose, SPECS_FOV, billboardAxes, edgeArrow } from "../../Assets/Lumen/Core/ViewMath";
import { V3, add, normalize, sub, v3 } from "../../Assets/Lumen/Core/Vec";
import { billboardGeometry, fromThree, toThree, worldGeometry } from "./coords";
import { COLORS, CSS } from "./palette";
import { Label, makeLabel } from "./labels";

type Hit =
  | { kind: "syringe"; id: SyringeId }
  | { kind: "port"; id: PortId }
  | { kind: "push" }
  | { kind: "resolved" }
  | { kind: "chip" }
  | { kind: "pole" };

function lit(color: number, opacity?: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: color });
  if (opacity !== undefined && opacity < 1) {
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
  }
  return m;
}

function glow(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

function flat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
}

/** Overlay UI (markers, buttons, arrows) draws on top of the scene, like a display over the real world. */
function ui(color: number, opacity: number): THREE.MeshBasicMaterial {
  const m = glow(color, opacity);
  m.depthTest = false;
  return m;
}

function hitMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial();
  m.visible = false;
  return m;
}

interface PortVis {
  dot: THREE.Mesh;
  ring: THREE.Group;
  ringMat: THREE.MeshBasicMaterial;
  check: THREE.Mesh;
  cross: THREE.Mesh;
  pulse: THREE.Mesh;
  pulseMat: THREE.MeshBasicMaterial;
  label: Label;
  hit: THREE.Mesh;
}

interface LineVis {
  curve: SampledCurve;
  glow: THREE.Mesh;
  flowDot: THREE.Mesh;
  amber: THREE.Mesh | null;
}

export class LumenWorld {
  readonly root = new THREE.Group();
  readonly scenery = new THREE.Group();
  readonly overlay = new THREE.Group();
  readonly ports = {} as Record<PortId, PortVis>;
  readonly lines = {} as Record<LineId, LineVis>;
  readonly pumpLabels = {} as Record<PumpId, Label>;
  readonly pumpBodies = {} as Record<PumpId, THREE.Mesh>;
  readonly syringeGroups = {} as Record<SyringeId, THREE.Group>;
  readonly chip: Label;
  readonly log: Label;
  readonly hint: Label;
  readonly demo: Label;
  readonly push = new THREE.Group();
  readonly pushLabel: Label;
  readonly redirect = new THREE.Group();
  readonly alarmPump = new THREE.Group();
  readonly alarmText: Label;
  readonly kinkRing: THREE.Mesh;
  readonly kinkLabel: Label;
  readonly resolved = new THREE.Group();
  readonly resolvedLabel: Label;
  readonly edgeArrowMesh: THREE.Mesh;
  /** Every camera-facing object (oriented each frame). */
  private billboards: THREE.Object3D[] = [];
  private hits: { mesh: THREE.Mesh; hit: Hit }[] = [];
  private redirectKey = "";
  private pulseStart = -1;
  /** All on-screen Lens labels/buttons (for overlap and distance checks). */
  readonly uiLabels: { id: string; label: Label }[] = [];

  constructor(camera: THREE.Camera) {
    this.root.add(this.scenery, this.overlay);
    this.buildScenery();
    this.buildLines();
    this.buildPorts();
    // Cart texts
    this.chip = this.textAt(L.CART_TEXT.chip.anchor, L.TEXT_CAP.small, "center", "chip");
    this.log = this.textAt(L.CART_TEXT.log.anchor, L.TEXT_CAP.small, "center", "log");
    this.hint = this.textAt(L.CART_TEXT.hint.anchor, L.TEXT_CAP.small, "center", "hint");
    this.demo = this.textAt(L.CART_TEXT.demoLabel.anchor, L.TEXT_CAP.small, "center", "demoLabel");
    this.demo.setText(DEMO_DATA_LABEL, CSS.amber);
    this.addHit(this.chip.object as THREE.Mesh, { kind: "chip" }, false);
    for (const p of [1, 2, 3, 4] as PumpId[]) {
      this.pumpLabels[p] = this.textAt(L.PUMP_LABEL_ANCHOR[p], L.TEXT_CAP.large, "left", "pump." + p);
    }
    // Push button
    this.pushLabel = makeLabel(L.TEXT_CAP.small, "center", 30);
    this.buildButton(this.push, this.pushLabel, COLORS.green, { kind: "push" });
    this.uiLabels.push({ id: "button.push", label: this.pushLabel });
    this.overlay.add(this.push);
    this.overlay.add(this.redirect);
    // Alarm
    this.buildAlarmPump();
    this.alarmText = this.textAt(L.PUMP_ALARM_TEXT_ANCHOR, L.TEXT_CAP.large, "right", "pumpAlarm");
    this.kinkRing = new THREE.Mesh(billboardGeometry(M.ringXY(L.KINK_RING_DIAMETER, 0.7, 64)), ui(COLORS.amber, 0.95));
    this.kinkRing.position.copy(toThree(L.KINK_POS));
    this.overlay.add(this.kinkRing);
    this.billboards.push(this.kinkRing);
    this.kinkLabel = this.textAt(L.KINK_TEXT_ANCHOR, L.TEXT_CAP.small, "center", "kink");
    this.resolvedLabel = makeLabel(L.TEXT_CAP.small, "center", 30);
    this.buildButton(this.resolved, this.resolvedLabel, COLORS.amber, { kind: "resolved" });
    this.resolved.position.copy(toThree(L.RESOLVED_BUTTON_POS));
    this.uiLabels.push({ id: "button.resolved", label: this.resolvedLabel });
    this.overlay.add(this.resolved);
    // Edge arrow lives in camera space, 1 m ahead.
    this.edgeArrowMesh = new THREE.Mesh(billboardGeometry(M.chevronXY(4, 0.9)), glow(COLORS.amber, 1));
    this.edgeArrowMesh.renderOrder = 20;
    (this.edgeArrowMesh.material as THREE.Material).depthTest = false;
    camera.add(this.edgeArrowMesh);
    this.edgeArrowMesh.visible = false;
    // Overlay UI draws after the scene.
    this.overlay.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && !mat.depthTest && o.renderOrder < 20) o.renderOrder = 25;
    });
  }

  // ---------------- construction ----------------

  private add(mesh: M.MeshData, mat: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(worldGeometry(mesh), mat);
    (parent || this.scenery).add(m);
    return m;
  }

  private textAt(anchor: V3, cap: number, align: "left" | "center" | "right", id: string, plate?: boolean): Label {
    const label = makeLabel(cap, align, L.LABEL_WRAP_CHARS, plate);
    label.object.position.copy(toThree(anchor));
    this.overlay.add(label.object);
    this.billboards.push(label.object);
    this.uiLabels.push({ id: id, label: label });
    return label;
  }

  private addHit(mesh: THREE.Mesh, hit: Hit, hidden = true): void {
    if (hidden) mesh.material = hitMaterial();
    this.hits.push({ mesh: mesh, hit: hit });
  }

  private buildScenery(): void {
    const b = L.BED;
    const c = b.center;
    // Bed frame, mattress, headboard, rails, legs.
    this.add(M.box(v3(c.r, c.f, 44), v3(b.length, b.width, 12)), lit(COLORS.bed));
    this.add(M.box(v3(c.r, c.f, b.mattressTop - b.mattressThickness / 2), v3(b.length - 4, b.width - 4, b.mattressThickness)), lit(COLORS.mattress));
    this.add(M.box(v3(L.BED_HEAD_R - 2, c.f, (50 + b.headboardTop) / 2), v3(4, b.width, b.headboardTop - 50)), lit(COLORS.rail));
    this.add(M.box(v3(c.r + b.length / 2 + 2, c.f, 70), v3(4, b.width, 40)), lit(COLORS.rail));
    for (const f of [L.BED_NEAR_F, L.BED_FAR_F]) {
      const mid = (b.railFrom + b.railTo) / 2;
      this.add(M.box(v3(mid, f, L.RAIL_TOP - 1.5), v3(b.railTo - b.railFrom, 2.5, 3)), lit(COLORS.rail));
      this.add(M.box(v3(mid, f, L.RAIL_TOP - 14), v3(b.railTo - b.railFrom, 1.5, 2)), lit(COLORS.rail));
      for (let r = b.railFrom + 5; r <= b.railTo - 5; r += 30) {
        this.add(M.box(v3(r, f, L.RAIL_TOP - 15), v3(2, 2, 30)), lit(COLORS.rail));
      }
    }
    for (const dr of [-1, 1]) for (const df of [-1, 1]) {
      this.add(M.cylinder(v3(c.r + dr * (b.length / 2 - 10), c.f + df * (b.width / 2 - 8), 4), v3(c.r + dr * (b.length / 2 - 10), c.f + df * (b.width / 2 - 8), 38), 2.5, 12), lit(COLORS.pole));
    }
    // Mannequin: abstract, smooth, no face.
    const pt = L.PATIENT;
    this.add(M.sphere(pt.head.center, pt.head.radius, 20, 28), lit(COLORS.skin));
    this.add(M.capsule(pt.neck.from, pt.neck.to, pt.neck.radius, 20), lit(COLORS.skin));
    this.add(M.ellipsoid(v3(8, 70, 80), v3(32, 19, 12), 20, 32), lit(COLORS.gown));
    this.add(M.capsule(pt.pelvis.from, pt.pelvis.to, pt.pelvis.radius * 0.8, 20), lit(COLORS.gown));
    for (const leg of pt.legs) this.add(M.capsule(leg.from, leg.to, leg.radius, 18), lit(COLORS.gown, 0.98));
    for (const arm of pt.arms) this.add(M.capsule(arm.from, arm.to, arm.radius, 16), lit(COLORS.skin));
    // IV pole with wheeled base and hooks.
    const pole = L.POLE.base;
    this.add(M.cylinder(pole, v3(pole.r, pole.f, L.POLE.height), L.POLE.radius, 16), lit(COLORS.pole));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const tip = v3(pole.r + Math.cos(a) * 28, pole.f + Math.sin(a) * 28, 6);
      this.add(M.cylinder(v3(pole.r, pole.f, 7), tip, 1.6, 10), lit(COLORS.pole));
      this.add(M.sphere(v3(tip.r, tip.f, 3), 3, 10, 12), lit(COLORS.pole));
    }
    this.add(M.box(v3(pole.r - 8, pole.f, L.POLE.height - 1), v3(50, 2, 2)), lit(COLORS.pole));
    // Bags with printed labels.
    for (const l of LINE_IDS) {
      const bag = L.BAGS[l];
      this.add(M.box(bag.center, bag.size), lit(COLORS.bag, 0.75));
      this.add(M.cylinder(v3(bag.center.r, bag.center.f, bag.center.u + bag.size.u / 2), v3(bag.center.r, bag.center.f, L.POLE.height - 1), 0.3, 6), lit(COLORS.pole));
      const tag = makeLabel(1.3, "center", 14, false, false);
      tag.setText(LINES[l].bagLabel, CSS.ink);
      tag.object.position.copy(toThree(v3(bag.center.r, bag.center.f - bag.size.f / 2 - 0.2, bag.center.u - 4)));
      this.scenery.add(tag.object);
    }
    // Pumps with screens showing the rate (scene text, always on).
    for (const p of [1, 2, 3, 4] as PumpId[]) {
      const pump = L.PUMPS[p];
      this.pumpBodies[p] = this.add(M.box(pump.center, pump.size), lit(COLORS.pump));
      const front = pump.center.f - pump.size.f / 2;
      this.add(M.box(v3(pump.center.r - 2, front - 0.3, pump.center.u + 1), v3(12, 0.6, 6)), lit(COLORS.pumpScreen));
      const rate = makeLabel(1.4, "center", 30, false, false);
      rate.setText(LINES[p].rate, CSS.ink);
      rate.object.position.copy(toThree(v3(pump.center.r - 2, front - 0.8, pump.center.u - 0.4)));
      this.scenery.add(rate.object);
      const num = makeLabel(1.2, "center", 30, false, false);
      num.setText(String(p), CSS.ink);
      num.object.position.copy(toThree(v3(pump.center.r + 7, front - 0.8, pump.center.u - 0.2)));
      this.scenery.add(num.object);
    }
    const poleHit = new THREE.Mesh(worldGeometry(M.box(L.POLE_HIT.center, L.POLE_HIT.size)));
    this.scenery.add(poleHit);
    this.addHit(poleHit, { kind: "pole" });
    // Cart.
    const cart = L.CART;
    this.add(M.box(v3(cart.center.r, cart.center.f, cart.top - 1.5), v3(cart.sizeR, cart.sizeF, 3)), lit(COLORS.cart));
    this.add(M.box(v3(cart.center.r, cart.center.f, 30), v3(cart.sizeR - 4, cart.sizeF - 4, 2)), lit(COLORS.cart));
    for (const dr of [-1, 1]) for (const df of [-1, 1]) {
      this.add(M.cylinder(v3(cart.center.r + dr * (cart.sizeR / 2 - 3), cart.center.f + df * (cart.sizeF / 2 - 3), 3), v3(cart.center.r + dr * (cart.sizeR / 2 - 3), cart.center.f + df * (cart.sizeF / 2 - 3), cart.top - 3), 1.2, 10), lit(COLORS.pole));
    }
    // Syringes (lying along r) with printed barrel labels.
    for (const s of SYRINGE_IDS) {
      const sl = L.SYRINGE_LAYOUT[s];
      const g = new THREE.Group();
      const half = sl.length / 2;
      const a = v3(sl.center.r - half, sl.center.f, sl.center.u);
      const bEnd = v3(sl.center.r + half, sl.center.f, sl.center.u);
      g.add(new THREE.Mesh(worldGeometry(M.cylinder(a, bEnd, sl.radius, 18)), lit(COLORS.syringe, 0.9)));
      g.add(new THREE.Mesh(worldGeometry(M.cylinder(bEnd, v3(bEnd.r + 4, bEnd.f, bEnd.u), 0.35, 10)), lit(COLORS.pole)));
      g.add(new THREE.Mesh(worldGeometry(M.cylinder(v3(bEnd.r + 4, bEnd.f, bEnd.u), v3(bEnd.r + 4.6, bEnd.f, bEnd.u), 1.3, 18)), lit(COLORS.pole)));
      g.add(new THREE.Mesh(worldGeometry(M.cylinder(v3(a.r - 1.5, a.f, a.u), a, 0.35, 10)), lit(COLORS.pole)));
      this.scenery.add(g);
      this.syringeGroups[s] = g;
      const tag = makeLabel(L.SYRINGE_LABEL_CAP, L.SYRINGE_LABEL_SLOT[s].align, 30);
      tag.setText(SYRINGES[s].label, CSS.white);
      tag.object.position.copy(toThree(L.SYRINGE_LABEL_SLOT[s].anchor));
      this.overlay.add(tag.object);
      this.billboards.push(tag.object);
      this.uiLabels.push({ id: "syringe." + s, label: tag });
      const hit = new THREE.Mesh(worldGeometry(M.box(sl.center, sl.hitSize)));
      this.scenery.add(hit);
      this.addHit(hit, { kind: "syringe", id: s });
    }
    // Central line: catheter into the neck, hub, three lumens; PIV on the left forearm.
    this.add(M.tube([L.CVC_HUB.catheterFrom, L.CVC_HUB.center], 0.5, 10, true), lit(COLORS.hub));
    this.add(M.box(L.CVC_HUB.center, v3(5, 3, 2)), lit(COLORS.hub));
    for (const p of ["A", "B", "C"] as PortId[]) {
      this.add(M.tube([L.CVC_HUB.center, L.PORT_POS[p]], 0.45, 10, true), lit(COLORS.hub));
      this.add(M.cylinder(add(L.PORT_POS[p], v3(0, -0.5, 0)), add(L.PORT_POS[p], v3(0, -2, 0)), 0.8, 14), lit(COLORS.hub));
    }
    this.add(M.box(add(L.PORT_POS.D, v3(-2, 0, 0)), v3(4, 2.4, 1.2)), lit(COLORS.hub));
  }

  private buildLines(): void {
    for (const l of LINE_IDS) {
      const curve = sampleCurve(L.LINE_LAYOUT[l].control, L.CURVE_SAMPLES_PER_SEGMENT);
      this.add(M.tube(curve.points, L.TUBE_RADIUS, 8, false), lit(COLORS.tube, 0.85));
      const g = this.add(M.tube(curve.points, L.GLOW_RADIUS, 10, true), glow(COLORS.cyan, 0.85), this.overlay);
      g.visible = false;
      const dot = new THREE.Mesh(worldGeometry(M.sphere(v3(0, 0, 0), 1.0, 10, 12)), glow(COLORS.white, 1));
      dot.visible = false;
      this.overlay.add(dot);
      let amber: THREE.Mesh | null = null;
      const lay = L.LINE_LAYOUT[l];
      if (lay.kinkIndex >= 0) {
        const from = curve.cumulative[curve.controlIndex[lay.pumpOutIndex]];
        const to = curve.cumulative[curve.controlIndex[lay.kinkIndex]];
        amber = this.add(M.tube(slice(curve, from, to), L.GLOW_RADIUS * 1.15, 10, true), glow(COLORS.amber, 0.9), this.overlay);
        amber.visible = false;
      }
      this.lines[l] = { curve: curve, glow: g, flowDot: dot, amber: amber };
    }
  }

  private buildPorts(): void {
    for (const p of PORT_IDS) {
      const pos = toThree(L.PORT_POS[p]);
      const dot = new THREE.Mesh(billboardGeometry(M.discXY(L.IDLE_DOT_DIAMETER, 24)), flat(COLORS.white, 0.3));
      dot.position.copy(pos);
      dot.renderOrder = 5;
      const ring = new THREE.Group();
      ring.position.copy(pos);
      const ringMat = ui(COLORS.green, 1);
      ring.add(new THREE.Mesh(billboardGeometry(M.ringXY(L.MARKER_RING_DIAMETER, 0.45, 48)), ringMat));
      const check = new THREE.Mesh(billboardGeometry(M.checkXY(1.8, 0.4)), ui(COLORS.green, 1));
      const cross = new THREE.Mesh(billboardGeometry(M.crossXY(1.9, 0.4)), ui(COLORS.red, 1));
      ring.add(check, cross);
      ring.visible = false;
      const pulseMat = ui(COLORS.green, 0);
      const pulse = new THREE.Mesh(billboardGeometry(M.ringXY(L.MARKER_RING_DIAMETER, 0.6, 48)), pulseMat);
      pulse.position.copy(pos);
      pulse.visible = false;
      this.overlay.add(dot, ring, pulse);
      this.billboards.push(dot, ring, pulse);
      const label = this.textAt(L.PORT_LABEL_SLOT[p].anchor, L.TEXT_CAP.small, L.PORT_LABEL_SLOT[p].align, "port." + p);
      const hit = new THREE.Mesh(worldGeometry(M.sphere(L.PORT_POS[p], L.PORT_HIT_RADIUS, 8, 12)));
      this.overlay.add(hit);
      this.addHit(hit, { kind: "port", id: p });
      this.ports[p] = { dot, ring, ringMat, check, cross, pulse, pulseMat, label, hit };
    }
  }

  private buildButton(group: THREE.Group, label: Label, color: number, hit: Hit): void {
    const outline = new THREE.Mesh(billboardGeometry(M.rectOutlineXY(L.BUTTON_SIZE.w, L.BUTTON_SIZE.h, 0.3)), ui(color, 1));
    const fill = new THREE.Mesh(billboardGeometry(M.rectXY(L.BUTTON_SIZE.w, L.BUTTON_SIZE.h)), flat(color, 0.14));
    const hitMesh = new THREE.Mesh(billboardGeometry(M.rectXY(L.BUTTON_HIT.w, L.BUTTON_HIT.h)));
    label.setText(hit.kind === "push" ? S.PUSH_TEXT : S.RESOLVED_TEXT, CSS.white);
    label.object.position.set(0, -label.sizeCm.h / 2, 0.05);
    group.add(fill, outline, label.object, hitMesh);
    this.addHit(hitMesh, hit);
    group.visible = false;
    this.billboards.push(group);
  }

  private buildAlarmPump(): void {
    const pump = L.PUMPS[2];
    const size = v3(pump.size.r + 2, pump.size.f + 2, pump.size.u + 2);
    const shell = new THREE.Mesh(worldGeometry(M.box(pump.center, size)), glow(COLORS.amber, 0.35));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(worldGeometry(M.box(pump.center, size))), new THREE.LineBasicMaterial({ color: COLORS.amber, toneMapped: false }));
    this.alarmPump.add(shell, edges);
    this.alarmPump.visible = false;
    this.overlay.add(this.alarmPump);
  }

  // ---------------- per-frame rendering of the view model ----------------

  render(view: LumenView, t: number, camera: THREE.PerspectiveCamera): void {
    // Ports
    for (const p of PORT_IDS) {
      const pv = view.ports[p];
      const vis = this.ports[p];
      const showRing = pv.marker !== "idle" && pv.opacity > 0.001;
      vis.dot.visible = !showRing;
      vis.ring.visible = showRing;
      const green = pv.marker === "compatible";
      vis.ringMat.color.setHex(green ? COLORS.green : COLORS.red);
      vis.ringMat.opacity = pv.opacity;
      (vis.check.material as THREE.MeshBasicMaterial).opacity = pv.opacity;
      (vis.cross.material as THREE.MeshBasicMaterial).opacity = pv.opacity;
      vis.check.visible = green;
      vis.cross.visible = !green;
      const s = pv.focused ? 1.3 : 1;
      vis.ring.scale.setScalar(s);
      const color = pv.labelRole === "incompatible" ? CSS.red : pv.labelRole === "compatible" ? CSS.green : pv.labelRole === "redirect" ? CSS.cyan : CSS.white;
      vis.label.setText(pv.label, color);
      if (pv.pulse) {
        if (this.pulseStart < 0) this.pulseStart = t;
        const k = Math.min(1, (t - this.pulseStart) / TIMING.confirmToIdle);
        vis.pulse.visible = k < 1;
        vis.pulse.scale.setScalar(1 + k * 1.6);
        vis.pulseMat.opacity = 1 - k;
      } else {
        vis.pulse.visible = false;
      }
    }
    if (view.mode !== "CONFIRMED") this.pulseStart = -1;
    // Lines + flow dot (toward the patient, 1 loop per 1.5 s)
    for (const l of LINE_IDS) {
      const lv = this.lines[l];
      const on = view.glowLine === l;
      lv.glow.visible = on;
      lv.flowDot.visible = on;
      if (on) {
        const k = (t % TIMING.flowDotLoop) / TIMING.flowDotLoop;
        lv.flowDot.position.copy(toThree(pointAtLength(lv.curve, k * lv.curve.totalLength)));
      }
      if (lv.amber) lv.amber.visible = !!view.alarm && view.alarm.line === l;
    }
    for (const p of [1, 2, 3, 4] as PumpId[]) {
      const on = view.glowLine !== null && LINES[view.glowLine].pump === p;
      this.pumpLabels[p].setText(on ? view.pumpLabel : null, CSS.cyan);
    }
    // Cart texts
    this.chip.setText(view.chipText, CSS.white);
    this.log.setText(view.logText, CSS.green);
    if (view.noticeText) this.hint.setText(view.noticeText, CSS.red);
    else this.hint.setText(view.hintText, CSS.white);
    // Push button
    this.push.visible = view.pushButtonPort !== null;
    if (view.pushButtonPort) this.push.position.copy(toThree(L.PUSH_BUTTON_POS[view.pushButtonPort]));
    // Redirect arrow
    const key = view.redirect ? view.redirect.from + ">" + view.redirect.to : "";
    if (key !== this.redirectKey) {
      this.redirectKey = key;
      this.redirect.clear();
      if (view.redirect) this.buildRedirect(view.redirect.from, view.redirect.to);
    }
    this.redirect.visible = view.redirect !== null;
    // Alarm layer
    const alarm = view.alarm;
    this.alarmPump.visible = !!alarm;
    this.kinkRing.visible = !!alarm;
    this.resolved.visible = !!alarm;
    this.alarmText.setText(alarm ? alarm.text : null, CSS.amber);
    this.kinkLabel.setText(alarm ? alarm.kinkText : null, CSS.amber);
    if (alarm) {
      const k = 1 + 0.18 * Math.sin(t * Math.PI * 2 * 1.2);
      this.kinkRing.scale.setScalar(k);
      (this.alarmPump.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1.2));
    }
    this.updateEdgeArrow(!!alarm, camera);
    this.orientBillboards(camera);
  }

  private buildRedirect(from: PortId, to: PortId): void {
    const a = add(L.PORT_POS[from], v3(0, 0, 2.6));
    const b = add(L.PORT_POS[to], v3(0, 0, 2.6));
    const mid = v3((a.r + b.r) / 2, (a.f + b.f) / 2, Math.max(a.u, b.u) + 4);
    const curve = sampleCurve([a, mid, b], 16);
    const end = curve.totalLength - 1.4;
    const body = slice(curve, 0, end);
    this.redirect.add(new THREE.Mesh(worldGeometry(M.tube(body, 0.5, 10, true)), ui(COLORS.cyan, 0.95)));
    const tip = b;
    const base = pointAtLength(curve, end);
    const dir = normalize(sub(tip, base));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 16), ui(COLORS.cyan, 1));
    cone.position.copy(toThree(add(base, v3(dir.r * 0.9, dir.f * 0.9, dir.u * 0.9))));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toThree(dir).normalize());
    this.redirect.add(cone);
  }

  cameraPose(camera: THREE.Camera): Pose {
    const eye = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    camera.getWorldPosition(eye);
    camera.getWorldDirection(fwd);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    return { eye: fromThree(eye), forward: fromThree(fwd), up: fromThree(up), right: fromThree(right) };
  }

  private updateEdgeArrow(alarmOn: boolean, camera: THREE.PerspectiveCamera): void {
    if (!alarmOn) {
      this.edgeArrowMesh.visible = false;
      return;
    }
    const a = edgeArrow(this.cameraPose(camera), L.PUMPS[2].center, SPECS_FOV, 0.1);
    this.edgeArrowMesh.visible = a.visible;
    if (!a.visible) return;
    const d = 100;
    const x = a.ndcX * Math.tan(((SPECS_FOV.h / 2) * Math.PI) / 180) * d;
    const y = a.ndcY * Math.tan(((SPECS_FOV.v / 2) * Math.PI) / 180) * d;
    this.edgeArrowMesh.position.set(x, y, -d);
    this.edgeArrowMesh.rotation.set(0, 0, Math.atan2(y, x));
  }

  private orientBillboards(camera: THREE.Camera): void {
    const eye = new THREE.Vector3();
    camera.getWorldPosition(eye);
    const eyeS = fromThree(eye);
    const wp = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (const o of this.billboards) {
      o.getWorldPosition(wp);
      const ax = billboardAxes(eyeS, fromThree(wp));
      m.makeBasis(toThree(ax.right), toThree(ax.up), toThree(ax.normal));
      o.quaternion.setFromRotationMatrix(m);
    }
  }

  // ---------------- input ----------------

  /** Resolve a pinch ray. Buttons beat everything; overlapping port spheres resolve to the port nearest the ray. */
  pick(raycaster: THREE.Raycaster, view: LumenView): Hit | null {
    const active = this.hits.filter((h) => {
      if (h.hit.kind === "push") return view.pushButtonPort !== null;
      if (h.hit.kind === "resolved") return view.alarm !== null;
      if (h.hit.kind === "chip") return view.chipText !== null;
      return true;
    });
    const hits = raycaster.intersectObjects(active.map((h) => h.mesh), false);
    if (!hits.length) return null;
    const found = hits.map((x) => active.find((h) => h.mesh === x.object)!.hit);
    const button = found.find((h) => h.kind === "push" || h.kind === "resolved");
    if (button) return button;
    const first = found[0];
    if (first.kind !== "port") return first;
    // Port spheres overlap by design (4 cm apart, 6 cm targets): choose the centre closest to the ray.
    let best: PortId = first.id;
    let bestD = Infinity;
    for (const h of found) {
      if (h.kind !== "port") continue;
      const d = raycaster.ray.distanceToPoint(toThree(L.PORT_POS[h.id]));
      if (d < bestD) { bestD = d; best = h.id; }
    }
    return { kind: "port", id: best };
  }

  /** Screen position (CSS px) of a pinchable thing, for real-click tests. */
  screenPoint(target: string, camera: THREE.Camera, w: number, h: number): { x: number; y: number } | null {
    let p: V3 | null = null;
    if (target.startsWith("port.")) p = L.PORT_POS[target.slice(5) as PortId];
    else if (target.startsWith("syringe.")) p = L.SYRINGE_LAYOUT[target.slice(8) as SyringeId].center;
    else if (target === "push") p = fromThree(this.push.getWorldPosition(new THREE.Vector3()));
    else if (target === "resolved") p = L.RESOLVED_BUTTON_POS;
    else if (target === "pole") p = L.POLE_HIT.center;
    if (!p) return null;
    const v = toThree(p).project(camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }
}
