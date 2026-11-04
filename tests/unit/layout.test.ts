import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../../Assets/Lumen/Core/LumenLayout";
import * as S from "../../Assets/Lumen/Core/Strings";
import { DEMO_DATA_LABEL, LINE_IDS, LINES, PORT_IDS, SYRINGE_IDS } from "../../Assets/Lumen/Core/LumenData";
import { crossings2D, minDistance, pointAtLength, sampleCurve, slice } from "../../Assets/Lumen/Core/Curves";
import { distance, v3 } from "../../Assets/Lumen/Core/Vec";
import {
  SPECS_FOV, edgeArrow, isInView, labelScreenBox, labelSizeCm, lookAt, overlappingPairs, poseFromYawPitch, toView, wrapLabel,
} from "../../Assets/Lumen/Core/ViewMath";
import { nearestCompatible } from "../../Assets/Lumen/Core/CompatibilityEngine";

const samples = (l: 1 | 2 | 3 | 4) => sampleCurve(L.LINE_LAYOUT[l].control, L.CURVE_SAMPLES_PER_SEGMENT);
const hubPose = lookAt(L.START_EYE, L.HUB_TARGET);
const cartPose = lookAt(L.START_EYE, L.CART_TARGET);

function box(pose: ReturnType<typeof lookAt>, id: string, text: string, slot: L.LabelSlot) {
  const z = labelSizeCm(text, L.TEXT_CAP.small, L.LABEL_WRAP_CHARS);
  return labelScreenBox(id, pose, slot.anchor, z.w, z.h, slot.align, SPECS_FOV);
}

test("central-line ports are ~0.8–1.05 m from the eyes and below eye level", () => {
  for (const p of ["A", "B", "C"] as const) {
    const d = distance(L.START_EYE, L.PORT_POS[p]);
    assert.ok(d >= 80 && d <= 106, `${p} at ${d.toFixed(1)} cm`);
    assert.ok(L.PORT_POS[p].u < L.EYE_HEIGHT);
  }
});

test("CVC ports are 4 cm apart and the nearest-compatible rule gives the spec answers", () => {
  assert.equal(distance(L.PORT_POS.A, L.PORT_POS.B), 4);
  assert.equal(distance(L.PORT_POS.B, L.PORT_POS.C), 4);
  assert.equal(nearestCompatible("B", "S1", L.PORT_POS), "A");
  assert.equal(nearestCompatible("C", "S1", L.PORT_POS), "A");
});

test("each line ends exactly at its port and starts at its bag", () => {
  for (const l of LINE_IDS) {
    const c = L.LINE_LAYOUT[l].control;
    assert.deepEqual(c[c.length - 1], L.PORT_POS[LINES[l].port]);
    const bag = L.BAGS[l];
    assert.ok(Math.abs(c[0].r - bag.center.r) < 1 && c[0].u <= bag.center.u - bag.size.u / 2 + 0.5);
    const out = c[L.LINE_LAYOUT[l].pumpOutIndex];
    const pump = L.PUMPS[LINES[l].pump];
    assert.ok(Math.abs(out.u - (pump.center.u - pump.size.u / 2)) < 0.5, `line ${l} leaves the bottom of pump ${pump.id}`);
  }
});

test("the tangle: lines 2 and 3 cross exactly once (top-down), no other pair crosses", () => {
  const cs = LINE_IDS.map((l) => samples(l).points.slice(L.LINE_LAYOUT[l].pumpOutIndex * L.CURVE_SAMPLES_PER_SEGMENT));
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const n = crossings2D(cs[i], cs[j], L.POLE.base, 12);
      assert.equal(n, i === 1 && j === 2 ? 1 : 0, `L${i + 1} x L${j + 1} = ${n}`);
      assert.ok(minDistance(cs[i], cs[j]) > 1, "tubes never intersect in 3D");
    }
  }
});

test("line 2 passes the kink over the near bed rail", () => {
  const c = samples(2);
  const kinkLen = c.cumulative[c.controlIndex[L.LINE_LAYOUT[2].kinkIndex]];
  assert.deepEqual(pointAtLength(c, kinkLen), L.KINK_POS);
  assert.ok(Math.abs(L.KINK_POS.f - L.BED_NEAR_F) < 1 && L.KINK_POS.u > L.RAIL_TOP);
  const pumpToKink = slice(c, c.cumulative[c.controlIndex[L.LINE_LAYOUT[2].pumpOutIndex]], kinkLen);
  assert.ok(pumpToKink.length > 10);
});

test("tubes droop: no sampled point is below the mattress or above the bag hooks", () => {
  for (const l of LINE_IDS) {
    for (const p of samples(l).points) {
      assert.ok(p.u > L.BED.mattressTop && p.u < 201, `line ${l} point at u=${p.u}`);
    }
  }
});

test("DC8: no UI is closer than 40 cm to the eyes", () => {
  const ui = [
    ...PORT_IDS.map((p) => L.PORT_LABEL_SLOT[p].anchor), ...PORT_IDS.map((p) => L.PUSH_BUTTON_POS[p]),
    ...Object.values(L.CART_TEXT).map((t) => t.anchor), L.RESOLVED_BUTTON_POS, L.KINK_TEXT_ANCHOR, L.KINK_POS,
    L.PUMP_ALARM_TEXT_ANCHOR, ...SYRINGE_IDS.map((s) => L.SYRINGE_LAYOUT[s].center),
  ];
  for (const p of ui) assert.ok(distance(L.START_EYE, p) >= L.MIN_UI_DISTANCE_CM);
});

const hubLabelSets: Record<string, [string, string][]> = {
  holdingS1: [["B", S.redShortText("B")], ["C", S.redShortText("C")]],
  focusB: [["A", S.useText("A")], ["B", S.redFocusText("B")], ["C", S.redShortText("C")]],
  focusC: [["A", S.useText("A")], ["B", S.redShortText("B")], ["C", S.redFocusText("C")]],
  focusA: [["A", S.COMPATIBLE_TEXT], ["B", S.redShortText("B")], ["C", S.redShortText("C")]],
  traceAll: [["A", S.portLabel("A")], ["B", S.portLabel("B")], ["C", S.portLabel("C")]],
};

test("DC8: hub labels never overlap and fit the SPECS view when looking at the hub", () => {
  for (const [name, set] of Object.entries(hubLabelSets)) {
    const boxes = set.map(([p, t]) => box(hubPose, p, t, L.PORT_LABEL_SLOT[p as "A"]));
    assert.deepEqual(overlappingPairs(boxes), [], name);
    for (const b of boxes) assert.ok(b.minX >= -1 && b.maxX <= 1 && b.minY >= -1 && b.maxY <= 1, `${name}/${b.id} inside view`);
  }
  for (const p of ["A", "B", "C"] as const) assert.ok(isInView(hubPose, L.PORT_POS[p], SPECS_FOV, 0.05));
});

test("DC8: cart texts never overlap and the cart fits the SPECS view when looking at it", () => {
  const boxes = [
    box(cartPose, "chip", S.holdingText("S1"), L.CART_TEXT.chip),
    box(cartPose, "log", S.logText("S1", "A", "10:42"), L.CART_TEXT.log),
    box(cartPose, "demo", DEMO_DATA_LABEL, L.CART_TEXT.demoLabel),
  ];
  const tag = (s: "S1" | "S2") => {
    const z = labelSizeCm(s === "S1" ? "Furosemide 40 mg" : "Morphine 2 mg", L.SYRINGE_LABEL_CAP, 99);
    // 25 % wider than estimated: fallback fonts on CI machines run wide.
    return labelScreenBox("syringe." + s, cartPose, L.SYRINGE_LABEL_SLOT[s].anchor, z.w * 1.25, z.h, L.SYRINGE_LABEL_SLOT[s].align, SPECS_FOV);
  };
  boxes.push(tag("S1"), tag("S2"));
  assert.deepEqual(overlappingPairs(boxes), []);
  const hintBoxes = [box(cartPose, "hint", S.HINT_TEXT, L.CART_TEXT.hint), boxes[2]];
  assert.deepEqual(overlappingPairs(hintBoxes), []);
  for (const b of [...boxes, hintBoxes[0]]) assert.ok(b.minX >= -1 && b.maxX <= 1 && b.minY >= -1 && b.maxY <= 1, b.id);
  for (const s of SYRINGE_IDS) assert.ok(isInView(cartPose, L.SYRINGE_LAYOUT[s].center, SPECS_FOV, 0.1));
});

test("hub and cart are one short head turn apart (readable without walking)", () => {
  const turn = Math.abs(toView(hubPose, L.CART_TARGET, { h: 1, v: 1 }).azimuth);
  assert.ok(turn < 75, `turn ${turn.toFixed(1)}°`);
});

test("pumps are out of view when looking at the hub (makes the edge arrow useful)", () => {
  assert.equal(isInView(hubPose, L.PUMPS[2].center, SPECS_FOV), false);
  const a = edgeArrow(hubPose, L.PUMPS[2].center, SPECS_FOV, 0.1);
  assert.equal(a.visible, true);
  assert.ok(Math.abs(a.ndcX) <= 0.9 + 1e-9 && Math.abs(a.ndcY) <= 0.9 + 1e-9);
  assert.ok(Math.abs(a.ndcX) > 0.89 || Math.abs(a.ndcY) > 0.89, "arrow sits on the view edge");
  assert.ok(a.ndcY > 0, "pump 2 is above the hub view");
  const lookAtPump = lookAt(L.START_EYE, L.PUMPS[2].center);
  assert.equal(edgeArrow(lookAtPump, L.PUMPS[2].center, SPECS_FOV, 0.1).visible, false);
});

test("edge arrow points the right way for targets behind and beside the viewer", () => {
  const pose = poseFromYawPitch(v3(0, 0, 165), 0, 0);
  const left = edgeArrow(pose, v3(-100, 10, 165), SPECS_FOV, 0.1);
  assert.ok(left.visible && left.ndcX < 0 && Math.abs(left.angleDeg) > 170);
  const behindRight = edgeArrow(pose, v3(50, -100, 165), SPECS_FOV, 0.1);
  assert.ok(behindRight.visible && behindRight.ndcX > 0);
  const up = edgeArrow(pose, v3(0, 30, 300), SPECS_FOV, 0.1);
  assert.ok(up.visible && up.ndcY > 0 && Math.abs(up.angleDeg - 90) < 1);
});

test("hit areas do not overlap: ports, push buttons and syringes", () => {
  const ports = PORT_IDS.map((p) => L.PORT_POS[p]);
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) {
      // Adjacent CVC lumens are 4 cm apart: 6 cm spheres overlap by design; the nearest centre wins (tested in state).
      assert.ok(distance(ports[i], ports[j]) >= 4);
    }
  }
  for (const p of PORT_IDS) {
    const btn = L.PUSH_BUTTON_POS[p];
    for (const q of PORT_IDS) {
      const d = distance(btn, L.PORT_POS[q]);
      assert.ok(d >= L.BUTTON_HIT.w / 2 + L.PORT_HIT_RADIUS - 0.01, `push(${p}) vs port ${q}: ${d.toFixed(1)}`);
    }
  }
  assert.ok(distance(L.SYRINGE_LAYOUT.S1.center, L.SYRINGE_LAYOUT.S2.center) === 15);
});

test("label wrapping keeps exact words and splits at the dash", () => {
  assert.deepEqual(wrapLabel(S.redFocusText("B"), 20), ["✕ Midazolam", "— do not push here"]);
  assert.deepEqual(wrapLabel("short", 20), ["short"]);
  for (const t of [S.useText("A"), S.HINT_TEXT, DEMO_DATA_LABEL, S.logText("S1", "A", "10:42")]) {
    assert.equal(wrapLabel(t, 20).join(" "), t);
    assert.ok(wrapLabel(t, 20).length <= 2);
  }
});

test("view math basics", () => {
  const pose = lookAt(v3(0, 0, 0), v3(0, 100, 0));
  const center = toView(pose, v3(0, 100, 0), SPECS_FOV);
  assert.ok(Math.abs(center.ndcX) < 1e-9 && Math.abs(center.ndcY) < 1e-9 && center.depth > 99);
  const edge = toView(pose, v3(Math.tan((18.5 * Math.PI) / 180) * 100, 100, 0), SPECS_FOV);
  assert.ok(Math.abs(edge.ndcX - 1) < 1e-9);
  assert.equal(isInView(pose, v3(0, -100, 0), SPECS_FOV), false);
});
