/** Shared handles every Lumen Lens part needs. */
import { SpecFrame } from "./LensAdapters";
import { V3 } from "../Core/Vec";

export interface LensContext {
  frame: SpecFrame;
  /** Sits at the spec origin with the spec heading: children use local (r, u, −f). */
  specRoot: SceneObject;
  litMaterial: Material;
  unlitMaterial: Material;
  font: Font | undefined;
  cmPerPoint: number;
  /** Objects turned to face the camera every frame. */
  billboards: SceneObject[];
}

/** Spec point → local position under specRoot. */
export function local(p: V3): vec3 {
  return new vec3(p.r, p.u, -p.f);
}

export function placeAt(ctx: LensContext, name: string, p: V3, billboard: boolean): SceneObject {
  const o = global.scene.createSceneObject(name);
  o.setParent(ctx.specRoot);
  o.getTransform().setLocalPosition(local(p));
  if (billboard) ctx.billboards.push(o);
  return o;
}
