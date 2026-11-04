/**
 * PushButton — big "Push here" (9 × 4 cm, green outline, white text, 12 × 6 cm pinch target), shown only
 * next to a focused green port. Also used for the amber "Resolved" button.
 */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { V3 } from "../Core/Vec";
import { LensContext, local, placeAt } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, makePinchTarget, makeText, rgba, setText } from "./LensAdapters";

export class PushButton {
  readonly root: SceneObject;
  readonly text: Text;
  readonly caption: string;

  constructor(ctx: LensContext, name: string, caption: string, hex: number, at: V3, onPinch: () => void) {
    this.caption = caption;
    this.root = placeAt(ctx, name, at, true);
    addMeshVisual(child(this.root, "Fill"), buildMesh(M.rectXY(L.BUTTON_SIZE.w, L.BUTTON_SIZE.h), "billboard"), makeMaterial(ctx.unlitMaterial, { color: rgba(hex, 0.14), onTop: true }), 26);
    addMeshVisual(child(this.root, "Outline"), buildMesh(M.rectOutlineXY(L.BUTTON_SIZE.w, L.BUTTON_SIZE.h, 0.3), "billboard"), makeMaterial(ctx.unlitMaterial, { color: rgba(hex, 1), onTop: true }), 27);
    const textObj = child(this.root, "Text");
    textObj.getTransform().setLocalPosition(new vec3(0, -L.TEXT_CAP.small * 0.6, 0.05));
    this.text = makeText(textObj, { capCm: L.TEXT_CAP.small, align: "center", color: rgba(0xffffff, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
    setText(this.text, caption);
    makePinchTarget(this.root, { box: new vec3(L.BUTTON_HIT.w, L.BUTTON_HIT.h, 2) }, onPinch);
    this.root.enabled = false;
  }

  show(at: V3 | null): void {
    this.root.enabled = at !== null;
    if (at) this.root.getTransform().setLocalPosition(local(at));
  }
}
