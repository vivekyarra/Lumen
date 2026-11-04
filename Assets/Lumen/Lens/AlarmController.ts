/**
 * AlarmController — the pump-alarm layer (LUMEN_SPEC.md §8.4 ALARM): amber Pump 2 shell + "Downstream
 * occlusion", pulsing 6 cm ring at the kink with "Check here: kinked line", the "Resolved" button and the
 * out-of-view edge arrow. The amber line glow lives in LineTracer. Timing and the debug trigger live in
 * LumenState (alarm 4 s after the first push; hidden test hook).
 */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { ALARM } from "../Core/LumenData";
import { LumenView } from "../Core/LumenState";
import { Pose, SPECS_FOV, edgeArrow } from "../Core/ViewMath";
import { v3 } from "../Core/Vec";
import * as S from "../Core/Strings";
import { LensContext, placeAt } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, makeText, rgba, setColor, setText } from "./LensAdapters";
import { PushButton } from "./PushButton";
import { EdgeArrow } from "./EdgeArrow";
import { HEX } from "./Palette";

export class AlarmController {
  readonly pumpShell: SceneObject;
  readonly kinkRing: SceneObject;
  readonly alarmText: Text;
  readonly kinkText: Text;
  readonly resolved: PushButton;
  readonly edge: EdgeArrow;
  private readonly shellMat: Material;
  active = false;

  constructor(ctx: LensContext, camera: SceneObject, onResolved: () => void) {
    const pump = L.PUMPS[ALARM.pump];
    this.pumpShell = child(ctx.specRoot, "Pump_" + ALARM.pump + "_AlarmShell");
    this.shellMat = makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.amber, 0.35), additive: true });
    addMeshVisual(this.pumpShell, buildMesh(M.box(pump.center, v3(pump.size.r + 2, pump.size.f + 2, pump.size.u + 2)), "world"), this.shellMat, 13);
    this.pumpShell.enabled = false;
    this.alarmText = makeText(placeAt(ctx, "Pump_AlarmText", L.PUMP_ALARM_TEXT_ANCHOR, true), { capCm: L.TEXT_CAP.large, align: "right", color: rgba(HEX.amber, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
    this.kinkRing = placeAt(ctx, "Kink_Ring", L.KINK_POS, true);
    addMeshVisual(this.kinkRing, buildMesh(M.ringXY(L.KINK_RING_DIAMETER, 0.7, 64), "billboard"), makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.amber, 0.95), onTop: true }), 25);
    this.kinkRing.enabled = false;
    this.kinkText = makeText(placeAt(ctx, "Kink_Text", L.KINK_TEXT_ANCHOR, true), { capCm: L.TEXT_CAP.small, align: "center", color: rgba(HEX.amber, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
    this.resolved = new PushButton(ctx, "Kink_ResolvedButton", S.RESOLVED_TEXT, HEX.amber, L.RESOLVED_BUTTON_POS, onResolved);
    this.edge = new EdgeArrow(camera, ctx.unlitMaterial);
    setText(this.alarmText, null);
    setText(this.kinkText, null);
  }

  render(view: LumenView, t: number, pose: Pose): void {
    const a = view.alarm;
    this.active = !!a;
    this.pumpShell.enabled = !!a;
    this.kinkRing.enabled = !!a;
    this.resolved.show(a ? L.RESOLVED_BUTTON_POS : null);
    setText(this.alarmText, a ? a.text : null);
    setText(this.kinkText, a ? a.kinkText : null);
    if (a) {
      const k = 1 + 0.18 * Math.sin(t * Math.PI * 2 * 1.2);
      this.kinkRing.getTransform().setLocalScale(new vec3(k, k, k));
      setColor(this.shellMat, rgba(HEX.amber, 0.25 + 0.2 * (0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 1.2))));
      this.edge.render(edgeArrow(pose, L.PUMPS[ALARM.pump].center, SPECS_FOV, 0.1));
    } else {
      this.edge.render(null);
    }
  }
}
