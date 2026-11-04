/**
 * SyringeTray — the cart's Lens content: pinch targets for the two syringes (stand-in for a barcode scan),
 * printed barrel labels, the "Holding: …" chip (pinch = put down), the push log line, the first-time hint,
 * and the always-on "Demo data — not for clinical use" label (LUMEN_SPEC.md §8.4, §8.5).
 */
import * as L from "../Core/LumenLayout";
import { DEMO_DATA_LABEL, SYRINGE_IDS, SYRINGES, SyringeId } from "../Core/LumenData";
import { LumenView } from "../Core/LumenState";
import { wrapLabel } from "../Core/ViewMath";
import { LensContext, placeAt } from "./LensContext";
import { makePinchTarget, makeText, rgba, setText } from "./LensAdapters";
import { HEX } from "./Palette";

export class SyringeTray {
  readonly chip: Text;
  readonly log: Text;
  readonly hint: Text;
  readonly demo: Text;
  readonly raw: { chip: string | null; log: string | null; hint: string | null } = { chip: null, log: null, hint: null };

  constructor(ctx: LensContext, onSyringe: (id: SyringeId) => void, onChip: () => void) {
    const opts = function (align: "left" | "center" | "right", hex: number) {
      return { capCm: L.TEXT_CAP.small, align: align, color: rgba(hex, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true };
    };
    for (let i = 0; i < SYRINGE_IDS.length; i++) {
      const s = SYRINGE_IDS[i];
      const hit = placeAt(ctx, "Syringe_" + s + "_Hit", L.SYRINGE_LAYOUT[s].center, false);
      const sz = L.SYRINGE_LAYOUT[s].hitSize;
      makePinchTarget(hit, { box: new vec3(sz.r, sz.u, sz.f) }, function () { onSyringe(s); });
      const slot = L.SYRINGE_LABEL_SLOT[s];
      const tag = placeAt(ctx, "Syringe_" + s + "_Label", slot.anchor, true);
      const t = makeText(tag, { capCm: L.SYRINGE_LABEL_CAP, align: slot.align, color: rgba(HEX.white, 1), cmPerPoint: ctx.cmPerPoint, font: ctx.font, onTop: true });
      setText(t, SYRINGES[s].label);
    }
    const chipObj = placeAt(ctx, "Cart_HoldingChip", L.CART_TEXT.chip.anchor, true);
    this.chip = makeText(chipObj, opts("center", HEX.white));
    makePinchTarget(chipObj, { box: new vec3(28, 5, 2) }, onChip);
    this.log = makeText(placeAt(ctx, "Cart_LogLine", L.CART_TEXT.log.anchor, true), opts("center", HEX.green));
    this.hint = makeText(placeAt(ctx, "Cart_Hint", L.CART_TEXT.hint.anchor, true), opts("center", HEX.white));
    this.demo = makeText(placeAt(ctx, "Cart_DemoDataLabel", L.CART_TEXT.demoLabel.anchor, true), opts("center", HEX.amber));
    setText(this.demo, wrapLabel(DEMO_DATA_LABEL, L.LABEL_WRAP_CHARS).join("\n"));
    setText(this.chip, null);
    setText(this.log, null);
  }

  render(view: LumenView): void {
    this.raw.chip = view.chipText;
    this.raw.log = view.logText;
    this.raw.hint = view.hintText;
    const w = function (s: string | null) { return s === null ? null : wrapLabel(s, L.LABEL_WRAP_CHARS).join("\n"); };
    setText(this.chip, w(view.chipText));
    setText(this.log, w(view.logText));
    setText(this.hint, w(view.hintText));
  }
}
