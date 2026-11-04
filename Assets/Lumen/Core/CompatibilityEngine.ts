/**
 * CompatibilityEngine — pure logic, no visuals (LUMEN_SPEC.md §9.2).
 *
 * Safety rule: anything not explicitly "compatible" in the demo table is NOT green.
 * A missing table entry returns verdict "unknown", which the Lens renders as red ✕ with a "check chart" reason.
 */
import { COMPATIBILITY, DRUGS, PORT_IDS, PORTS, SYRINGES, lineForPort, PortId, SyringeId } from "./LumenData";
import { V3, distance } from "./Vec";

export type Verdict = "compatible" | "incompatible" | "unknown";

export interface CheckResult {
  port: PortId;
  verdict: Verdict;
  /** True only for verdict "compatible". */
  safe: boolean;
  /** Short name of the drug already flowing in the port's line, when not safe. */
  conflictingDrug: string | null;
}

export function check(syringe: SyringeId, port: PortId): CheckResult {
  const syringeDrug = SYRINGES[syringe].drug;
  const lineDrug = lineForPort(port).drug;
  const row = COMPATIBILITY[syringeDrug];
  const cell = row ? row[lineDrug] : undefined;
  const verdict: Verdict = cell === "compatible" ? "compatible" : cell === "incompatible" ? "incompatible" : "unknown";
  return {
    port: port,
    verdict: verdict,
    safe: verdict === "compatible",
    conflictingDrug: verdict === "compatible" ? null : DRUGS[lineDrug].shortName,
  };
}

export function checkAll(syringe: SyringeId): { [K in PortId]: CheckResult } {
  return {
    A: check(syringe, "A"),
    B: check(syringe, "B"),
    C: check(syringe, "C"),
    D: check(syringe, "D"),
  };
}

/** Ports closer than this (cm) are treated as a tie and resolved by "same catheter first". */
export const TIE_EPSILON_CM = 0.5;

/**
 * Nearest compatible port to `from` for `syringe` (LUMEN_SPEC.md §8.3):
 * shortest straight-line distance; ties prefer the same catheter; then alphabetical for determinism.
 * Returns null when no other port is compatible.
 */
export function nearestCompatible(
  from: PortId,
  syringe: SyringeId,
  positions: { [K in PortId]: V3 },
): PortId | null {
  let best: PortId | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < PORT_IDS.length; i++) {
    const candidate = PORT_IDS[i];
    if (candidate === from || !check(syringe, candidate).safe) {
      continue;
    }
    const d = distance(positions[from], positions[candidate]);
    if (best === null || d < bestDist - TIE_EPSILON_CM) {
      best = candidate;
      bestDist = d;
      continue;
    }
    if (Math.abs(d - bestDist) <= TIE_EPSILON_CM) {
      const sameNew = PORTS[candidate].catheter === PORTS[from].catheter;
      const sameOld = PORTS[best].catheter === PORTS[from].catheter;
      if (sameNew && !sameOld) {
        best = candidate;
        bestDist = d;
      }
    }
  }
  return best;
}
