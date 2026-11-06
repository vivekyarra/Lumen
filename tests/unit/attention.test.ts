import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../../Assets/Lumen/Core/LumenLayout";
import { LumenStateMachine } from "../../Assets/Lumen/Core/LumenState";
import { ATTENTION, AttentionTracker, NO_ATTENTION, applyAttention, attend, popScale } from "../../Assets/Lumen/Core/Attention";
import { distance, v3 } from "../../Assets/Lumen/Core/Vec";
import { lookAt } from "../../Assets/Lumen/Core/ViewMath";
import { PORT_IDS } from "../../Assets/Lumen/Core/LumenData";

const clock = { wallClock: () => ({ h: 10, m: 42 }) };

function holding() {
  const sm = new LumenStateMachine(L.PORT_POS, clock, 0);
  sm.pinchSyringe("S1");
  sm.update(1);
  return sm;
}

test("glance: looking at the cart, red ports keep their ✕ ring but say nothing", () => {
  const att = attend(lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, NO_ATTENTION);
  assert.equal(att.near, false);
  assert.equal(att.gazed, null);
  const v = applyAttention(holding().view(), att);
  for (const p of PORT_IDS) assert.equal(v.ports[p].label, null, p);
  assert.equal(v.ports.B.marker, "incompatible");
  assert.equal(v.ports.C.marker, "incompatible");
  assert.equal(v.ports.B.opacity, 1);
});

test("look: the port nearest the view centre says why, its neighbours 4 cm away stay quiet", () => {
  const sm = holding();
  for (const [look, other] of [["B", "C"], ["C", "B"]] as const) {
    const att = attend(lookAt(L.START_EYE, L.PORT_POS[look]), L.PORT_POS, NO_ATTENTION);
    assert.equal(att.gazed, look);
    const v = applyAttention(sm.view(), att);
    assert.equal(v.ports[look].label, sm.view().ports[look].label);
    assert.equal(v.ports[other].label, null);
  }
});

test("lean in: within 80 cm every red port says why; stepping back past 90 cm goes quiet", () => {
  assert.ok(distance(L.LEAN_IN_EYE, L.PORT_POS.B) < ATTENTION.nearEnterCm);
  const sm = holding();
  const close = attend(lookAt(L.LEAN_IN_EYE, L.HUB_TARGET), L.PORT_POS, NO_ATTENTION);
  assert.equal(close.near, true);
  const v = applyAttention(sm.view(), close);
  assert.equal(v.ports.B.label, "✕ Midazolam");
  assert.equal(v.ports.C.label, "✕ Dobutamine");
  // Hysteresis: 85 cm away stays near if it was near, is not near if it was not.
  const dir = v3(0, -1, 0);
  const at85 = { r: L.PORT_POS.B.r, f: L.PORT_POS.B.f - 85, u: L.PORT_POS.B.u };
  const pose = lookAt(at85, { r: at85.r + dir.r, f: at85.f + dir.f, u: at85.u });
  assert.equal(attend(pose, L.PORT_POS, close).near, true);
  assert.equal(attend(pose, L.PORT_POS, NO_ATTENTION).near, false);
});

test("gaze does not flicker between ports 4 cm apart", () => {
  const onB = attend(lookAt(L.START_EYE, L.PORT_POS.B), L.PORT_POS, NO_ATTENTION);
  // Halfway between B and C: keeps B.
  const mid = { r: (L.PORT_POS.B.r + L.PORT_POS.C.r) / 2, f: L.PORT_POS.B.f, u: L.PORT_POS.B.u };
  assert.equal(attend(lookAt(L.START_EYE, mid), L.PORT_POS, onB).gazed, "B");
  // Clearly on C: switches.
  assert.equal(attend(lookAt(L.START_EYE, L.PORT_POS.C), L.PORT_POS, onB).gazed, "C");
});

test("pinched answers, the redirect and Push are never held back", () => {
  const sm = holding();
  sm.pinchPort("B");
  const far = attend(lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, NO_ATTENTION);
  const raw = sm.view();
  const v = applyAttention(raw, far);
  assert.equal(v.ports.B.label, "✕ Midazolam — do not push here");
  assert.equal(v.ports.A.label, "Use Distal ✓");
  assert.deepEqual(v.redirect, raw.redirect);
  assert.equal(v.ports.C.label, null);
});

test("idle and trace views pass through untouched", () => {
  const sm = new LumenStateMachine(L.PORT_POS, clock, 0);
  const far = attend(lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, NO_ATTENTION);
  assert.deepEqual(applyAttention(sm.view(), far), sm.view());
  sm.pinchPort("B");
  assert.deepEqual(applyAttention(sm.view(), far), sm.view());
});

test("words pop in from 70 % and settle at 100 % within 0.18 s", () => {
  assert.ok(Math.abs(popScale(0) - 0.7) < 1e-9);
  assert.equal(popScale(ATTENTION.popInSec), 1);
  assert.equal(popScale(5), 1);
  for (let t = 0; t < ATTENTION.popInSec; t += 0.01) assert.ok(popScale(t) >= 0.69 && popScale(t) <= 1.1, String(t));
  const tr = new AttentionTracker();
  const sm = holding();
  tr.update(sm.view(), lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, 10);
  tr.update(sm.view(), lookAt(L.START_EYE, L.PORT_POS.B), L.PORT_POS, 11);
  assert.ok(Math.abs(tr.labelScale("B", 11) - 0.7) < 1e-9);
  assert.equal(tr.labelScale("B", 12), 1);
});

test("the test pose override replaces the camera only while set", () => {
  const tr = new AttentionTracker();
  const sm = holding();
  tr.overridePose = lookAt(L.LEAN_IN_EYE, L.HUB_TARGET);
  assert.equal(tr.update(sm.view(), lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, 1).ports.C.label, "✕ Dobutamine");
  tr.overridePose = null;
  tr.reset();
  assert.equal(tr.update(sm.view(), lookAt(L.START_EYE, L.CART_TARGET), L.PORT_POS, 2).ports.C.label, null);
});

test("far: from across the room, looking right at a port adds no words", () => {
  const far = { r: L.PORT_POS.B.r, f: L.PORT_POS.B.f - 170, u: 165 };
  const att = attend(lookAt(far, L.PORT_POS.B), L.PORT_POS, NO_ATTENTION);
  assert.equal(att.gazed, null);
  assert.equal(att.near, false);
  const v = applyAttention(holding().view(), att);
  assert.equal(v.ports.B.label, null);
  assert.equal(v.ports.B.marker, "incompatible");
  // Walking in to a normal working distance, the same look now reads B.
  assert.equal(attend(lookAt(L.START_EYE, L.PORT_POS.B), L.PORT_POS, att).gazed, "B");
});
