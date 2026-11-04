/** Registers Lumen's LEAF scenarios. This script sits on a root SceneObject named "LeafIndex". */
import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { DC1_IdleIsQuiet } from "./DC1_IdleIsQuiet";
import { DC2_PickUpShowsMarkers } from "./DC2_PickUpShowsMarkers";
import { DC3_DataNotArt } from "./DC3_DataNotArt";
import { DC4_TraceLightsOneLine } from "./DC4_TraceLightsOneLine";
import { DC5_RedirectFromRedPort } from "./DC5_RedirectFromRedPort";
import { DC6_PushAndQuiet } from "./DC6_PushAndQuiet";
import { DC7_PumpAlarm } from "./DC7_PumpAlarm";
import { DC9_HandoffLineCheck } from "./DC9_HandoffLineCheck";
import { IK_ReachTheControls } from "./IK_ReachTheControls";
import { SelfTest_AllCriteria } from "./SelfTest_AllCriteria";
import { Demo_Story } from "./Demo_Story";

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "test_idle_is_quiet", typename: DC1_IdleIsQuiet.getTypeName() },
    { id: "test_pickup_shows_markers", typename: DC2_PickUpShowsMarkers.getTypeName() },
    { id: "test_switch_syringe_changes_markers", typename: DC3_DataNotArt.getTypeName() },
    { id: "test_trace_lights_correct_line", typename: DC4_TraceLightsOneLine.getTypeName() },
    { id: "test_red_port_redirects", typename: DC5_RedirectFromRedPort.getTypeName() },
    { id: "test_push_logs_and_returns_idle", typename: DC6_PushAndQuiet.getTypeName() },
    { id: "test_alarm_shows_and_resolves", typename: DC7_PumpAlarm.getTypeName() },
    { id: "test_handoff_line_check", typename: DC9_HandoffLineCheck.getTypeName() },
    { id: "test_ik_reach_controls", typename: IK_ReachTheControls.getTypeName() },
    { id: "test_self_test_dc1_dc10", typename: SelfTest_AllCriteria.getTypeName() },
    // Not a test: the demo-video walkthrough (tools/record-lens-studio.mjs).
    { id: "demo_story", typename: Demo_Story.getTypeName() },
  ];
}
