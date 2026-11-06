/** DC2 Pick up shows markers — LEAF test_pickup_shows_markers. */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import * as S from "../Core/Strings";
import * as L from "../Core/LumenLayout";
import { freshSession, HIT, lookFrom, lumen, LumenLeafInteractor, shown, view } from "./LumenLeaf";

@component
export class DC2_PickUpShowsMarkers extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await sleep(400); // markers fade in over 0.3 s
    const v = view();
    expect(v.mode).toBe("HOLDING");
    expect(v.chipText).toBe(S.holdingText("S1"));
    expect(v.ports.A.marker).toBe("compatible");
    expect(v.ports.D.marker).toBe("compatible");
    expect(v.ports.B.marker).toBe("incompatible");
    expect(v.ports.C.marker).toBe("incompatible");
    const ports = lumen().lens.ports;
    // Leaning in over the central line: every red port says why.
    await lookFrom(L.LEAN_IN_EYE, L.HUB_TARGET);
    expect(ports.B.rawLabel).toBe(S.redShortText("B"));
    expect(ports.C.rawLabel).toBe(S.redShortText("C"));
    expect(shown(ports.A.ring) && shown(ports.B.ring) && shown(ports.C.ring) && shown(ports.D.ring)).toBe(true);
    lumen().lens.attention.overridePose = null;
  }
}
