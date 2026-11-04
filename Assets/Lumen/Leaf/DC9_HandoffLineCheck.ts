/** DC9 Shift-handoff line check — LEAF test_handoff_line_check (pinch the IV pole). */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { LINE_IDS, TIMING } from "../Core/LumenData";
import { freshSession, glowingLines, HIT, LumenLeafInteractor, view } from "./LumenLeaf";

@component
export class DC9_HandoffLineCheck extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.pole);
    expect(view().mode).toBe("HANDOFF");
    expect(glowingLines().length).toBe(1);
    await sleep(LINE_IDS.length * TIMING.handoffStep * 1000 + 700);
    const v = view();
    expect(v.mode).toBe("IDLE");
    const log: string = v.logText;
    expect(log.indexOf("Lines checked · " + LINE_IDS.length + " of " + LINE_IDS.length + " · ") === 0).toBe(true);
  }
}
