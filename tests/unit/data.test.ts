import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPATIBILITY, DEMO_DATA_LABEL, LINES, LINE_IDS, PORTS, PORT_IDS, SYRINGES, lineForPort, lineForPump,
} from "../../Assets/Lumen/Core/LumenData";
import * as S from "../../Assets/Lumen/Core/Strings";
import { check, checkAll, nearestCompatible } from "../../Assets/Lumen/Core/CompatibilityEngine";
import { v3 } from "../../Assets/Lumen/Core/Vec";

// Exact strings from LUMEN_SPEC.md §8.8.
const SPEC_STRINGS = [
  "Pick up a syringe to check ports.",
  "Holding: Furosemide 40 mg",
  "Holding: Morphine 2 mg",
  "Demo data — not for clinical use",
  "✕ Midazolam — do not push here",
  "✕ Dobutamine — do not push here",
  "✓ Compatible",
  "Use: Distal (Heparin) — compatible",
  "Push here",
  "Downstream occlusion",
  "Check here: kinked line",
  "Resolved",
  "Port A · CVC Distal",
  "Port B · CVC Medial",
  "Port C · CVC Proximal",
  "Port D · PIV L forearm",
  "Midazolam · 3 mL/h · Pump 1",
  "Dobutamine · 5 mcg/kg/min · Pump 2",
  "Heparin · 12 mL/h · Pump 3",
  "NaCl 0.9% · 75 mL/h · Pump 4",
];

test("line table matches spec §8.3", () => {
  assert.deepEqual(LINE_IDS.map((l) => [LINES[l].pump, LINES[l].port, LINES[l].drug]), [
    [1, "B", "midazolam"], [2, "C", "dobutamine"], [3, "A", "heparin"], [4, "D", "nacl"],
  ]);
  for (const p of PORT_IDS) assert.equal(lineForPort(p).port, p);
  for (const l of LINE_IDS) assert.equal(lineForPump(LINES[l].pump).id, l);
  assert.throws(() => lineForPort("Z" as never));
});

test("every exact spec string is produced by Strings.ts", () => {
  const produced = new Set<string>([
    S.HINT_TEXT, S.holdingText("S1"), S.holdingText("S2"), DEMO_DATA_LABEL,
    S.redFocusText("B"), S.redFocusText("C"), S.COMPATIBLE_TEXT, S.useText("A"), S.PUSH_TEXT,
    "Downstream occlusion", "Check here: kinked line", S.RESOLVED_TEXT,
    ...PORT_IDS.map(S.portLabel), ...LINE_IDS.map(S.pumpLabel),
  ]);
  for (const s of SPEC_STRINGS) assert.ok(produced.has(s), "missing: " + s);
});

test("log line format", () => {
  assert.equal(S.logText("S1", "A", S.formatClock(10, 42)), "Furosemide 40 mg → CVC Distal · 10:42");
  assert.equal(S.logText("S2", "D", S.formatClock(9, 5)), "Morphine 2 mg → PIV L forearm · 09:05");
});

test("labels respect the 6-word limit (the spec's own 7-word hint is the one exemption)", () => {
  assert.equal(S.wordCount(S.HINT_TEXT), 7);
  const all = [DEMO_DATA_LABEL, S.COMPATIBLE_TEXT, S.NOT_IN_TABLE_TEXT, S.PUSH_TEXT, S.RESOLVED_TEXT,
    ...PORT_IDS.map(S.redFocusText), ...PORT_IDS.map(S.useText), ...PORT_IDS.map(S.portLabel),
    ...LINE_IDS.map(S.pumpLabel), "Downstream occlusion", "Check here: kinked line",
    S.holdingText("S1"), S.holdingText("S2"), S.logText("S1", "A", "10:42")];
  for (const t of all) assert.ok(S.wordCount(t) <= 6, `${t} has ${S.wordCount(t)} words`);
});

test("compatibility table matches spec", () => {
  const f = checkAll("S1");
  assert.deepEqual(PORT_IDS.map((p) => f[p].verdict), ["compatible", "incompatible", "incompatible", "compatible"]);
  assert.equal(f.B.conflictingDrug, "Midazolam");
  assert.equal(f.C.conflictingDrug, "Dobutamine");
  assert.equal(f.A.conflictingDrug, null);
  const m = checkAll("S2");
  assert.ok(PORT_IDS.every((p) => m[p].safe));
});

test("missing table entry is fail-safe (never green)", () => {
  const saved = COMPATIBILITY.furosemide.heparin;
  delete (COMPATIBILITY.furosemide as Record<string, string>).heparin;
  try {
    const r = check("S1", "A");
    assert.equal(r.verdict, "unknown");
    assert.equal(r.safe, false);
    assert.equal(r.conflictingDrug, "Heparin");
  } finally {
    COMPATIBILITY.furosemide.heparin = saved;
  }
});

test("nearest compatible port rule", () => {
  const pos = { A: v3(-31, 56, 82), B: v3(-27, 56, 82), C: v3(-23, 56, 82), D: v3(15, 95, 78) };
  assert.equal(nearestCompatible("B", "S1", pos), "A");
  assert.equal(nearestCompatible("C", "S1", pos), "A");
  // Tie: equal distance to a same-catheter and a different-catheter port → same catheter wins.
  const tie = { A: v3(-10, 0, 0), B: v3(0, 0, 0), C: v3(50, 0, 0), D: v3(10, 0, 0) };
  assert.equal(nearestCompatible("B", "S1", tie), "A");
  // Excludes itself and incompatible ports.
  assert.notEqual(nearestCompatible("A", "S1", pos), "A");
  assert.equal(nearestCompatible("A", "S1", pos), "D");
});

test("nearest compatible returns null when nothing is safe", () => {
  const saved = { ...COMPATIBILITY.furosemide };
  COMPATIBILITY.furosemide.heparin = "incompatible";
  COMPATIBILITY.furosemide.nacl = "incompatible";
  try {
    const pos = { A: v3(0, 0, 0), B: v3(4, 0, 0), C: v3(8, 0, 0), D: v3(50, 0, 0) };
    assert.equal(nearestCompatible("B", "S1", pos), null);
  } finally {
    Object.assign(COMPATIBILITY.furosemide, saved);
  }
});

test("syringes and ports exist as spec says", () => {
  assert.equal(SYRINGES.S1.label, "Furosemide 40 mg");
  assert.equal(SYRINGES.S2.label, "Morphine 2 mg");
  assert.equal(PORTS.D.catheter, "PIV");
});
