/**
 * Shared helpers for Lumen's LEAF scenarios (Snap's Lens Studio test framework, `Leaf.lspkg`).
 * Every interaction goes through the Lens's real SIK Interactables by their scene-object names
 * (Syringe_S1_Hit, Port_A_Hit, PushHereButton, Kink_ResolvedButton, IV_Pole_Hit, Cart_HoldingChip_Hit),
 * exactly as a pinch in the preview would. Expected values come from Core/Strings + Core/LumenData
 * (the Lens's only data file) — never typed in by hand.
 */
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { PortId, PORT_IDS, LINE_IDS } from "../Core/LumenData";
import { V3 } from "../Core/Vec";
import { lookAt } from "../Core/ViewMath";

/** Names of the Lens's pinch targets (created at runtime by Assets/Lumen/Lens). */
export const HIT = {
  syringe: function (s: "S1" | "S2"): string { return "Syringe_" + s + "_Hit"; },
  port: function (p: PortId): string { return "Port_" + p + "_Hit"; },
  push: "PushHereButton",
  resolved: "Kink_ResolvedButton",
  pole: "IV_Pole_Hit",
  chip: "Cart_HoldingChip_Hit",
};

export class LumenLeafInteractor extends DefaultLeafInteractor {
  /** Pinch (trigger) one of Lumen's interactables by name, then let the Lens render a frame or two. */
  async pinch(name: string): Promise<void> {
    const target = findInteractableByName(name);
    if (!target) throw new Error("Interactable \"" + name + "\" not found or not enabled");
    await this.trigger(target);
    await sleep(250);
  }
}

/** The hidden test hook LumenLens installs once the bedside is built (never drawn). */
export function lumen(): any {
  const l = (global as any).lumen;
  if (!l) throw new Error("Lumen is not ready: no global.lumen (is LumenLens on the scene?)");
  return l;
}

/** LumenLens builds 0.3 s after start (DelayedCallbackEvent); wait for it, then start a clean session. */
export async function freshSession(): Promise<void> {
  for (let i = 0; i < 50 && !(global as any).lumen; i++) await sleep(100);
  lumen().lens.attention.overridePose = null;
  lumen().lens.resetSession();
  await sleep(300);
}

export function view(): any {
  return lumen().view();
}

export function shown(o: SceneObject | null | undefined): boolean {
  return !!o && o.isEnabledInHierarchy;
}

export function anyRingShown(): boolean {
  const ports = lumen().lens.ports;
  for (let i = 0; i < PORT_IDS.length; i++) if (shown(ports[PORT_IDS[i]].ring)) return true;
  return false;
}

/** Line ids whose trace glow is currently visible. */
export function glowingLines(): number[] {
  const lines = lumen().lens.lines;
  const out: number[] = [];
  for (let i = 0; i < LINE_IDS.length; i++) if (shown(lines[LINE_IDS[i]].glow)) out.push(LINE_IDS[i]);
  return out;
}

/**
 * Point the Lens's attention at a head pose (eye → target, spec cm) and let it render a few frames.
 * Only the detail-on-ports tracker reads this pose; everything else keeps following the preview camera.
 */
export async function lookFrom(eye: V3, target: V3): Promise<void> {
  lumen().lens.attention.overridePose = lookAt(eye, target);
  await sleep(150);
}
