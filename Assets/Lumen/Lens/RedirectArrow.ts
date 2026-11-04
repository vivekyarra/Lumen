/** RedirectArrow — cyan curved arrow from a focused red port to the nearest green port (LUMEN_SPEC.md §8.4). */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { PortId } from "../Core/LumenData";
import { LumenView } from "../Core/LumenState";
import { pointAtLength, sampleCurve, slice } from "../Core/Curves";
import { add, normalize, scale, sub, v3 } from "../Core/Vec";
import { LensContext } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, rgba } from "./LensAdapters";
import { HEX } from "./Palette";

export class RedirectArrow {
  private readonly ctx: LensContext;
  private obj: SceneObject | null = null;
  private key = "";

  constructor(ctx: LensContext) {
    this.ctx = ctx;
  }

  visible(): boolean {
    return this.obj !== null && this.obj.enabled;
  }

  target(): PortId | null {
    return this.key ? (this.key.split(">")[1] as PortId) : null;
  }

  render(view: LumenView): void {
    const key = view.redirect ? view.redirect.from + ">" + view.redirect.to : "";
    if (key === this.key) return;
    this.key = key;
    if (this.obj) {
      this.obj.destroy();
      this.obj = null;
    }
    if (!view.redirect) return;
    const a = add(L.PORT_POS[view.redirect.from], v3(0, 0, 2.6));
    const b = add(L.PORT_POS[view.redirect.to], v3(0, 0, 2.6));
    const mid = v3((a.r + b.r) / 2, (a.f + b.f) / 2, Math.max(a.u, b.u) + 4);
    const curve = sampleCurve([a, mid, b], 16);
    const end = curve.totalLength - 1.6;
    const base = pointAtLength(curve, end);
    const dir = normalize(sub(b, base));
    // Arrow head: three stacked, narrowing tube rings form a cone pointing at the green port.
    const head = M.merge([
      M.tube([base, add(base, scale(dir, 0.4))], 1.1, 12, true),
      M.tube([add(base, scale(dir, 0.4)), add(base, scale(dir, 1.0))], 0.7, 12, true),
      M.tube([add(base, scale(dir, 1.0)), add(base, scale(dir, 1.6))], 0.3, 12, true),
    ]);
    this.obj = child(this.ctx.specRoot, "RedirectArrow");
    addMeshVisual(this.obj, buildMesh(M.merge([M.tube(slice(curve, 0, end), 0.5, 10, true), head]), "world"), makeMaterial(this.ctx.unlitMaterial, { color: rgba(HEX.cyan, 0.95), onTop: true }), 24);
  }
}
