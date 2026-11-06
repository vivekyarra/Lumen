/**
 * Attention — how much each port says, from where the nurse is and where she looks.
 *
 * Four levels of detail, recomputed every frame from the real head pose:
 *   1. Far:     from across the bed (or looking elsewhere), every port shows only its ✓ or ✕. No words.
 *   2. Look:    at a normal working distance, the port nearest the centre of her view adds its short
 *               reason, e.g. "✕ Midazolam". Its neighbours 4 cm away stay quiet.
 *   3. Lean in: closer than 80 cm, every red port says why.
 *   4. Pinch:   the pinched port shows the full answer, the arrow to the safe port and its line.
 *
 * The state machine decides WHAT is true. Attention only decides how much of it to say, so the
 * safety signal (the green ✓ / red ✕ ring) is always on every port while a syringe is in hand.
 */
import { PORT_IDS, PortId } from "./LumenData";
import { LumenView, PortView } from "./LumenState";
import { V3, angleBetweenDeg, distance, sub } from "./Vec";
import { Pose } from "./ViewMath";

export const ATTENTION = {
  /** Lean in closer than this (cm, eye to nearest port) and every port says its reason. */
  nearEnterCm: 80,
  /** Step back past this and the ports go back to icons (hysteresis, no flicker). */
  nearExitCm: 90,
  /** Farther than this (cm, eye to the port) and looking at a port adds no words. */
  gazeMaxCm: 140,
  /** Hysteresis for gazeMaxCm. */
  gazeMaxExitCm: 150,
  /** A port within this angle of the view centre is the one she is looking at (deg). */
  gazeEnterDeg: 8,
  /** She keeps looking at it until it leaves this wider cone (deg). */
  gazeExitDeg: 11,
  /** A neighbour must be this much closer to the view centre to take the gaze over (deg). */
  gazeSwitchDeg: 0.8,
  /** Words pop in over this time (s). */
  popInSec: 0.18,
};

export interface AttentionState {
  /** The eye is close to the ports: every port says its short reason. */
  near: boolean;
  /** The port she is looking at, or null. */
  gazed: PortId | null;
  /** Eye to the nearest port (cm). */
  nearestCm: number;
}

export const NO_ATTENTION: AttentionState = { near: false, gazed: null, nearestCm: Infinity };

/** Angle (deg) between the view direction and the direction from the eye to `p`. */
export function gazeAngleDeg(pose: Pose, p: V3): number {
  return angleBetweenDeg(pose.forward, sub(p, pose.eye));
}

/** Recompute attention for this frame. `prev` gives hysteresis so words never flicker at a boundary. */
export function attend(pose: Pose, positions: { [K in PortId]: V3 }, prev: AttentionState): AttentionState {
  let nearestCm = Infinity;
  let best: PortId | null = null;
  let bestAngle = Infinity;
  const angles = {} as { [K in PortId]: number };
  for (let i = 0; i < PORT_IDS.length; i++) {
    const p = PORT_IDS[i];
    const d = distance(pose.eye, positions[p]);
    nearestCm = Math.min(nearestCm, d);
    // Too far to read: this port cannot take her gaze.
    const reach = prev.gazed === p ? ATTENTION.gazeMaxExitCm : ATTENTION.gazeMaxCm;
    const a = d < reach ? gazeAngleDeg(pose, positions[p]) : Infinity;
    angles[p] = a;
    if (a < bestAngle) {
      bestAngle = a;
      best = p;
    }
  }
  const near = prev.near ? nearestCm < ATTENTION.nearExitCm : nearestCm < ATTENTION.nearEnterCm;
  let gazed: PortId | null = null;
  if (prev.gazed !== null && angles[prev.gazed] < ATTENTION.gazeExitDeg) {
    // Keep the current port unless a neighbour is clearly nearer the view centre.
    gazed = best !== null && best !== prev.gazed && bestAngle < ATTENTION.gazeEnterDeg && angles[prev.gazed] - bestAngle > ATTENTION.gazeSwitchDeg ? best : prev.gazed;
  } else if (best !== null && bestAngle < ATTENTION.gazeEnterDeg) {
    gazed = best;
  }
  return { near: near, gazed: gazed, nearestCm: nearestCm };
}

/** Does this port's label need her attention before it shows? Short red reasons do; pinched answers do not. */
export function isGlanceDetail(pv: PortView): boolean {
  return pv.label !== null && pv.labelRole === "incompatible" && !pv.focused;
}

/**
 * The view as it is drawn this frame: short reasons show only on the port she looks at, or on every
 * port when she leans in. Everything she pinched, every ring, the chip, the push button, the redirect
 * and the alarm are untouched.
 */
export function applyAttention(view: LumenView, att: AttentionState): LumenView {
  const ports = {} as { [K in PortId]: PortView };
  for (let i = 0; i < PORT_IDS.length; i++) {
    const p = PORT_IDS[i];
    const pv = view.ports[p];
    const quiet = isGlanceDetail(pv) && !att.near && att.gazed !== p;
    ports[p] = quiet ? { port: pv.port, marker: pv.marker, opacity: pv.opacity, focused: pv.focused, label: null, labelRole: null, pulse: pv.pulse } : pv;
  }
  return {
    mode: view.mode,
    held: view.held,
    chipText: view.chipText,
    hintText: view.hintText,
    noticeText: view.noticeText,
    handoff: view.handoff,
    ports: ports,
    glowLine: view.glowLine,
    pumpLabel: view.pumpLabel,
    pushButtonPort: view.pushButtonPort,
    pushText: view.pushText,
    redirect: view.redirect,
    logText: view.logText,
    alarm: view.alarm,
  };
}

/** Scale of a label `ageSec` after it appeared: pops from 70 % to 100 % with a soft overshoot. */
export function popScale(ageSec: number): number {
  if (ageSec >= ATTENTION.popInSec) return 1;
  const k = Math.max(0, ageSec / ATTENTION.popInSec);
  const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
  return 0.7 + 0.3 * ease;
}

/** Tracks one engine's attention between frames (hysteresis) and the time each label appeared (pop-in). */
export class AttentionTracker {
  state: AttentionState = NO_ATTENTION;
  /** When set, tests use this pose instead of the camera (never set in normal use). */
  overridePose: Pose | null = null;
  private shownSince = {} as { [K in PortId]: number };
  private lastText = {} as { [K in PortId]: string | null };

  constructor() {
    this.reset();
  }

  reset(): void {
    this.state = NO_ATTENTION;
    for (let i = 0; i < PORT_IDS.length; i++) {
      this.shownSince[PORT_IDS[i]] = -1;
      this.lastText[PORT_IDS[i]] = null;
    }
  }

  /** Recompute from the camera pose (or the test override) and return the view to draw. */
  update(view: LumenView, cameraPose: Pose, positions: { [K in PortId]: V3 }, t: number): LumenView {
    this.state = attend(this.overridePose || cameraPose, positions, this.state);
    const out = applyAttention(view, this.state);
    for (let i = 0; i < PORT_IDS.length; i++) {
      const p = PORT_IDS[i];
      const text = out.ports[p].label;
      if (text !== this.lastText[p]) {
        this.shownSince[p] = text === null ? -1 : this.lastText[p] === null ? t : this.shownSince[p];
        this.lastText[p] = text;
      }
    }
    return out;
  }

  /** Label scale for the pop-in (1 when settled). */
  labelScale(p: PortId, t: number): number {
    const s = this.shownSince[p];
    return s < 0 ? 1 : popScale(t - s);
  }
}
