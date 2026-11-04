/** DC7 Alarm — LEAF test_alarm_shows_and_resolves (fires 4 s after the first push, as in the demo). */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { ALARM } from "../Core/LumenData";
import { freshSession, HIT, lumen, LumenLeafInteractor, shown, view } from "./LumenLeaf";

@component
export class DC7_PumpAlarm extends Scenario {
  async run(): Promise<void> {
    await freshSession();
    const hand = new LumenLeafInteractor();
    await hand.pinch(HIT.syringe("S1"));
    await hand.pinch(HIT.port("A"));
    await hand.pinch(HIT.push);
    expect(view().alarm).toBeNull();
    await sleep(ALARM.delayAfterFirstPushSec * 1000 + 600);
    const lens = lumen().lens;
    const v = view();
    expect(v.alarm.pump).toBe(ALARM.pump);
    expect(v.alarm.text).toBe(ALARM.text);
    expect(v.alarm.kinkText).toBe(ALARM.kinkText);
    expect(shown(lens.alarm.pumpShell)).toBe(true);
    expect(shown(lens.lines[ALARM.line].amber)).toBe(true);
    expect(shown(lens.alarm.kinkRing)).toBe(true);
    expect(shown(lens.alarm.resolved.root)).toBe(true);
    const beep = lens.audio.lastPlayedAt("alarm");
    expect(beep !== null && lens.lensTime - beep <= ALARM.beepIntervalSec + 0.1).toBe(true);
    await hand.pinch(HIT.resolved);
    expect(view().alarm).toBeNull();
    expect(shown(lens.alarm.pumpShell)).toBe(false);
    expect(shown(lens.lines[ALARM.line].amber)).toBe(false);
    expect(shown(lens.alarm.kinkRing)).toBe(false);
    expect(shown(lens.alarm.resolved.root)).toBe(false);
    expect(shown(lens.alarm.edge.obj)).toBe(false);
  }
}
