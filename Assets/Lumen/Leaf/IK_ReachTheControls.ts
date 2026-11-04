/**
 * Reachability — the LEAF IK avatar pinches the syringe, a port and "Push here" the way a standing nurse would.
 * Lumen's ports sit about 1 m from the eyes, so SIK may route them far-field (ray pinch); that is by design.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { createIKInteractor } from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar";
import { freshSession, HIT, view } from "./LumenLeaf";

@component
export class IK_ReachTheControls extends Scenario {
  private readonly ik = createIKInteractor();

  async run(): Promise<void> {
    await freshSession();
    await this.ik.trigger(findInteractableByName(HIT.syringe("S1")));
    await sleep(500);
    expect(view().held).toBe("S1");
    await this.ik.trigger(findInteractableByName(HIT.port("A")));
    await sleep(500);
    expect(view().pushButtonPort).toBe("A");
    await this.ik.trigger(findInteractableByName(HIT.push));
    await sleep(500);
    expect(view().logText !== null).toBe(true);
  }
}
