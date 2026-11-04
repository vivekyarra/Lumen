/**
 * Every user-facing string in Lumen is built here, from LumenData, so wording matches
 * LUMEN_SPEC.md §8.8 exactly and never drifts between engines.
 */
import { DRUGS, LINES, PORTS, SYRINGES, lineForPort, LineId, PortId, SyringeId } from "./LumenData";

export const HINT_TEXT = "Pick up a syringe to check ports.";
export const PUSH_TEXT = "Push here";
export const RESOLVED_TEXT = "Resolved";
export const COMPATIBLE_TEXT = "✓ Compatible";
export const NOT_IN_TABLE_TEXT = "✕ Not in table — check chart";

export function holdingText(s: SyringeId): string {
  return "Holding: " + SYRINGES[s].label;
}

/** Short reason shown on a red port while holding (one word after the cross). */
export function redShortText(port: PortId): string {
  return "✕ " + DRUGS[lineForPort(port).drug].shortName;
}

/** Long reason shown on a focused red port. */
export function redFocusText(port: PortId): string {
  return "✕ " + DRUGS[lineForPort(port).drug].shortName + " — do not push here";
}

/** Redirect label shown at the nearest compatible port. */
export function useText(port: PortId): string {
  return "Use: " + PORTS[port].shortName + " (" + DRUGS[lineForPort(port).drug].shortName + ") — compatible";
}

export function portLabel(port: PortId): string {
  return PORTS[port].label;
}

export function pumpLabel(line: LineId): string {
  const l = LINES[line];
  return DRUGS[l.drug].shortName + " · " + l.rate + " · Pump " + l.pump;
}

export function bagLabel(line: LineId): string {
  return LINES[line].bagLabel;
}

export function twoDigits(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function formatClock(hours: number, minutes: number): string {
  return twoDigits(hours) + ":" + twoDigits(minutes);
}

export function logText(s: SyringeId, port: PortId, hhmm: string): string {
  return SYRINGES[s].label + " → " + PORTS[port].logName + " · " + hhmm;
}

/** Word count used by the "max 6 words per label" rule (LUMEN_SPEC.md §8.6). Symbols are not words. */
export function wordCount(text: string): number {
  const parts = text.split(/\s+/);
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    if (/[A-Za-z0-9]/.test(parts[i])) {
      n++;
    }
  }
  return n;
}
