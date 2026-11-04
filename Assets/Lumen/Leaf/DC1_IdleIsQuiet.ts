/** DC1 Quiet idle — LEAF test_idle_is_quiet. */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { PORT_IDS } from "../Core/LumenData";
import { anyRingShown, freshSession, glowingLines, lumen, shown, view } from "./LumenLeaf";

@component
export class DC1_IdleIsQuiet extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const lens = lumen().lens;
    expect(view().mode).toBe("IDLE");
    for (let i = 0; i < PORT_IDS.length; i++) expect(shown(lens.ports[PORT_IDS[i]].dot)).toBe(true);
    expect(anyRingShown()).toBe(false);
    expect(glowingLines().length).toBe(0);
    expect(shown(lens.push.root)).toBe(false);
    expect(shown(lens.alarm.resolved.root)).toBe(false);
    expect(shown(lens.tray.demo.getSceneObject())).toBe(true);
  }
}
