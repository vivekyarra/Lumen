import { test } from "node:test";
import assert from "node:assert/strict";
import { LumenEvent, LumenStateMachine, invariantViolations } from "../../Assets/Lumen/Core/LumenState";
import { Driver, SCENARIOS, runScenarios } from "../../Assets/Lumen/Core/Scenarios";
import { PORT_POS } from "../../Assets/Lumen/Core/LumenLayout";
import { PORT_IDS, PortId, SYRINGE_IDS, TIMING } from "../../Assets/Lumen/Core/LumenData";

const fixedClock = { wallClock: () => ({ h: 10, m: 42 }) };

function makeDriver(): Driver & { sm: () => LumenStateMachine } {
  let sm = new LumenStateMachine(PORT_POS, fixedClock);
  return {
    sm: () => sm,
    reset: () => { sm = new LumenStateMachine(PORT_POS, fixedClock); },
    pinchSyringe: (id) => sm.pinchSyringe(id),
    pinchPort: (id) => sm.pinchPort(id),
    pinchPush: () => sm.pinchPush(),
    pinchResolved: () => sm.pinchResolved(),
    pinchEmpty: () => sm.pinchEmpty(),
    pinchPole: () => sm.pinchPole(),
    triggerAlarm: () => sm.debugTriggerAlarm(),
    wait: (s) => sm.advance(s),
    view: () => sm.view(),
    probe: null,
  };
}

for (const s of SCENARIOS) {
  test(`${s.id} ${s.title} (${s.leafName}) — state runner`, async () => {
    const [r] = await runScenarios(makeDriver(), [s.id]);
    assert.equal(r.error, null);
    assert.ok(r.pass);
  });
}

function record(sm: LumenStateMachine): LumenEvent[] {
  const ev: LumenEvent[] = [];
  sm.onEvent((e) => ev.push(e));
  return ev;
}

test("pick-up sound comes before the markers sound", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchSyringe("S1");
  assert.deepEqual(ev.map((e) => e.type), ["hintHidden", "syringePicked", "markersShown"]);
});

test("markers fade in over 0.3 s", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  sm.pinchSyringe("S1");
  assert.equal(sm.view().ports.A.opacity, 0);
  sm.advance(0.15);
  assert.ok(Math.abs(sm.view().ports.A.opacity - 0.5) < 1e-9);
  sm.advance(0.2);
  assert.equal(sm.view().ports.A.opacity, 1);
});

test("confirm fades markers out over 1.5 s, then IDLE; port pinches during the fade are ignored", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchSyringe("S1"); sm.advance(1); sm.pinchPort("A"); sm.pinchPush();
  assert.equal(sm.getMode(), "CONFIRMED");
  sm.advance(0.75);
  assert.ok(Math.abs(sm.view().ports.A.opacity - 0.5) < 1e-9);
  sm.pinchPort("B");
  assert.equal(ev[ev.length - 1].type, "ignored");
  sm.advance(0.76);
  assert.equal(sm.getMode(), "IDLE");
  assert.equal(sm.view().logText, "Furosemide 40 mg → CVC Distal · 10:42");
});

test("picking up a syringe during the confirm fade cancels the fade", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  sm.pinchSyringe("S1"); sm.pinchPort("A"); sm.pinchPush();
  sm.advance(0.5);
  sm.pinchSyringe("S2");
  sm.advance(2);
  assert.equal(sm.getMode(), "HOLDING");
  assert.equal(sm.view().chipText, "Holding: Morphine 2 mg");
});

test("pinching the focused port again unfocuses it; chip pinch puts the syringe down", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  sm.pinchSyringe("S1"); sm.pinchPort("B");
  sm.pinchPort("B");
  assert.equal(sm.getMode(), "HOLDING");
  assert.equal(sm.view().glowLine, null);
  sm.pinchChip();
  assert.equal(sm.getMode(), "IDLE");
  const ev = record(sm);
  sm.pinchChip();
  assert.equal(ev[0].type, "ignored");
});

test("picking up a syringe while tracing ends the trace", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchPort("D");
  sm.pinchSyringe("S1");
  assert.equal(sm.getMode(), "HOLDING");
  assert.equal(sm.view().glowLine, null);
  assert.ok(ev.some((e) => e.type === "traceEnded" && e.reason === "pickup"));
  sm.advance(9);
  assert.equal(sm.getMode(), "HOLDING", "stale trace timer must not fire");
});

test("alarm beeps every 1.2 s until resolved, and starts 4 s after the first push", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchSyringe("S1"); sm.pinchPort("A"); sm.pinchPush();
  sm.advance(3.99);
  assert.equal(sm.isAlarmActive(), false);
  sm.advance(0.02);
  assert.equal(sm.isAlarmActive(), true);
  sm.advance(1.2 * 5);
  const beeps = ev.filter((e) => e.type === "alarmBeep").length;
  assert.equal(beeps, 6);
  sm.pinchResolved();
  sm.advance(10);
  assert.equal(ev.filter((e) => e.type === "alarmBeep").length, 6);
  assert.equal(ev.filter((e) => e.type === "alarmStarted").length, 1);
});

test("large time jumps fire timers in order (frame hitch safety)", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchSyringe("S1"); sm.pinchPort("A"); sm.pinchPush();
  sm.advance(30);
  const types = ev.map((e) => e.type);
  assert.ok(types.indexOf("returnedToIdle") < types.indexOf("alarmStarted"));
  assert.ok(types.indexOf("alarmStarted") < types.indexOf("logExpired"));
  assert.equal(sm.getMode(), "IDLE");
  assert.equal(sm.view().logText, null);
});

test("time never runs backwards", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  sm.update(5);
  sm.update(2);
  assert.equal(sm.getTime(), 5);
});

// ---------------- stress: random fuzz with invariants ----------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test("fuzz: 200 sessions × 400 random inputs never break an invariant", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed);
    const sm = new LumenStateMachine(PORT_POS, fixedClock);
    const trail: string[] = [];
    for (let i = 0; i < 400; i++) {
      const k = r();
      let action: string;
      if (k < 0.2) { const s = SYRINGE_IDS[Math.floor(r() * 2)]; sm.pinchSyringe(s); action = "syringe " + s; }
      else if (k < 0.5) { const p = PORT_IDS[Math.floor(r() * 4)] as PortId; sm.pinchPort(p); action = "port " + p; }
      else if (k < 0.62) { sm.pinchPush(); action = "push"; }
      else if (k < 0.67) { sm.pinchResolved(); action = "resolved"; }
      else if (k < 0.7) { sm.pinchChip(); action = "chip"; }
      else if (k < 0.72) { sm.debugTriggerAlarm(); action = "alarm"; }
      else if (k < 0.74) { sm.pinchEmpty(); action = "empty"; }
      else if (k < 0.78) { sm.pinchPole(); action = "pole"; }
      else { const dt = r() < 0.8 ? r() * 0.5 : r() * 12; sm.advance(dt); action = "wait " + dt.toFixed(2); }
      trail.push(action);
      const bad = invariantViolations(sm.view());
      if (bad.length) assert.fail(`seed ${seed} step ${i}: ${bad.join("; ")}\n…${trail.slice(-8).join(" → ")}`);
    }
  }
});

test("fuzz: every push that happens was on a green port for the held drug", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = rng(seed * 7);
    const sm = new LumenStateMachine(PORT_POS, fixedClock);
    let held: string | null = null;
    sm.onEvent((e) => {
      if (e.type === "pushConfirmed") {
        assert.equal(e.syringe, held);
        const bad = e.syringe === "S1" && (e.port === "B" || e.port === "C");
        assert.ok(!bad, `pushed furosemide into ${e.port}`);
      }
    });
    for (let i = 0; i < 300; i++) {
      held = sm.getHeld();
      const k = r();
      if (k < 0.25) sm.pinchSyringe(SYRINGE_IDS[Math.floor(r() * 2)]);
      else if (k < 0.6) sm.pinchPort(PORT_IDS[Math.floor(r() * 4)]);
      else if (k < 0.85) sm.pinchPush();
      else sm.advance(r() * 3);
    }
  }
});

test("timing table is the spec's", () => {
  assert.deepEqual(
    [TIMING.markerFadeIn, TIMING.traceAutoEnd, TIMING.firstHint, TIMING.confirmToIdle, TIMING.logLineStays, TIMING.alarmAfterFirstPush, TIMING.alarmBeepInterval],
    [0.3, 8, 6, 1.5, 10, 4, 1.2],
  );
});

test("handoff: one line at a time, 2.5 s each, ordered events, then a log line", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  const ev = record(sm);
  sm.pinchPole();
  for (let i = 0; i < 4; i++) {
    assert.equal(sm.view().handoff!.step, i + 1);
    sm.advance(2.49);
    assert.equal(sm.view().handoff!.step, i + 1, "still on step " + (i + 1));
    sm.advance(0.01);
  }
  assert.equal(sm.getMode(), "IDLE");
  assert.equal(sm.view().logText, "Lines checked · 4 of 4 · 10:42");
  assert.deepEqual(ev.filter((e) => e.type === "handoffStep").map((e) => (e as { line: number }).line), [1, 2, 3, 4]);
  assert.equal(ev[ev.length - 1].type, "handoffEnded");
});

test("handoff: pinching a port mid-check switches to a normal trace; alarm layer is unaffected", () => {
  const sm = new LumenStateMachine(PORT_POS, fixedClock);
  sm.debugTriggerAlarm();
  sm.pinchPole();
  sm.advance(3);
  sm.pinchPort("D");
  assert.equal(sm.getMode(), "TRACE");
  assert.equal(sm.view().glowLine, 4);
  assert.ok(sm.view().alarm);
  sm.advance(20);
  assert.equal(sm.getMode(), "IDLE", "stale handoff timer must not revive the check");
  assert.equal(sm.view().logText, null, "an interrupted check is not logged as complete");
});

test("fuzz: handoff never coexists with a held syringe and always walks lines in order", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = rng(seed * 13);
    const sm = new LumenStateMachine(PORT_POS, fixedClock);
    let lastStep = 0;
    sm.onEvent((e) => {
      if (e.type === "handoffStarted") lastStep = 0;
      if (e.type === "handoffStep") { assert.equal(e.index, lastStep); lastStep++; }
    });
    for (let i = 0; i < 300; i++) {
      const k = r();
      if (k < 0.3) sm.pinchPole();
      else if (k < 0.45) sm.pinchSyringe(SYRINGE_IDS[Math.floor(r() * 2)]);
      else if (k < 0.6) sm.pinchPort(PORT_IDS[Math.floor(r() * 4)]);
      else if (k < 0.65) sm.pinchPush();
      else sm.advance(r() * 4);
      assert.deepEqual(invariantViolations(sm.view()), []);
    }
  }
});
