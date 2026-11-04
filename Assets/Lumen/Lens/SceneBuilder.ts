/**
 * SceneBuilder — the virtual ICU bedside (bed, mannequin, IV pole, bags, pumps, cart, syringes, catheters)
 * from procedural meshes (LUMEN_SPEC.md §7.1, §8.2). Abstract mannequin, no face.
 */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { LINE_IDS, LINES, PumpId, SYRINGE_IDS, PortId } from "../Core/LumenData";
import { add, v3 } from "../Core/Vec";
import { LensContext, placeAt } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, makeText, rgba, setText } from "./LensAdapters";
import { HEX } from "./Palette";

export class SceneBuilder {
  private readonly ctx: LensContext;
  readonly root: SceneObject;

  constructor(ctx: LensContext) {
    this.ctx = ctx;
    this.root = child(ctx.specRoot, "Lumen_Bedside");
  }

  private solid(name: string, mesh: M.MeshData, hex: number, alpha?: number): void {
    const o = child(this.root, name);
    addMeshVisual(o, buildMesh(mesh, "world"), makeMaterial(this.ctx.litMaterial, { color: rgba(hex, alpha === undefined ? 1 : alpha) }));
  }

  private printed(name: string, text: string, at: { r: number; f: number; u: number }, capCm: number): void {
    const o = placeAt(this.ctx, name, at, false);
    const t = makeText(o, { capCm: capCm, align: "center", color: rgba(0x3a4654, 1), cmPerPoint: this.ctx.cmPerPoint, font: this.ctx.font, onTop: false });
    // Printed text faces the user's start position (−f).
    o.getTransform().setLocalRotation(quat.angleAxis(0, vec3.up()));
    setText(t, text);
  }

  build(): void {
    const b = L.BED;
    const c = b.center;
    this.solid("Bed_Frame", M.box(v3(c.r, c.f, 44), v3(b.length, b.width, 12)), HEX.bed);
    this.solid("Bed_Mattress", M.box(v3(c.r, c.f, b.mattressTop - b.mattressThickness / 2), v3(b.length - 4, b.width - 4, b.mattressThickness)), HEX.mattress);
    this.solid("Bed_Headboard", M.box(v3(L.BED_HEAD_R - 2, c.f, (50 + b.headboardTop) / 2), v3(4, b.width, b.headboardTop - 50)), HEX.rail);
    this.solid("Bed_Footboard", M.box(v3(c.r + b.length / 2 + 2, c.f, 70), v3(4, b.width, 40)), HEX.rail);
    const rails: M.MeshData[] = [];
    const sides = [L.BED_NEAR_F, L.BED_FAR_F];
    for (let i = 0; i < sides.length; i++) {
      const f = sides[i];
      const mid = (b.railFrom + b.railTo) / 2;
      rails.push(M.box(v3(mid, f, L.RAIL_TOP - 1.5), v3(b.railTo - b.railFrom, 2.5, 3)));
      rails.push(M.box(v3(mid, f, L.RAIL_TOP - 14), v3(b.railTo - b.railFrom, 1.5, 2)));
      for (let r = b.railFrom + 5; r <= b.railTo - 5; r += 30) rails.push(M.box(v3(r, f, L.RAIL_TOP - 15), v3(2, 2, 30)));
    }
    this.solid("Bed_Rails", M.merge(rails), HEX.rail);
    const legs: M.MeshData[] = [];
    for (let dr = -1; dr <= 1; dr += 2) {
      for (let df = -1; df <= 1; df += 2) {
        const r = c.r + dr * (b.length / 2 - 10);
        const f = c.f + df * (b.width / 2 - 8);
        legs.push(M.cylinder(v3(r, f, 4), v3(r, f, 38), 2.5, 12));
      }
    }
    this.solid("Bed_Legs", M.merge(legs), HEX.pole);

    // Mannequin — abstract and faceless.
    const pt = L.PATIENT;
    this.solid("Mannequin_Head", M.sphere(pt.head.center, pt.head.radius, 20, 28), HEX.skin);
    this.solid("Mannequin_Neck", M.capsule(pt.neck.from, pt.neck.to, pt.neck.radius, 20), HEX.skin);
    this.solid("Mannequin_Torso", M.ellipsoid(v3(8, 70, 80), v3(32, 19, 12), 20, 32), HEX.gown);
    this.solid("Mannequin_Pelvis", M.capsule(pt.pelvis.from, pt.pelvis.to, pt.pelvis.radius * 0.8, 20), HEX.gown);
    this.solid("Mannequin_Legs", M.merge(pt.legs.map(function (l) { return M.capsule(l.from, l.to, l.radius, 18); })), HEX.gown);
    this.solid("Mannequin_Arms", M.merge(pt.arms.map(function (a) { return M.capsule(a.from, a.to, a.radius, 16); })), HEX.skin);

    // IV pole.
    const pole = L.POLE.base;
    const poleParts: M.MeshData[] = [M.cylinder(pole, v3(pole.r, pole.f, L.POLE.height), L.POLE.radius, 16)];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const tip = v3(pole.r + Math.cos(a) * 28, pole.f + Math.sin(a) * 28, 6);
      poleParts.push(M.cylinder(v3(pole.r, pole.f, 7), tip, 1.6, 10));
      poleParts.push(M.sphere(v3(tip.r, tip.f, 3), 3, 10, 12));
    }
    poleParts.push(M.box(v3(pole.r - 8, pole.f, L.POLE.height - 1), v3(50, 2, 2)));
    this.solid("IV_Pole", M.merge(poleParts), HEX.pole);

    // Bags and pumps (with their printed labels / rate screens).
    for (let i = 0; i < LINE_IDS.length; i++) {
      const l = LINE_IDS[i];
      const bag = L.BAGS[l];
      this.solid("Bag_" + l, M.box(bag.center, bag.size), HEX.bag, 0.75);
      this.solid("Bag_" + l + "_Hook", M.cylinder(v3(bag.center.r, bag.center.f, bag.center.u + bag.size.u / 2), v3(bag.center.r, bag.center.f, L.POLE.height - 1), 0.3, 6), HEX.pole);
      this.printed("Bag_" + l + "_Label", LINES[l].bagLabel, v3(bag.center.r, bag.center.f - bag.size.f / 2 - 0.2, bag.center.u - 4), 1.3);
      const p = LINES[l].pump as PumpId;
      const pump = L.PUMPS[p];
      const front = pump.center.f - pump.size.f / 2;
      this.solid("Pump_" + p, M.box(pump.center, pump.size), HEX.pump);
      this.solid("Pump_" + p + "_Screen", M.box(v3(pump.center.r - 2, front - 0.3, pump.center.u + 1), v3(12, 0.6, 6)), HEX.pumpScreen);
      this.printed("Pump_" + p + "_Rate", LINES[l].rate, v3(pump.center.r - 2, front - 0.8, pump.center.u - 0.4), 1.4);
      this.printed("Pump_" + p + "_Number", String(p), v3(pump.center.r + 7, front - 0.8, pump.center.u - 0.2), 1.2);
    }

    // Cart and syringes.
    const cart = L.CART;
    const cartParts: M.MeshData[] = [
      M.box(v3(cart.center.r, cart.center.f, cart.top - 1.5), v3(cart.sizeR, cart.sizeF, 3)),
      M.box(v3(cart.center.r, cart.center.f, 30), v3(cart.sizeR - 4, cart.sizeF - 4, 2)),
    ];
    for (let dr = -1; dr <= 1; dr += 2) {
      for (let df = -1; df <= 1; df += 2) {
        const r = cart.center.r + dr * (cart.sizeR / 2 - 3);
        const f = cart.center.f + df * (cart.sizeF / 2 - 3);
        cartParts.push(M.cylinder(v3(r, f, 3), v3(r, f, cart.top - 3), 1.2, 10));
      }
    }
    this.solid("Cart", M.merge(cartParts), HEX.cart);
    for (let i = 0; i < SYRINGE_IDS.length; i++) {
      const s = SYRINGE_IDS[i];
      const sl = L.SYRINGE_LAYOUT[s];
      const half = sl.length / 2;
      const a = v3(sl.center.r - half, sl.center.f, sl.center.u);
      const e = v3(sl.center.r + half, sl.center.f, sl.center.u);
      this.solid("Syringe_" + s + "_Barrel", M.cylinder(a, e, sl.radius, 18), HEX.syringe, 0.9);
      this.solid("Syringe_" + s + "_Plunger", M.merge([
        M.cylinder(e, v3(e.r + 4, e.f, e.u), 0.35, 10),
        M.cylinder(v3(e.r + 4, e.f, e.u), v3(e.r + 4.6, e.f, e.u), 1.3, 18),
        M.cylinder(v3(a.r - 1.5, a.f, a.u), a, 0.35, 10),
      ]), HEX.pole);
    }

    // Central line hub with three lumens; PIV on the left forearm.
    const hubParts: M.MeshData[] = [M.tube([L.CVC_HUB.catheterFrom, L.CVC_HUB.center], 0.5, 10, true), M.box(L.CVC_HUB.center, v3(5, 3, 2))];
    const cvc: PortId[] = ["A", "B", "C"];
    for (let i = 0; i < cvc.length; i++) {
      const p = L.PORT_POS[cvc[i]];
      hubParts.push(M.tube([L.CVC_HUB.center, p], 0.45, 10, true));
      hubParts.push(M.cylinder(add(p, v3(0, -0.5, 0)), add(p, v3(0, -2, 0)), 0.8, 14));
    }
    hubParts.push(M.box(add(L.PORT_POS.D, v3(-2, 0, 0)), v3(4, 2.4, 1.2)));
    this.solid("Catheters", M.merge(hubParts), HEX.hub);
  }
}
