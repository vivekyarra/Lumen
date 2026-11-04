// Dev probe: label boxes per state at the hub pose and cart pose.
import * as L from "../Assets/Lumen/Core/LumenLayout";
import * as S from "../Assets/Lumen/Core/Strings";
import { distance } from "../Assets/Lumen/Core/Vec";
import { lookAt, toView, SPECS_FOV, labelScreenBox, labelSizeCm, overlappingPairs } from "../Assets/Lumen/Core/ViewMath";
const hub = lookAt(L.START_EYE, L.HUB_TARGET), cart = lookAt(L.START_EYE, L.CART_TARGET);
function box(pose: any, id: string, text: string, slot: { anchor: any; align: any }) { const z = labelSizeCm(text, 1.8, L.LABEL_WRAP_CHARS); return labelScreenBox(id, pose, slot.anchor, z.w, z.h, slot.align, SPECS_FOV); }
const sets: Record<string, [string, string, any][]> = {
  focusB: [["A", S.useText("A"), L.PORT_LABEL_SLOT.A], ["B", S.redFocusText("B"), L.PORT_LABEL_SLOT.B], ["C", S.redShortText("C"), L.PORT_LABEL_SLOT.C]],
  focusC: [["A", S.useText("A"), L.PORT_LABEL_SLOT.A], ["B", S.redShortText("B"), L.PORT_LABEL_SLOT.B], ["C", S.redFocusText("C"), L.PORT_LABEL_SLOT.C]],
  trace: [["A", S.portLabel("A"), L.PORT_LABEL_SLOT.A], ["B", S.portLabel("B"), L.PORT_LABEL_SLOT.B], ["C", S.portLabel("C"), L.PORT_LABEL_SLOT.C]],
};
for (const [k, set] of Object.entries(sets)) { const b = set.map(([id, t, sl]) => box(hub, id, t, sl)); console.log(k, overlappingPairs(b), b.map(x => `${x.id}[${x.minX.toFixed(2)},${x.maxX.toFixed(2)}|${x.minY.toFixed(2)},${x.maxY.toFixed(2)}]`).join(" ")); }
const cb = [box(cart, "chip", S.holdingText("S1"), L.CART_TEXT.chip), box(cart, "log", S.logText("S1","A","10:42"), L.CART_TEXT.log)];
console.log("cart", overlappingPairs(cb), cb.map(x => `${x.id}[${x.minX.toFixed(2)},${x.maxX.toFixed(2)}|${x.minY.toFixed(2)},${x.maxY.toFixed(2)}]`).join(" "));
for (const s of ["S1","S2"] as const) { const v = toView(cart, L.SYRINGE_LAYOUT[s].center, SPECS_FOV); console.log(s, v.ndcX.toFixed(2), v.ndcY.toFixed(2)); }
for (const p of [1,2,3,4] as const) { const v = toView(hub, L.PUMPS[p].center, SPECS_FOV); console.log("pump"+p, v.ndcX.toFixed(2), v.ndcY.toFixed(2)); }
console.log("kink dist", distance(L.START_EYE, L.KINK_POS).toFixed(1), "resolved", distance(L.START_EYE, L.RESOLVED_BUTTON_POS).toFixed(1));
const k = toView(hub, L.KINK_POS, SPECS_FOV); console.log("kink in hub view", k.ndcX.toFixed(2), k.ndcY.toFixed(2));
