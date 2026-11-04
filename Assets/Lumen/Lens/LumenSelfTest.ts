/**
 * LumenSelfTest — runs the shared DC1–DC8 scenarios inside the Lens Studio preview against the real
 * Lens scene (Driver + SceneProbe), and prints a LEAF-style PASS/FAIL table to the Logger.
 * Trigger: tick "Run Self Test On Start" on LumenLens, or call `global.lumen.runSelfTest()` from a LEAF test.
 */
import * as L from "../Core/LumenLayout";
import { LINE_IDS, LINES, LineId, PORT_IDS, PortId, ALARM } from "../Core/LumenData";
import { Driver, ProbeKey, SceneProbe, ScenarioResult, runScenarios } from "../Core/Scenarios";
import { SPECS_FOV, labelScreenBox, labelSizeCm, lookAt, overlappingPairs, LabelBox, Align } from "../Core/ViewMath";
import { distance } from "../Core/Vec";
import { DEMO_DATA_LABEL } from "../Core/LumenData";
import type { LumenLens } from "./LumenLens";
import { darkPaletteEntries } from "./Palette";

function on(o: SceneObject): boolean {
  return o.isEnabledInHierarchy;
}

function makeProbe(lens: LumenLens): SceneProbe {
  let pose = lookAt(L.START_EYE, L.HUB_TARGET);
  const labelBox = function (id: string, text: string | null, anchor: { r: number; f: number; u: number }, align: Align, cap: number): LabelBox | null {
    if (text === null) return null;
    const z = labelSizeCm(text, cap, L.LABEL_WRAP_CHARS);
    const b = labelScreenBox(id, pose, anchor, z.w, z.h, align, SPECS_FOV);
    if (b.maxX < -1 || b.minX > 1 || b.maxY < -1 || b.minY > 1) return null;
    return b;
  };
  return {
    visible(key: ProbeKey, index?: string): boolean {
      lens.renderNow();
      switch (key) {
        case "port.idleDot": return on(lens.ports[index as PortId].dot);
        case "port.ring": return on(lens.ports[index as PortId].ring);
        case "line.glow": return on(lens.lines[Number(index) as LineId].glow);
        case "line.amber": { const a = lens.lines[Number(index) as LineId].amber; return !!a && on(a); }
        case "pump.alarm": return on(lens.alarm.pumpShell);
        case "kink.ring": return on(lens.alarm.kinkRing);
        case "button.push": return on(lens.push.root);
        case "button.resolved": return on(lens.alarm.resolved.root);
        case "redirect.arrow": return lens.redirect.visible();
        case "edgeArrow": return on(lens.alarm.edge.obj);
        case "chip": return lens.tray.raw.chip !== null;
        case "log": return lens.tray.raw.log !== null;
        case "demoLabel": return on(lens.tray.demo.getSceneObject());
      }
      return false;
    },
    text(key: string): string | null {
      lens.renderNow();
      if (key.indexOf("port.") === 0) return lens.ports[key.substring(5) as PortId].rawLabel;
      if (key.indexOf("pump.") === 0) {
        const pump = Number(key.substring(5));
        for (let i = 0; i < LINE_IDS.length; i++) {
          if (LINES[LINE_IDS[i]].pump === pump) return lens.lines[LINE_IDS[i]].rawPumpLabel;
        }
        return null;
      }
      if (key === "chip") return lens.tray.raw.chip;
      if (key === "log") return lens.tray.raw.log;
      const v = lens.sm.view();
      if (key === "kink") return v.alarm && lens.alarm.active ? v.alarm.kinkText : null;
      if (key === "pumpAlarm") return v.alarm && lens.alarm.active ? v.alarm.text : null;
      if (key === "redirect") return v.redirect && lens.redirect.visible() ? lens.ports[v.redirect.to].rawLabel : null;
      return null;
    },
    lookAtHub(): void { pose = lookAt(L.START_EYE, L.HUB_TARGET); },
    lookAtCart(): void { pose = lookAt(L.START_EYE, L.CART_TARGET); },
    overlappingLabels(): string[] {
      lens.renderNow();
      const boxes: (LabelBox | null)[] = [];
      for (let i = 0; i < PORT_IDS.length; i++) {
        const p = PORT_IDS[i];
        boxes.push(labelBox("port." + p, lens.ports[p].rawLabel, L.PORT_LABEL_SLOT[p].anchor, L.PORT_LABEL_SLOT[p].align, L.TEXT_CAP.small));
      }
      boxes.push(labelBox("chip", lens.tray.raw.chip, L.CART_TEXT.chip.anchor, "center", L.TEXT_CAP.small));
      boxes.push(labelBox("log", lens.tray.raw.log, L.CART_TEXT.log.anchor, "center", L.TEXT_CAP.small));
      boxes.push(labelBox("hint", lens.tray.raw.hint, L.CART_TEXT.hint.anchor, "center", L.TEXT_CAP.small));
      boxes.push(labelBox("demo", DEMO_DATA_LABEL, L.CART_TEXT.demoLabel.anchor, "center", L.TEXT_CAP.small));
      const v = lens.sm.view();
      if (v.pushButtonPort) boxes.push(labelBox("push", "Push here!", L.PUSH_BUTTON_POS[v.pushButtonPort], "center", L.TEXT_CAP.small));
      const real: LabelBox[] = [];
      for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (b) real.push(b); }
      return overlappingPairs(real);
    },
    minUiDistanceCm(): number {
      // Measured from the start eye, like DC8 asks ("from the start position").
      let min = Infinity;
      const pts = [L.PORT_POS.A, L.PORT_POS.B, L.PORT_POS.C, L.PORT_POS.D, L.CART_TEXT.chip.anchor, L.CART_TEXT.log.anchor,
        L.CART_TEXT.hint.anchor, L.CART_TEXT.demoLabel.anchor, L.KINK_POS, L.RESOLVED_BUTTON_POS, L.PUSH_BUTTON_POS.A, L.PUSH_BUTTON_POS.D];
      for (let i = 0; i < pts.length; i++) min = Math.min(min, distance(L.START_EYE, pts[i]));
      return Math.min(min, 100); // edge arrow sits at 1 m
    },
    darkContentCount(): number {
      // Every Lumen material is coloured from Palette.ts; tests/unit/palette.test.ts fails CI on any dark entry.
      return darkPaletteEntries();
    },
    alarmSoundPlaying(): boolean {
      const last = lens.audio.lastPlayedAt("alarm");
      return lens.sm.isAlarmActive() && last !== null && lens.lensTime - last <= ALARM.beepIntervalSec + 0.05;
    },
  };
}

function makeDriver(lens: LumenLens): Driver {
  const step = function (sec: number): void {
    const dt = 1 / 30;
    let left = sec;
    while (left > 1e-9) {
      const d = Math.min(dt, left);
      lens.lensTime += d;
      left -= d;
      lens.sm.update(lens.lensTime);
    }
    lens.renderNow();
  };
  return {
    reset: function () { lens.lensTime += 100; lens.resetSession(); },
    pinchSyringe: function (id) { lens.sm.pinchSyringe(id); lens.renderNow(); },
    pinchPort: function (id) { lens.sm.pinchPort(id); lens.renderNow(); },
    pinchPush: function () { lens.sm.pinchPush(); lens.renderNow(); },
    pinchResolved: function () { lens.sm.pinchResolved(); lens.renderNow(); },
    pinchEmpty: function () { lens.sm.pinchEmpty(); },
    triggerAlarm: function () { lens.sm.debugTriggerAlarm(); lens.renderNow(); },
    wait: step,
    view: function () { return lens.sm.view(); },
    probe: makeProbe(lens),
  };
}

/** Runs DC1–DC8 on a virtual clock (fast, deterministic), restores live mode, and logs the table. */
export function runLensSelfTest(lens: LumenLens): Promise<ScenarioResult[]> {
  lens.manualClock = true;
  return runScenarios(makeDriver(lens)).then(function (results) {
    lens.manualClock = false;
    lens.lensTime = getTime();
    lens.resetSession();
    print("| # | Criterion | LEAF test name | Result |");
    print("|---|-----------|----------------|--------|");
    let passed = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.pass) passed++;
      print("| " + r.id + " | " + r.title + " | " + r.leafName + " | " + (r.pass ? "PASS" : "FAIL: " + r.error) + " |");
    }
    print("[Lumen self-test] " + passed + "/" + results.length + " pass");
    return results;
  });
}
