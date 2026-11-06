/**
 * DC11 Detail follows attention — LEAF test_detail_follows_attention.
 * Holds furosemide, then moves the head pose the Lens's attention tracker reads: from across the room,
 * looking away, at one port, at its neighbour 4 cm away, then leaning in. The rendered labels must follow every frame.
 * A pinch on a red port then shows the full answer wherever she looks.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import * as L from "../Core/LumenLayout";
import * as S from "../Core/Strings";
import { HIT, LumenLeafInteractor, freshSession, lookFrom, lumen, shown } from "./LumenLeaf";

@component
export class DC11_DetailFollowsAttention extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await sleep(400);
    const ports = lumen().lens.ports;
    try {
      // Far: across the room, looking straight at B. Only the cross, no words.
      await lookFrom({ r: L.PORT_POS.B.r, f: L.PORT_POS.B.f - 170, u: L.EYE_HEIGHT }, L.PORT_POS.B);
      expect(shown(ports.B.ring)).toBe(true);
      expect(ports.B.rawLabel).toBe(null);

      await lookFrom(L.START_EYE, L.CART_TARGET);
      expect(shown(ports.B.ring) && shown(ports.C.ring)).toBe(true);
      expect(ports.B.rawLabel).toBe(null);
      expect(ports.C.rawLabel).toBe(null);

      await lookFrom(L.START_EYE, L.PORT_POS.B);
      expect(ports.B.rawLabel).toBe(S.redShortText("B"));
      expect(ports.C.rawLabel).toBe(null);

      await lookFrom(L.START_EYE, L.PORT_POS.C);
      expect(ports.C.rawLabel).toBe(S.redShortText("C"));
      expect(ports.B.rawLabel).toBe(null);

      await lookFrom(L.LEAN_IN_EYE, L.HUB_TARGET);
      expect(ports.B.rawLabel).toBe(S.redShortText("B"));
      expect(ports.C.rawLabel).toBe(S.redShortText("C"));

      await lookFrom(L.START_EYE, L.CART_TARGET);
      await hand.pinch(HIT.port("B"));
      expect(ports.B.rawLabel).toBe(S.redFocusText("B"));
      expect(ports.A.rawLabel).toBe(S.useText("A"));
    } finally {
      lumen().lens.attention.overridePose = null;
    }
  }
}
