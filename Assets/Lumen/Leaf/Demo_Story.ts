/**
 * Not a test: the one-take walkthrough for the video, played in the real Lens Studio preview through the
 * same SIK interactables a mouse pinch uses. The recorder starts it over MCP, moves the preview camera on
 * the same timeline (far → cart → walk in → look at B, then C → lean in → pumps → kink → pole → morphine → step back)
 * and records the Lens Studio window in one unbroken take.
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
    print("[Lumen demo] t0"); // the recorder syncs the preview camera to this line
    await at(t0, 5.0); await hand.pinch(HIT.syringe("S1"));   // pick up furosemide (seen from across the room)
    // 6–20 s: no pinch. She walks in, looks at B, then C, then leans in; the words follow her head.
    await at(t0, 20.5); await hand.pinch(HIT.port("B"));      // the red port: full answer, arrow, line to its pump
    await at(t0, 28.5); await hand.pinch(HIT.port("A"));      // Distal: Push here
    await at(t0, 30.8); await hand.pinch(HIT.push);           // logged; the pump alarm fires 4 s later
    await at(t0, 44.5); await hand.pinch(HIT.resolved);       // kink fixed
    await at(t0, 47.5); await hand.pinch(HIT.pole);           // shift-handoff line check (10 s)
    await at(t0, 59.0); await hand.pinch(HIT.syringe("S2"));  // morphine: every port turns green at once
    await at(t0, 68);
  }
}
