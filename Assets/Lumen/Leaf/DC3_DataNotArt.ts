/** DC3 Data, not art — LEAF test_switch_syringe_changes_markers. */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { PORT_IDS } from "../Core/LumenData";
import * as S from "../Core/Strings";
import { anyRingShown, freshSession, HIT, LumenLeafInteractor, view } from "./LumenLeaf";

@component
export class DC3_DataNotArt extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await hand.pinch(HIT.syringe("S2"));
    await sleep(400);
    let v = view();
    expect(v.chipText).toBe(S.holdingText("S2"));
    for (let i = 0; i < PORT_IDS.length; i++) expect(v.ports[PORT_IDS[i]].marker).toBe("compatible");
    await hand.pinch(HIT.syringe("S2")); // put it down
    await sleep(400);
    v = view();
    expect(v.mode).toBe("IDLE");
    expect(v.held).toBeNull();
    expect(anyRingShown()).toBe(false);
  }
}
