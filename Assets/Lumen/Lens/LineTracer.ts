/**
 * LineTracer — one per IV line: the light-grey tube, the cyan trace glow with a flow dot running toward
 * the patient (1 loop / 1.5 s), the pump label, and (line 2) the amber pump→kink glow for the alarm.
 */
import * as L from "../Core/LumenLayout";
import * as M from "../Core/MeshGen";
import { LINES, LineId, TIMING } from "../Core/LumenData";
import { LumenView } from "../Core/LumenState";
import { SampledCurve, pointAtLength, sampleCurve, slice } from "../Core/Curves";
import { wrapLabel } from "../Core/ViewMath";
import { LensContext, local, placeAt } from "./LensContext";
import { addMeshVisual, buildMesh, child, makeMaterial, makeText, rgba, setText } from "./LensAdapters";
import { HEX } from "./Palette";

export class LineTracer {
  readonly line: LineId;
  readonly glow: SceneObject;
  readonly amber: SceneObject | null;
  readonly flowDot: SceneObject;
  readonly pumpLabel: Text;
  rawPumpLabel: string | null = null;
  private readonly curve: SampledCurve;

  constructor(ctx: LensContext, line: LineId) {
    this.line = line;
    this.curve = sampleCurve(L.LINE_LAYOUT[line].control, L.CURVE_SAMPLES_PER_SEGMENT);
    const tubeObj = child(ctx.specRoot, "Line_" + line + "_Tube");
    addMeshVisual(tubeObj, buildMesh(M.tube(this.curve.points, L.TUBE_RADIUS, 8, false), "world"), makeMaterial(ctx.litMaterial, { color: rgba(HEX.tube, 0.85) }));

    this.glow = child(ctx.specRoot, "Line_" + line + "_Glow");
    addMeshVisual(this.glow, buildMesh(M.tube(this.curve.points, L.GLOW_RADIUS, 10, true), "world"), makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.cyan, 0.85), additive: true }), 10);
    this.glow.enabled = false;

    this.flowDot = child(ctx.specRoot, "Line_" + line + "_FlowDot");
    addMeshVisual(this.flowDot, buildMesh(M.sphere({ r: 0, f: 0, u: 0 }, 1, 10, 12), "world"), makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.white, 1), additive: true }), 11);
    this.flowDot.enabled = false;

    const lay = L.LINE_LAYOUT[line];
    this.amber = null;
    if (lay.kinkIndex >= 0) {
      const from = this.curve.cumulative[this.curve.controlIndex[lay.pumpOutIndex]];
      const to = this.curve.cumulative[this.curve.controlIndex[lay.kinkIndex]];
      this.amber = child(ctx.specRoot, "Line_" + line + "_AlarmGlow");
      addMeshVisual(this.amber, buildMesh(M.tube(slice(this.curve, from, to), L.GLOW_RADIUS * 1.15, 10, true), "world"), makeMaterial(ctx.unlitMaterial, { color: rgba(HEX.amber, 0.9), additive: true }), 12);
      this.amber.enabled = false;
    }

    const pump = LINES[line].pump;
    const lo = placeAt(ctx, "Pump_" + pump + "_TraceLabel", L.PUMP_LABEL_ANCHOR[pump], true);
    this.pumpLabel = makeText(lo, { capCm: L.TEXT_CAP.large, align: "left", color: rgba(HEX.cyan, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
    setText(this.pumpLabel, null);
  }

  render(view: LumenView, t: number): void {
    const on = view.glowLine === this.line;
    this.glow.enabled = on;
    this.flowDot.enabled = on;
    if (on) {
      const k = (t % TIMING.flowDotLoop) / TIMING.flowDotLoop;
      this.flowDot.getTransform().setLocalPosition(local(pointAtLength(this.curve, k * this.curve.totalLength)));
    }
    if (this.amber) this.amber.enabled = !!view.alarm && view.alarm.line === this.line;
    this.rawPumpLabel = on ? view.pumpLabel : null;
    setText(this.pumpLabel, this.rawPumpLabel === null ? null : wrapLabel(this.rawPumpLabel, L.LABEL_WRAP_CHARS).join("\n"));
  }
}
