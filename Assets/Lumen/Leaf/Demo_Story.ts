/**
 * Not a test: the demo-video walkthrough, played in the real Lens Studio preview through the same SIK
 * interactables a mouse pinch uses. tools/record-lens-studio.mjs starts it over MCP, turns the preview
 * camera on the same timeline (cart → hub → pumps → kink → pole) and records the Lens Studio window.
 * Pinch times are timed to the voice-over (tools/video/vo.json); change them together with SHOTS in that tool.
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
    await at(t0, 5.0); await hand.pinch(HIT.syringe("S1"));   // "She picks up furosemide…"
    await at(t0, 13.6); await hand.pinch(HIT.port("B"));      // "She pinches the red one."
    await at(t0, 25.0); await hand.pinch(HIT.port("A"));      // "Distal. Push here."
    await at(t0, 27.3); await hand.pinch(HIT.push);           // "Done. Logged." — alarm fires 4 s later
    await at(t0, 42.5); await hand.pinch(HIT.resolved);       // "She fixes it. Resolved."
    await at(t0, 45.0); await hand.pinch(HIT.pole);           // shift-handoff line check (10 s)
    await at(t0, 56);
  }
}
