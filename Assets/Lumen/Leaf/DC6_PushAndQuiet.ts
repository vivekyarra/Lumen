/** DC6 Push and quiet — LEAF test_push_logs_and_returns_idle. */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { PORTS, SYRINGES } from "../Core/LumenData";
import { anyRingShown, freshSession, HIT, lumen, LumenLeafInteractor, shown, view } from "./LumenLeaf";

@component
export class DC6_PushAndQuiet extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await hand.pinch(HIT.port("A"));
    expect(view().pushButtonPort).toBe("A");
    expect(shown(lumen().lens.push.root)).toBe(true);
    await hand.pinch(HIT.push);
    const log: string = view().logText;
    const prefix = SYRINGES.S1.label + " → " + PORTS.A.logName + " · ";
    expect(log.indexOf(prefix) === 0).toBe(true);
    expect(/^\d\d:\d\d$/.test(log.substring(prefix.length))).toBe(true);
    expect(lumen().lens.tray.raw.log).toBe(log);
    await sleep(2000);
    expect(view().mode).toBe("IDLE");
    expect(anyRingShown()).toBe(false);
  }
}
