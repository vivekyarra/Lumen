/**
 * PortMarker — one per port: faint idle dot, green ✓ / red ✕ ring, focus scale, confirm pulse,
 * the port's label slot, and the forgiving 6 cm pinch target.
 */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { PortId, TIMING } from "../Core/LumenData";
import { PortView } from "../Core/LumenState";
import { wrapLabel } from "../Core/ViewMath";
import { LensContext, placeAt } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, makePinchTarget, makeText, rgba, setColor, setText } from "./LensAdapters";
import { HEX } from "./Palette";

export class PortMarker {
  readonly port: PortId;
  readonly dot: SceneObject;
  readonly ring: SceneObject;
  readonly pulse: SceneObject;
  readonly label: Text;
  readonly hit: SceneObject;
  private readonly ringMat: Material;
  private readonly checkMat: Material;
  private readonly crossMat: Material;
  private readonly pulseMat: Material;
  private readonly check: SceneObject;
  private readonly cross: SceneObject;
  private pulseStart = -1;
  /** Text calibration scale set by makeText; the pop-in multiplies it. */
  private labelBase: vec3;

  constructor(ctx: LensContext, port: PortId, onPinch: (port: PortId, hitWorld: vec3 | null) => void) {
    this.port = port;
    const pos = L.PORT_POS[port];
    this.dot = placeAt(ctx, "Port_" + port + "_IdleDot", pos, true);
    addMeshVisual(this.dot, buildMesh(M.discXY(L.IDLE_DOT_DIAMETER, 24), "billboard"), makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.white, 0.3), onTop: true }), 20);

    this.ring = placeAt(ctx, "Port_" + port + "_Marker", pos, true);
    this.ringMat = makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.green, 1), onTop: true, fade: true });
    addMeshVisual(this.ring, buildMesh(M.ringXY(L.MARKER_RING_DIAMETER, 0.45, 48), "billboard"), this.ringMat, 25);
    this.check = child(this.ring, "Check");
    this.checkMat = makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.green, 1), onTop: true, fade: true });
    addMeshVisual(this.check, buildMesh(M.checkXY(1.8, 0.4), "billboard"), this.checkMat, 25);
    this.cross = child(this.ring, "Cross");
    this.crossMat = makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.red, 1), onTop: true, fade: true });
    addMeshVisual(this.cross, buildMesh(M.crossXY(1.9, 0.4), "billboard"), this.crossMat, 25);
    this.ring.enabled = false;

    this.pulse = placeAt(ctx, "Port_" + port + "_Pulse", pos, true);
    this.pulseMat = makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.green, 0), onTop: true });
    addMeshVisual(this.pulse, buildMesh(M.ringXY(L.MARKER_RING_DIAMETER, 0.6, 48), "billboard"), this.pulseMat, 25);
    this.pulse.enabled = false;

    const slot = L.PORT_LABEL_SLOT[port];
    const labelObj = placeAt(ctx, "Port_" + port + "_Label", slot.anchor, true);
    this.label = makeText(labelObj, { capCm: L.TEXT_CAP.small, align: slot.align, color: rgba(HEX.white, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
    setText(this.label, null);
    this.labelBase = labelObj.getTransform().getLocalScale();

    this.hit = placeAt(ctx, "Port_" + port + "_Hit", pos, false);
    const self = this;
    makePinchTarget(this.hit, { sphere: L.PORT_HIT_RADIUS }, function (h) { onPinch(self.port, h); });
  }

  /** Unwrapped text currently shown in the label slot (null when hidden). */
  rawLabel: string | null = null;

  render(pv: PortView, t: number, labelScale?: number): void {
    this.rawLabel = pv.label;
    const labelText = pv.label === null ? null : wrapLabel(pv.label, L.LABEL_WRAP_CHARS).join("\n");
    const showRing = pv.marker !== "idle" && pv.opacity > 0.001;
    this.dot.enabled = !showRing;
    this.ring.enabled = showRing;
    const green = pv.marker === "compatible";
    setColor(this.ringMat, rgba(green ? HEX.green : HEX.red, pv.opacity));
    setColor(this.checkMat, rgba(HEX.green, pv.opacity));
    setColor(this.crossMat, rgba(HEX.red, pv.opacity));
    this.check.enabled = green;
    this.cross.enabled = !green;
    const s = pv.focused ? 1.3 : 1;
    this.ring.getTransform().setLocalScale(new vec3(s, s, s));
    const color = pv.labelRole === "incompatible" ? HEX.red : pv.labelRole === "compatible" ? HEX.green : pv.labelRole === "redirect" ? HEX.cyan : HEX.white;
    setText(this.label, labelText, rgba(color, 1));
    // Words pop in when she looks at the port, then settle.
    const ls = labelScale === undefined ? 1 : labelScale;
    this.label.getSceneObject().getTransform().setLocalScale(this.labelBase.uniformScale(ls));
    if (pv.pulse) {
      if (this.pulseStart < 0) this.pulseStart = t;
      const k = Math.min(1, (t - this.pulseStart) / TIMING.confirmToIdle);
      this.pulse.enabled = k < 1;
      const sc = 1 + k * 1.6;
      this.pulse.getTransform().setLocalScale(new vec3(sc, sc, sc));
      setColor(this.pulseMat, rgba(HEX.green, 1 - k));
    } else {
      this.pulseStart = -1;
      this.pulse.enabled = false;
    }
  }
}
