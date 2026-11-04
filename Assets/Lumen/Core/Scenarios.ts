/**
 * Done-criteria scenarios DC1–DC8, written once and run by three runners:
 *   - Node unit tests against the pure state machine (tests/unit),
 *   - Playwright against the web preview twin (tests/e2e),
 *   - LumenSelfTest inside the Lens Studio preview (Assets/Lumen/Lens/LumenSelfTest.ts).
 *
 * A runner supplies a Driver. When the driver also has a SceneProbe, the scenario checks the
 * rendered scene (visibility, texts, screen-space overlaps), not only the state.
 */
import { COMPATIBILITY, LINE_IDS, LineId, PORT_IDS, PortId, SyringeId, LINES, TIMING } from "./LumenData";
import { LumenView } from "./LumenState";
import * as S from "./Strings";

/** Keys of scene objects a probe can report on. */
export type ProbeKey =
  | "port.idleDot"
  | "port.ring"
  | "line.glow"
  | "line.amber"
  | "pump.alarm"
  | "kink.ring"
  | "button.push"
  | "button.resolved"
  | "redirect.arrow"
  | "edgeArrow"
  | "chip"
  | "log";

export interface SceneProbe {
  /** Is the object visible (enabled and not fully transparent)? `index` selects the port / line. */
  visible(key: ProbeKey, index?: string): boolean;
  /** Text shown on a label, or null when hidden. Keys: "port.A", "pump.1", "chip", "log", "notice", "redirect", "kink", "pumpAlarm". */
  text(key: string): string | null;
  /** Aim the camera at the CVC hub from the start position. */
  lookAtHub(): Promise<void> | void;
  lookAtCart(): Promise<void> | void;
  /** Ids of overlapping visible label pairs in screen space at the current pose. */
  overlappingLabels(): string[];
  /** Smallest distance from the camera to any visible UI element (cm). */
  minUiDistanceCm(): number;
  /** Number of visible materials whose colour is dark (would be invisible on an additive display). */
  darkContentCount(): number;
  /** Is the alarm sound currently playing? */
  alarmSoundPlaying(): boolean;
}

export interface Driver {
  pinchSyringe(id: SyringeId): Promise<void> | void;
  pinchPort(id: PortId): Promise<void> | void;
  pinchPush(): Promise<void> | void;
  pinchResolved(): Promise<void> | void;
  pinchEmpty(): Promise<void> | void;
  /** Pinch the IV pole above the pumps (shift-handoff line check). */
  pinchPole(): Promise<void> | void;
  triggerAlarm(): Promise<void> | void;
  /** Let `sec` seconds of Lens time pass. */
  wait(sec: number): Promise<void> | void;
  view(): LumenView;
  /** Reset to a fresh session (start state). */
  reset(): Promise<void> | void;
  probe: SceneProbe | null;
}

export class ScenarioFailure extends Error {}

function ok(cond: unknown, msg: string): void {
  if (!cond) throw new ScenarioFailure(msg);
}

function eq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new ScenarioFailure(msg + " — expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

function markers(v: LumenView): string {
  return PORT_IDS.map(function (p) {
    return v.ports[p].marker;
  }).join(",");
}

function quietIdle(d: Driver, where: string): void {
  const v = d.view();
  eq(v.mode, "IDLE", where + ": mode");
  eq(markers(v), "idle,idle,idle,idle", where + ": markers");
  eq(v.glowLine, null, where + ": glow");
  eq(v.pushButtonPort, null, where + ": push button");
  eq(v.redirect, null, where + ": redirect");
  const pr = d.probe;
  if (pr) {
    for (let i = 0; i < PORT_IDS.length; i++) {
      const p = PORT_IDS[i];
      ok(pr.visible("port.idleDot", p), where + ": idle dot visible on " + p);
      ok(!pr.visible("port.ring", p), where + ": no marker ring on " + p);
    }
    for (let i = 0; i < LINE_IDS.length; i++) {
      ok(!pr.visible("line.glow", String(LINE_IDS[i])), where + ": no glow on line " + LINE_IDS[i]);
    }
    ok(!pr.visible("button.push"), where + ": Push hidden");
    ok(!pr.visible("redirect.arrow"), where + ": arrow hidden");
  }
}

async function freshQuiet(d: Driver): Promise<void> {
  await d.reset();
  await d.wait(TIMING.firstHint + 0.5);
}

export interface Scenario {
  id: string;
  title: string;
  leafName: string;
  run(d: Driver): Promise<void>;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "DC1",
    title: "Quiet idle",
    leafName: "test_idle_is_quiet",
    run: async function (d) {
      await d.reset();
      quietIdle(d, "after load");
      eq(d.view().hintText, S.HINT_TEXT, "first-time hint on load");
      ok(!d.view().alarm, "no alarm at load");
      if (d.probe) ok(!d.probe.visible("button.resolved"), "Resolved hidden");
      await d.wait(TIMING.firstHint + 0.2);
      eq(d.view().hintText, null, "hint gone after 6 s");
      await d.pinchEmpty();
      quietIdle(d, "after pinching empty space");
    },
  },
  {
    id: "DC2",
    title: "Pick up shows markers",
    leafName: "test_pickup_shows_markers",
    run: async function (d) {
      await freshQuiet(d);
      await d.pinchSyringe("S1");
      const v = d.view();
      eq(v.chipText, "Holding: Furosemide 40 mg", "chip text");
      eq(markers(v), "compatible,incompatible,incompatible,compatible", "A,D green; B,C red");
      eq(v.ports.B.label, "✕ Midazolam", "B reason");
      eq(v.ports.C.label, "✕ Dobutamine", "C reason");
      eq(v.ports.A.label, null, "green ports need no words");
      eq(v.mode, "HOLDING", "mode");
      await d.wait(TIMING.markerFadeIn + 0.05);
      eq(d.view().ports.B.opacity, 1, "markers fully in after 0.3 s");
      if (d.probe) {
        for (let i = 0; i < PORT_IDS.length; i++) ok(d.probe.visible("port.ring", PORT_IDS[i]), "ring on " + PORT_IDS[i]);
        eq(d.probe.text("chip"), "Holding: Furosemide 40 mg", "rendered chip");
        eq(d.probe.text("port.B"), "✕ Midazolam", "rendered B reason");
        eq(d.probe.text("port.C"), "✕ Dobutamine", "rendered C reason");
      }
    },
  },
  {
    id: "DC3",
    title: "Data, not art",
    leafName: "test_morphine_all_green_and_put_down",
    run: async function (d) {
      await freshQuiet(d);
      await d.pinchSyringe("S1");
      await d.pinchSyringe("S2");
      const v = d.view();
      eq(v.chipText, "Holding: Morphine 2 mg", "swapped chip");
      eq(markers(v), "compatible,compatible,compatible,compatible", "all green with morphine");
      for (let i = 0; i < PORT_IDS.length; i++) eq(v.ports[PORT_IDS[i]].label, null, "no red words");
      await d.pinchSyringe("S2");
      await d.wait(0.1);
      quietIdle(d, "after putting morphine down");
      eq(d.view().chipText, null, "chip gone");
    },
  },
  {
    id: "DC4",
    title: "Trace",
    leafName: "test_trace_each_port",
    run: async function (d) {
      await freshQuiet(d);
      const pumpLabels: { [K in LineId]: string } = {
        1: "Midazolam · 3 mL/h · Pump 1",
        2: "Dobutamine · 5 mcg/kg/min · Pump 2",
        3: "Heparin · 12 mL/h · Pump 3",
        4: "NaCl 0.9% · 75 mL/h · Pump 4",
      };
      const portNames: { [K in PortId]: string } = {
        A: "Port A · CVC Distal",
        B: "Port B · CVC Medial",
        C: "Port C · CVC Proximal",
        D: "Port D · PIV L forearm",
      };
      for (let pass = 0; pass < 2; pass++) {
        const withSyringe = pass === 1;
        if (withSyringe) await d.pinchSyringe("S2");
        for (let i = 0; i < PORT_IDS.length; i++) {
          const p = PORT_IDS[i];
          await d.pinchPort(p);
          const v = d.view();
          const line = LINE_IDS.filter(function (l) {
            return LINES[l].port === p;
          })[0];
          eq(v.glowLine, line, (withSyringe ? "holding" : "no syringe") + ": port " + p + " glows its own line");
          eq(v.pumpLabel, pumpLabels[line], "pump label for line " + line);
          if (!withSyringe) eq(v.ports[p].label, portNames[p], "port name label");
          if (d.probe) {
            for (let j = 0; j < LINE_IDS.length; j++) {
              eq(d.probe.visible("line.glow", String(LINE_IDS[j])), LINE_IDS[j] === line, "only line " + line + " glows");
            }
            eq(d.probe.text("pump." + LINES[line].pump), pumpLabels[line], "rendered pump label");
          }
        }
        if (!withSyringe) {
          // Toggle off and the 8 s auto-end.
          await d.pinchPort("D");
          eq(d.view().glowLine, null, "pinching the traced port again ends the trace");
          await d.pinchPort("D");
          await d.wait(TIMING.traceAutoEnd - 0.5);
          eq(d.view().glowLine, 4, "trace still on before 8 s");
          await d.wait(1);
          quietIdle(d, "trace auto-ends after 8 s");
        } else {
          await d.pinchSyringe("S2");
        }
      }
    },
  },
  {
    id: "DC5",
    title: "Redirect",
    leafName: "test_red_port_redirects",
    run: async function (d) {
      await freshQuiet(d);
      await d.pinchSyringe("S1");
      await d.pinchPort("B");
      let v = d.view();
      eq(v.ports.B.label, "✕ Midazolam — do not push here", "B reason");
      eq(v.pushButtonPort, null, "no Push on red");
      ok(v.redirect !== null, "redirect shown");
      eq(v.redirect ? v.redirect.to : null, "A", "arrow target");
      eq(v.redirect ? v.redirect.label : null, "Use: Distal (Heparin) — compatible", "arrow label");
      eq(v.glowLine, 1, "B's line (Midazolam) glows");
      if (d.probe) {
        ok(!d.probe.visible("button.push"), "Push hidden");
        ok(d.probe.visible("redirect.arrow"), "arrow visible");
        eq(d.probe.text("redirect"), "Use: Distal (Heparin) — compatible", "rendered redirect label");
        eq(d.probe.text("port.B"), "✕ Midazolam — do not push here", "rendered B reason");
      }
      await d.pinchPort("C");
      v = d.view();
      eq(v.ports.C.label, "✕ Dobutamine — do not push here", "C reason");
      eq(v.ports.B.label, "✕ Midazolam", "B back to short reason");
      eq(v.redirect ? v.redirect.to : null, "A", "C redirects to A");
      eq(PORT_IDS.filter(function (p) { return v.ports[p].focused; }).join(), "C", "only one port focused");
      await d.pinchPush();
      eq(d.view().mode, "PORT_FOCUS", "push is impossible on a red port");
    },
  },
  {
    id: "DC6",
    title: "Push and quiet",
    leafName: "test_push_logs_and_goes_quiet",
    run: async function (d) {
      await freshQuiet(d);
      await d.pinchSyringe("S1");
      await d.pinchPort("A");
      let v = d.view();
      eq(v.pushButtonPort, "A", "Push on green A");
      eq(v.pushText, "Push here", "Push text");
      eq(v.ports.A.label, "✓ Compatible", "A says compatible");
      eq(v.redirect, null, "no redirect on green");
      if (d.probe) ok(d.probe.visible("button.push"), "Push visible");
      await d.pinchPush();
      v = d.view();
      ok(v.logText !== null && /^Furosemide 40 mg → CVC Distal · \d\d:\d\d$/.test(v.logText), "log text: " + v.logText);
      ok(v.ports.A.pulse, "green pulse on A");
      eq(v.held, null, "syringe back on the cart");
      if (d.probe) {
        ok(!d.probe.visible("button.push"), "Push hidden after confirm");
        ok(d.probe.text("log") !== null, "rendered log");
      }
      await d.wait(TIMING.confirmToIdle + 0.1);
      quietIdle(d, "≤ 2 s after push");
      ok(d.view().logText !== null, "log line stays");
      await d.wait(TIMING.logLineStays - TIMING.confirmToIdle);
      eq(d.view().logText, null, "log line fades after 10 s");
    },
  },
  {
    id: "DC7",
    title: "Alarm",
    leafName: "test_alarm_and_resolve",
    run: async function (d) {
      // Timed path: 4 s after the first confirmed push.
      await freshQuiet(d);
      await d.pinchSyringe("S1");
      await d.pinchPort("A");
      await d.pinchPush();
      await d.wait(TIMING.alarmAfterFirstPush - 0.3);
      ok(!d.view().alarm, "no alarm before 4 s");
      if (d.probe) await d.probe.lookAtHub();
      await d.wait(0.5);
      const a = d.view().alarm;
      ok(a !== null, "alarm 4 s after the first push");
      eq(a ? a.text : null, "Downstream occlusion", "alarm text");
      eq(a ? a.kinkText : null, "Check here: kinked line", "kink text");
      eq(a ? a.pump : null, 2, "pump 2");
      if (d.probe) {
        ok(d.probe.visible("pump.alarm"), "pump 2 amber");
        ok(d.probe.visible("line.amber", "2"), "line 2 amber");
        ok(d.probe.visible("kink.ring"), "kink ring");
        ok(d.probe.visible("button.resolved"), "Resolved button");
        ok(d.probe.visible("edgeArrow"), "edge arrow while looking at the hub");
        ok(d.probe.alarmSoundPlaying(), "alarm sound playing");
        eq(d.probe.text("pumpAlarm"), "Downstream occlusion", "rendered alarm text");
        eq(d.probe.text("kink"), "Check here: kinked line", "rendered kink text");
      }
      await d.pinchResolved();
      ok(!d.view().alarm, "Resolved clears the alarm");
      if (d.probe) {
        ok(!d.probe.visible("pump.alarm"), "amber pump hidden");
        ok(!d.probe.visible("line.amber", "2"), "amber line hidden");
        ok(!d.probe.visible("kink.ring"), "kink ring hidden");
        ok(!d.probe.visible("edgeArrow"), "edge arrow hidden");
        ok(!d.probe.alarmSoundPlaying(), "sound stopped");
      }
      // Only once per session.
      await d.pinchSyringe("S2");
      await d.pinchPort("D");
      await d.pinchPush();
      await d.wait(TIMING.alarmAfterFirstPush + 1);
      ok(!d.view().alarm, "timed alarm fires only once per session");
      // Debug hook.
      await d.triggerAlarm();
      ok(d.view().alarm !== null, "debug trigger starts the alarm");
      await d.pinchSyringe("S1");
      ok(d.view().alarm !== null && d.view().mode === "HOLDING", "alarm is a separate layer");
      await d.pinchResolved();
      ok(!d.view().alarm, "resolved again");
    },
  },
  {
    id: "DC8",
    title: "Placement and comfort",
    leafName: "test_placement_and_comfort",
    run: async function (d) {
      await d.reset();
      const pr = d.probe;
      if (!pr) {
        // Geometry is covered by tests/unit/layout.test.ts in the pure runner.
        return;
      }
      const states: [string, () => Promise<void>][] = [
        ["idle", async function () { /* start */ }],
        ["holding", async function () { await d.pinchSyringe("S1"); }],
        ["focus B", async function () { await d.pinchPort("B"); }],
        ["focus C", async function () { await d.pinchPort("C"); }],
        ["focus A", async function () { await d.pinchPort("A"); }],
      ];
      for (let i = 0; i < states.length; i++) {
        await states[i][1]();
        await d.wait(0.35);
        await pr.lookAtHub();
        eq(pr.overlappingLabels().join(", "), "", "no overlapping labels at the hub (" + states[i][0] + ")");
        await pr.lookAtCart();
        eq(pr.overlappingLabels().join(", "), "", "no overlapping labels at the cart (" + states[i][0] + ")");
        ok(pr.minUiDistanceCm() >= 40, "UI ≥ 40 cm (" + states[i][0] + "): " + pr.minUiDistanceCm().toFixed(1));
        eq(pr.darkContentCount(), 0, "no dark content (" + states[i][0] + ")");
      }
    },
  },
];

/** Extensions beyond the spec's DC1–DC8, written and tested the same way. */
SCENARIOS.push(
  {
    id: "DC9",
    title: "Shift-handoff line check",
    leafName: "test_handoff_line_check",
    run: async function (d) {
      await freshQuiet(d);
      await d.pinchPole();
      for (let i = 0; i < LINE_IDS.length; i++) {
        const v = d.view();
        const l = LINE_IDS[i];
        eq(v.mode, "HANDOFF", "step " + (i + 1) + ": mode");
        eq(v.glowLine, l, "step " + (i + 1) + " lights line " + l);
        eq(v.ports[LINES[l].port].label, S.portLabel(LINES[l].port), "port name on step " + (i + 1));
        eq(v.pumpLabel, S.pumpLabel(l), "pump label on step " + (i + 1));
        if (d.probe) {
          for (let j = 0; j < LINE_IDS.length; j++) {
            eq(d.probe.visible("line.glow", String(LINE_IDS[j])), LINE_IDS[j] === l, "only line " + l + " glows");
          }
        }
        await d.wait(TIMING.handoffStep);
      }
      quietIdle(d, "after the handoff check");
      const log = d.view().logText;
      ok(log !== null && /^Lines checked · 4 of 4 · \d\d:\d\d$/.test(log), "handoff log: " + log);
      // Pinch the pole again to stop early; a syringe pick-up also stops it.
      await d.pinchPole();
      await d.wait(TIMING.handoffStep + 0.1);
      eq(d.view().glowLine, 2, "second line after one step");
      await d.pinchPole();
      quietIdle(d, "pole pinched again stops the check");
      await d.pinchPole();
      await d.pinchSyringe("S1");
      eq(d.view().mode, "HOLDING", "pick-up interrupts the check");
      await d.pinchPole();
      eq(d.view().mode, "HOLDING", "no handoff while holding a syringe");
    },
  },
  {
    id: "DC10",
    title: "Fail-safe: no safe port",
    leafName: "test_no_safe_port_fail_safe",
    run: async function (d) {
      const row = COMPATIBILITY.furosemide;
      const saved = { heparin: row.heparin, nacl: row.nacl };
      row.heparin = "incompatible";
      delete (row as { [k: string]: string }).nacl; // missing entry must never be green either
      try {
        await freshQuiet(d);
        await d.pinchSyringe("S1");
        const v0 = d.view();
        eq(markers(v0), "incompatible,incompatible,incompatible,unknown", "nothing is green");
        eq(v0.ports.D.label, "✕ Not in table — check chart", "missing entry explains itself");
        await d.pinchPort("B");
        const v = d.view();
        eq(v.redirect, null, "no arrow to nowhere");
        eq(v.pushButtonPort, null, "no Push");
        eq(v.noticeText, "No safe port — ask pharmacy", "notice on the cart");
        if (d.probe) eq(d.probe.text("notice"), "No safe port — ask pharmacy", "rendered notice");
        await d.pinchPush();
        eq(d.view().mode, "PORT_FOCUS", "push impossible");
      } finally {
        row.heparin = saved.heparin;
        row.nacl = saved.nacl;
        await d.reset();
      }
    },
  },
);

export interface ScenarioResult {
  id: string;
  title: string;
  leafName: string;
  pass: boolean;
  error: string | null;
}

export async function runScenarios(d: Driver, only?: string[]): Promise<ScenarioResult[]> {
  const out: ScenarioResult[] = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    if (only && only.indexOf(s.id) < 0) continue;
    try {
      await s.run(d);
      out.push({ id: s.id, title: s.title, leafName: s.leafName, pass: true, error: null });
    } catch (e) {
      out.push({ id: s.id, title: s.title, leafName: s.leafName, pass: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
