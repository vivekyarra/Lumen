/**
 * LumenData — the one place in Lumen that holds clinical data.
 *
 * Sample clinical data for the Lens Studio preview.
 *
 * Positions live in LumenLayout.ts (scene geometry); this file holds the clinical demo facts.
 */

export type PortId = "A" | "B" | "C" | "D";
export type LineId = 1 | 2 | 3 | 4;
export type PumpId = 1 | 2 | 3 | 4;
export type SyringeId = "S1" | "S2";
export type DrugId = "midazolam" | "dobutamine" | "heparin" | "nacl" | "furosemide" | "morphine";
export type CatheterId = "CVC" | "PIV";

export interface Drug {
  id: DrugId;
  /** One-word name used on markers and reasons, e.g. "Midazolam". */
  shortName: string;
}

export interface Port {
  id: PortId;
  catheter: CatheterId;
  /** Lumen name used in "Use <shortName> ✓" — e.g. "Distal". */
  shortName: string;
  /** Name used in the push log line — e.g. "CVC Distal". */
  logName: string;
  /** Full port label — e.g. "Port A · CVC Distal". */
  label: string;
}

export interface Line {
  id: LineId;
  pump: PumpId;
  port: PortId;
  drug: DrugId;
  /** Bag face text. */
  bagLabel: string;
  /** Rate shown on the pump screen. */
  rate: string;
}

export interface Syringe {
  id: SyringeId;
  drug: DrugId;
  /** Printed on the barrel, used in the holding chip and the log line. */
  label: string;
}

export interface AlarmSpec {
  pump: PumpId;
  line: LineId;
  text: string;
  kinkText: string;
  /** Seconds after the first confirmed push in a session. */
  delayAfterFirstPushSec: number;
  /** Seconds between alarm beeps. */
  beepIntervalSec: number;
}

export type Compatibility = "compatible" | "incompatible";

export const DRUGS: { [K in DrugId]: Drug } = {
  midazolam: { id: "midazolam", shortName: "Midazolam" },
  dobutamine: { id: "dobutamine", shortName: "Dobutamine" },
  heparin: { id: "heparin", shortName: "Heparin" },
  nacl: { id: "nacl", shortName: "NaCl 0.9%" },
  furosemide: { id: "furosemide", shortName: "Furosemide" },
  morphine: { id: "morphine", shortName: "Morphine" },
};

export const PORT_IDS: PortId[] = ["A", "B", "C", "D"];
export const LINE_IDS: LineId[] = [1, 2, 3, 4];
export const SYRINGE_IDS: SyringeId[] = ["S1", "S2"];

export const PORTS: { [K in PortId]: Port } = {
  A: { id: "A", catheter: "CVC", shortName: "Distal", logName: "CVC Distal", label: "Port A · CVC Distal" },
  B: { id: "B", catheter: "CVC", shortName: "Medial", logName: "CVC Medial", label: "Port B · CVC Medial" },
  C: { id: "C", catheter: "CVC", shortName: "Proximal", logName: "CVC Proximal", label: "Port C · CVC Proximal" },
  D: { id: "D", catheter: "PIV", shortName: "PIV", logName: "PIV L forearm", label: "Port D · PIV L forearm" },
};

export const LINES: { [K in LineId]: Line } = {
  1: { id: 1, pump: 1, port: "B", drug: "midazolam", bagLabel: "Midazolam 100 mg / 100 mL", rate: "3 mL/h" },
  2: { id: 2, pump: 2, port: "C", drug: "dobutamine", bagLabel: "Dobutamine 250 mg / 250 mL", rate: "5 mcg/kg/min" },
  3: { id: 3, pump: 3, port: "A", drug: "heparin", bagLabel: "Heparin 25,000 units / 250 mL", rate: "12 mL/h" },
  4: { id: 4, pump: 4, port: "D", drug: "nacl", bagLabel: "Sodium chloride 0.9% 1000 mL", rate: "75 mL/h" },
};

export const SYRINGES: { [K in SyringeId]: Syringe } = {
  S1: { id: "S1", drug: "furosemide", label: "Furosemide 40 mg" },
  S2: { id: "S2", drug: "morphine", label: "Morphine 2 mg" },
};

/**
 * Demo Y-site compatibility table: syringe drug → line drug → result.
 * A pair that is missing from this table is treated as NOT safe by CompatibilityEngine (fail-safe).
 */
export const COMPATIBILITY: { [syringeDrug: string]: { [lineDrug: string]: Compatibility } } = {
  furosemide: {
    midazolam: "incompatible",
    dobutamine: "incompatible",
    heparin: "compatible",
    nacl: "compatible",
  },
  morphine: {
    midazolam: "compatible",
    dobutamine: "compatible",
    heparin: "compatible",
    nacl: "compatible",
  },
};

export const ALARM: AlarmSpec = {
  pump: 2,
  line: 2,
  text: "Downstream occlusion",
  kinkText: "Check here: kinked line",
  delayAfterFirstPushSec: 4,
  beepIntervalSec: 1.2,
};

/** Timing from the design brief (seconds). */
export const TIMING = {
  markerFadeIn: 0.3,
  traceAutoEnd: 8,
  firstHint: 6,
  confirmToIdle: 1.5,
  logLineStays: 10,
  alarmAfterFirstPush: ALARM.delayAfterFirstPushSec,
  alarmBeepInterval: ALARM.beepIntervalSec,
  /** Visual flow-dot loop along a traced line. */
  flowDotLoop: 1.5,
  /** Shift-handoff line check: seconds each line stays lit. */
  handoffStep: 2.5,
};

export function lineForPort(port: PortId): Line {
  for (let i = 0; i < LINE_IDS.length; i++) {
    const line = LINES[LINE_IDS[i]];
    if (line.port === port) {
      return line;
    }
  }
  throw new Error("No line feeds port " + port);
}

export function lineForPump(pump: PumpId): Line {
  for (let i = 0; i < LINE_IDS.length; i++) {
    const line = LINES[LINE_IDS[i]];
    if (line.pump === pump) {
      return line;
    }
  }
  throw new Error("No line on pump " + pump);
}
