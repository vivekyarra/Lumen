/** EdgeArrow — amber chevron at the edge of the SPECS view pointing to an out-of-view target (4 cm at 1 m). */
import * as M from "../Core/MeshGen";
import { EdgeArrow as EdgeArrowPlacement, SPECS_FOV } from "../Core/ViewMath";
import { addMeshVisual, buildMesh, makeMaterial, rgba } from "./LensAdapters";
import { HEX } from "./Palette";

export class EdgeArrow {
  readonly obj: SceneObject;

  constructor(camera: SceneObject, unlit: Material) {
    this.obj = global.scene.createSceneObject("Lumen_EdgeArrow");
    this.obj.setParent(camera);
    addMeshVisual(this.obj, buildMesh(M.chevronXY(4, 0.9), "billboard"), makeMaterial(unlit, { color: rgba(HEX.amber, 1), onTop: true }), 40);
    this.obj.enabled = false;
  }

  render(a: EdgeArrowPlacement | null): void {
    const on = a !== null && a.visible;
    this.obj.enabled = on;
    if (!on || !a) return;
    const d = 100;
    const x = a.ndcX * Math.tan(((SPECS_FOV.h / 2) * Math.PI) / 180) * d;
    const y = a.ndcY * Math.tan(((SPECS_FOV.v / 2) * Math.PI) / 180) * d;
    const t = this.obj.getTransform();
    t.setLocalPosition(new vec3(x, y, -d));
    // Point along the real direction on the 1 m plane (NDC angles are skewed by the 37° × 32° aspect).
    t.setLocalRotation(quat.angleAxis(Math.atan2(y, x), new vec3(0, 0, 1)));
  }
}
