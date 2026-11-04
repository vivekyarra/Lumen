/** DC4 Trace — LEAF test_trace_lights_correct_line (every port, without and with a syringe). */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { lineForPort, PORT_IDS } from "../Core/LumenData";
import * as S from "../Core/Strings";
import { freshSession, glowingLines, HIT, lumen, LumenLeafInteractor, view } from "./LumenLeaf";

@component
export class DC4_TraceLightsOneLine extends Scenario {
  async run(): Promise<void> {
    const hand = new LumenLeafInteractor();
    for (let withSyringe = 0; withSyringe < 2; withSyringe++) {
      for (let i = 0; i < PORT_IDS.length; i++) {
        const p = PORT_IDS[i];
        const line = lineForPort(p).id;
        await freshSession();
        if (withSyringe) await hand.pinch(HIT.syringe("S1"));
        await hand.pinch(HIT.port(p));
        const v = view();
        expect(v.glowLine).toBe(line);
        const glowing = glowingLines();
        expect(glowing.length).toBe(1);
        expect(glowing[0]).toBe(line);
        expect(v.pumpLabel).toBe(S.pumpLabel(line));
        expect(lumen().lens.lines[line].rawPumpLabel).toBe(S.pumpLabel(line));
      }
    }
  }
}
