/**
 * Not a test: the demo-video walkthrough, played in the real Lens Studio preview through the same SIK
 * interactables a mouse pinch uses. tools/record-lens-studio.mjs starts it over MCP, turns the preview
 * camera on the same timeline (cart → hub → pumps → pole) and records the Preview panel.
 * Timeline (seconds from start) is mirrored in that tool; change both together.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { freshSession, HIT, LumenLeafInteractor } from "./LumenLeaf";

async function at(t0: number, sec: number): Promise<void> {
  const wait = t0 + sec * 1000 - Date.now();
  if (wait > 0) await sleep(wait);
}

@component
export class Demo_Story extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    const t0 = Date.now();
    print("[Lumen demo] t0"); // tools/record-lens-studio.mjs syncs the camera to this line
    await at(t0, 5); await hand.pinch(HIT.syringe("S1"));   // pick up furosemide (camera on cart)
    await at(t0, 11); await hand.pinch(HIT.port("B"));      // red port → trace + redirect (camera on hub)
    await at(t0, 17); await hand.pinch(HIT.port("A"));      // green port → Push here
    await at(t0, 21); await hand.pinch(HIT.push);           // push → log → quiet; alarm 4 s later
    await at(t0, 33); await hand.pinch(HIT.resolved);       // resolve the kinked line
    await at(t0, 38); await hand.pinch(HIT.pole);           // shift-handoff line check (10 s)
    await at(t0, 51);
  }
}
