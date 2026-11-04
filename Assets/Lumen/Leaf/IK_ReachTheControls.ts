/**
 * Reachability — the LEAF IK avatar (arm + head) pinches the hub controls the way a standing nurse would:
 * the green port, then "Push here". The syringe is picked up with the scripted interactor first: the cart
 * sits at the head of the bed, ~94° left of the start view, which needs a body turn the IK avatar (head-only
 * aim) does not model — LEAF reported exactly that ("out_of_fov … 94.1° off-axis") when the IK hand tried it.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { createIKInteractor } from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar";
import { freshSession, HIT, LumenLeafInteractor, view } from "./LumenLeaf";

@component
export class IK_ReachTheControls extends Scenario {
  private readonly ik = createIKInteractor();

  async run(): Promise<void> {
    await freshSession();
    await new LumenLeafInteractor().pinch(HIT.syringe("S1"));
    expect(view().held).toBe("S1");
    await this.ik.trigger(findInteractableByName(HIT.port("A")));
    await sleep(500);
    expect(view().pushButtonPort).toBe("A");
    await this.ik.trigger(findInteractableByName(HIT.push));
    await sleep(500);
    expect(view().logText !== null).toBe(true);
  }
}
