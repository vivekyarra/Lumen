/**
 * DC1–DC10 on the Lens's virtual clock via the hidden hook global.lumen.runSelfTest(): the same shared
 * scenarios (Core/Scenarios.ts) that CI runs, here against the real Lens Studio scene. Covers DC8 placement
 * (label screen boxes at the start pose, nothing closer than 40 cm) and the DC10 fail-safe, which the demo
 * data cannot reach by pinching.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { freshSession, lumen } from "./LumenLeaf";

@component
export class SelfTest_AllCriteria extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const results: { id: string; pass: boolean; error?: string }[] = await lumen().runSelfTest();
    expect(results.length).toBe(10);
    for (let i = 0; i < results.length; i++) {
      if (!results[i].pass) print("[LEAF] " + results[i].id + " FAIL: " + results[i].error);
      expect(results[i].pass).toBe(true);
    }
  }
}
