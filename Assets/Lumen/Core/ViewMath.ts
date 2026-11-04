/**
 * View math shared by every engine: camera poses, field-of-view checks, the out-of-view
 * edge arrow, projection of label boxes, and overlap tests (DC7, DC8).
 */
import { V3, add, cross, dot, length, normalize, scale, sub, v3 } from "./Vec";

/** SPECS display field of view (LUMEN_SPEC.md §8.2). */
export const SPECS_FOV = { h: 37, v: 32 };

export interface Pose {
  eye: V3;
  forward: V3;
  up: V3;
  right: V3;
}

/** Pose looking from `eye` at `target`, kept upright (world up = +u). */
export function lookAt(eye: V3, target: V3): Pose {
  const forward = normalize(sub(target, eye));
  let right = cross(forward, v3(0, 0, 1));
  if (length(right) < 1e-6) right = v3(1, 0, 0);
  right = normalize(right);
  const up = normalize(cross(right, forward));
  return { eye: eye, forward: forward, up: up, right: right };
}

/** Pose from yaw (deg, + turns right) and pitch (deg, + looks up); yaw 0 looks along +f. */
export function poseFromYawPitch(eye: V3, yawDeg: number, pitchDeg: number): Pose {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const forward = v3(Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), Math.sin(p));
  return lookAt(eye, add(eye, forward));
}

export interface ViewPoint {
  /** Horizontal angle from view centre, degrees (+ right). */
  azimuth: number;
  /** Vertical angle from view centre, degrees (+ up). */
  elevation: number;
  /** Distance along the view direction (negative = behind). */
  depth: number;
  /** Normalised device coordinates for the given FOV (−1..1 inside the view). */
  ndcX: number;
  ndcY: number;
}

export function toView(pose: Pose, p: V3, fov: { h: number; v: number }): ViewPoint {
  const d = sub(p, pose.eye);
  const x = dot(d, pose.right);
  const y = dot(d, pose.up);
  const z = dot(d, pose.forward);
  const tanH = Math.tan(((fov.h / 2) * Math.PI) / 180);
  const tanV = Math.tan(((fov.v / 2) * Math.PI) / 180);
  const zz = z > 1e-6 ? z : 1e-6;
  return {
    azimuth: (Math.atan2(x, z) * 180) / Math.PI,
    elevation: (Math.atan2(y, Math.sqrt(x * x + z * z)) * 180) / Math.PI,
    depth: z,
    ndcX: x / zz / tanH,
    ndcY: y / zz / tanV,
  };
}

export function isInView(pose: Pose, p: V3, fov: { h: number; v: number }, marginNdc?: number): boolean {
  const m = marginNdc === undefined ? 0 : marginNdc;
  const vp = toView(pose, p, fov);
  return vp.depth > 0 && Math.abs(vp.ndcX) <= 1 - m && Math.abs(vp.ndcY) <= 1 - m;
}

export interface EdgeArrow {
  visible: boolean;
  /** Arrow position on the view edge in NDC (inset from the border). */
  ndcX: number;
  ndcY: number;
  /** Direction the chevron points, degrees in the view plane (0 = right, 90 = up). */
  angleDeg: number;
}

/**
 * Where to show the amber edge chevron for an out-of-view target (LUMEN_SPEC.md §8.4 ALARM).
 * Hidden while the target is inside the view (with a small hysteresis-free margin).
 */
export function edgeArrow(pose: Pose, target: V3, fov: { h: number; v: number }, inset: number): EdgeArrow {
  const d = sub(target, pose.eye);
  const x = dot(d, pose.right);
  const y = dot(d, pose.up);
  const z = dot(d, pose.forward);
  const inView = isInView(pose, target, fov, 0);
  if (inView) {
    return { visible: false, ndcX: 0, ndcY: 0, angleDeg: 0 };
  }
  // Direction in the view plane. Behind the user: use the lateral direction only.
  let dx = x;
  let dy = y;
  if (z <= 0 && Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    dx = 1;
  }
  const tanH = Math.tan(((fov.h / 2) * Math.PI) / 180);
  const tanV = Math.tan(((fov.v / 2) * Math.PI) / 180);
  // Scale so the direction is expressed in NDC units, then push it to the border.
  const nx = dx / tanH;
  const ny = dy / tanV;
  const k = 1 / Math.max(Math.abs(nx), Math.abs(ny), 1e-9);
  const edge = 1 - inset;
  return {
    visible: true,
    ndcX: nx * k * edge,
    ndcY: ny * k * edge,
    angleDeg: (Math.atan2(ny, nx) * 180) / Math.PI,
  };
}

export type Align = "left" | "center" | "right";

export interface LabelBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Text metrics used for layout checks: 1.8 cm caps ≈ 2.57 cm em, ~0.52 em per character. */
export function estimateTextWidthCm(text: string, capHeightCm: number): number {
  const em = capHeightCm / 0.7;
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    units += ch === " " ? 0.28 : /[A-Z0-9✓✕%]/.test(ch) ? 0.64 : /[a-z]/.test(ch) ? 0.52 : 0.4;
  }
  return units * em;
}

export function estimateTextHeightCm(capHeightCm: number): number {
  return (capHeightCm / 0.7) * 1.15;
}

/**
 * Billboard axes for a label at `anchor` facing `eye`: the label turns to face the eye
 * (yaw and pitch) but never rolls, so text stays upright (LUMEN_SPEC.md §8.6).
 */
export function billboardAxes(eye: V3, anchor: V3): { right: V3; up: V3; normal: V3 } {
  const normal = normalize(sub(eye, anchor));
  let right = cross(v3(0, 0, 1), normal);
  right = length(right) < 1e-6 ? v3(1, 0, 0) : normalize(right);
  const up = normalize(cross(normal, right));
  return { right: right, up: up, normal: normal };
}

/** Wraps text to at most two lines, preferring " — " / " → ", then the most balanced " · ", then ": ", else a space. */
export function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const seps = [" — ", " → "];
  for (let i = 0; i < seps.length; i++) {
    const at = text.indexOf(seps[i]);
    if (at > 0 && at <= maxChars + 4) {
      return [text.substring(0, at), text.substring(at + 1)];
    }
  }
  // Label fields separated by " · ": split at the most balanced separator (the dot is dropped at the break).
  let bestDot = -1;
  let bestLen = Infinity;
  for (let at = text.indexOf(" · "); at > 0; at = text.indexOf(" · ", at + 1)) {
    const len = Math.max(at, text.length - at - 3);
    if (len < bestLen) {
      bestLen = len;
      bestDot = at;
    }
  }
  if (bestDot > 0 && bestLen <= maxChars + 6) {
    return [text.substring(0, bestDot), text.substring(bestDot + 3)];
  }
  const colon = text.indexOf(": ");
  if (colon > 0 && colon < maxChars) {
    return [text.substring(0, colon + 1), text.substring(colon + 2)];
  }
  let cut = text.lastIndexOf(" ", maxChars);
  if (cut <= 0) cut = text.indexOf(" ");
  if (cut <= 0) return [text];
  return [text.substring(0, cut), text.substring(cut + 1)];
}

/**
 * Screen-space (NDC) box of a camera-facing label. The anchor is the bottom edge of the text block;
 * `align` says which edge sits on the anchor: "left" = text runs right from it; "right" = ends at it.
 */
export function labelScreenBox(
  id: string,
  pose: Pose,
  anchor: V3,
  widthCm: number,
  heightCm: number,
  align: Align,
  fov: { h: number; v: number },
): LabelBox {
  const axes = billboardAxes(pose.eye, anchor);
  const x0 = align === "left" ? 0 : align === "right" ? -widthCm : -widthCm / 2;
  const corners = [
    add(anchor, scale(axes.right, x0)),
    add(anchor, scale(axes.right, x0 + widthCm)),
    add(anchor, add(scale(axes.right, x0), scale(axes.up, heightCm))),
    add(anchor, add(scale(axes.right, x0 + widthCm), scale(axes.up, heightCm))),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const vp = toView(pose, corners[i], fov);
    minX = Math.min(minX, vp.ndcX);
    maxX = Math.max(maxX, vp.ndcX);
    minY = Math.min(minY, vp.ndcY);
    maxY = Math.max(maxY, vp.ndcY);
  }
  return { id: id, minX: minX, maxX: maxX, minY: minY, maxY: maxY };
}

/** Size (cm) of a possibly wrapped label. */
export function labelSizeCm(text: string, capHeightCm: number, wrapChars: number): { w: number; h: number; lines: string[] } {
  const lines = wrapLabel(text, wrapChars);
  let w = 0;
  for (let i = 0; i < lines.length; i++) w = Math.max(w, estimateTextWidthCm(lines[i], capHeightCm));
  return { w: w, h: estimateTextHeightCm(capHeightCm) * lines.length, lines: lines };
}

export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/** All overlapping pairs, as "idA|idB". */
export function overlappingPairs(boxes: LabelBox[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) out.push(boxes[i].id + "|" + boxes[j].id);
    }
  }
  return out;
}
