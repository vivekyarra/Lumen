/**
 * Curve helpers for IV lines: centripetal Catmull-Rom sampling, arc-length lookup,
 * and 2D (top-down) crossing counts used to keep the "tangle" to exactly one crossing.
 */
import { V3, distance, lerp, v3 } from "./Vec";

function tj(ti: number, a: V3, b: V3): number {
  // Centripetal parameterisation (alpha = 0.5) — no cusps or self-loops on uneven spacing.
  return ti + Math.sqrt(Math.max(distance(a, b), 1e-6));
}

function catmullRomSegment(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const a1 = lerp(p0, p1, (tt - t0) / (t1 - t0));
  const a2 = lerp(p1, p2, (tt - t1) / (t2 - t1));
  const a3 = lerp(p2, p3, (tt - t2) / (t3 - t2));
  const b1 = lerp(a1, a2, (tt - t0) / (t2 - t0));
  const b2 = lerp(a2, a3, (tt - t1) / (t3 - t1));
  return lerp(b1, b2, (tt - t1) / (t2 - t1));
}

export interface SampledCurve {
  points: V3[];
  /** Cumulative arc length at each point (cm). */
  cumulative: number[];
  totalLength: number;
  /** Index in `points` of each original control point. */
  controlIndex: number[];
}

/**
 * Samples a smooth curve through every control point.
 * `samplesPerSegment` points are emitted for each control-point span (the last point is added once).
 */
export function sampleCurve(control: V3[], samplesPerSegment: number): SampledCurve {
  if (control.length < 2) {
    throw new Error("A curve needs at least 2 control points");
  }
  const pts: V3[] = [];
  const controlIndex: number[] = [];
  const n = control.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? sub2(control[0], control[1]) : control[i - 1];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = i + 2 < n ? control[i + 2] : sub2(control[n - 1], control[n - 2]);
    controlIndex.push(pts.length);
    for (let s = 0; s < samplesPerSegment; s++) {
      pts.push(catmullRomSegment(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  controlIndex.push(pts.length);
  pts.push(control[n - 1]);
  const cumulative: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(pts[i - 1], pts[i]));
  }
  return { points: pts, cumulative: cumulative, totalLength: cumulative[cumulative.length - 1], controlIndex: controlIndex };
}

/** Mirror `a` across `b` (phantom end point for Catmull-Rom). */
function sub2(a: V3, b: V3): V3 {
  return v3(2 * a.r - b.r, 2 * a.f - b.f, 2 * a.u - b.u);
}

/** Point at arc-length fraction `t` (0..1) between arc lengths `fromLen` and `toLen`. */
export function pointAtLength(curve: SampledCurve, len: number): V3 {
  const c = curve.cumulative;
  if (len <= 0) return curve.points[0];
  if (len >= curve.totalLength) return curve.points[curve.points.length - 1];
  let lo = 0;
  let hi = c.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid] <= len) lo = mid;
    else hi = mid;
  }
  const seg = c[hi] - c[lo];
  const t = seg > 0 ? (len - c[lo]) / seg : 0;
  return lerp(curve.points[lo], curve.points[hi], t);
}

/** Sub-polyline between two arc lengths (inclusive), for partial glows (e.g. pump → kink). */
export function slice(curve: SampledCurve, fromLen: number, toLen: number): V3[] {
  const out: V3[] = [pointAtLength(curve, fromLen)];
  for (let i = 0; i < curve.points.length; i++) {
    if (curve.cumulative[i] > fromLen && curve.cumulative[i] < toLen) {
      out.push(curve.points[i]);
    }
  }
  out.push(pointAtLength(curve, toLen));
  return out;
}

function segIntersect2D(a: V3, b: V3, c: V3, d: V3): boolean {
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function orient(p: V3, q: V3, r: V3): number {
  return (q.r - p.r) * (r.f - p.f) - (q.f - p.f) * (r.r - p.r);
}

/**
 * Number of top-down (r,f) crossings between two polylines, ignoring any point within
 * `ignoreRadius` cm of `ignoreCenter` (all lines leave the same IV pole, so they touch there).
 */
export function crossings2D(a: V3[], b: V3[], ignoreCenter: V3, ignoreRadius: number): number {
  let count = 0;
  const far = function (p: V3): boolean {
    const dr = p.r - ignoreCenter.r;
    const df = p.f - ignoreCenter.f;
    return Math.sqrt(dr * dr + df * df) > ignoreRadius;
  };
  for (let i = 0; i < a.length - 1; i++) {
    if (!far(a[i]) || !far(a[i + 1])) continue;
    for (let j = 0; j < b.length - 1; j++) {
      if (!far(b[j]) || !far(b[j + 1])) continue;
      if (segIntersect2D(a[i], a[i + 1], b[j], b[j + 1])) count++;
    }
  }
  return count;
}

/** Minimum 3D distance between two polylines (vertex-to-vertex approximation on dense samples). */
export function minDistance(a: V3[], b: V3[]): number {
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const d = distance(a[i], b[j]);
      if (d < best) best = d;
    }
  }
  return best;
}
