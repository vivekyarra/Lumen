/** DC5 Redirect — LEAF test_red_port_redirects. */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import * as S from "../Core/Strings";
import { freshSession, HIT, lumen, LumenLeafInteractor, shown, view } from "./LumenLeaf";

@component
export class DC5_RedirectFromRedPort extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await hand.pinch(HIT.port("B"));
    const lens = lumen().lens;
    const v = view();
    expect(lens.ports.B.rawLabel).toBe(S.redFocusText("B"));
    expect(v.pushButtonPort).toBeNull();
    expect(shown(lens.push.root)).toBe(false);
    expect(v.redirect.to).toBe("A");
    expect(v.redirect.label).toBe(S.useText("A"));
    expect(lens.redirect.visible()).toBe(true);
  }
}
