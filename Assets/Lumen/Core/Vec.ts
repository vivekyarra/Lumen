/**
 * Tiny engine-agnostic 3D vector helpers.
 *
 * Coordinates in Lumen's core are "spec space", in centimetres,
 * measured from the user's start point on the floor:
 *   r = right (+ to the user's right), f = forward (+ away from the user), u = up (+ up from the floor).
 * Engine adapters (Lens Studio, web preview) convert to their own axes.
 */
export interface V3 {
  r: number;
  f: number;
  u: number;
}

export function v3(r: number, f: number, u: number): V3 {
  return { r: r, f: f, u: u };
}

export function add(a: V3, b: V3): V3 {
  return { r: a.r + b.r, f: a.f + b.f, u: a.u + b.u };
}

export function sub(a: V3, b: V3): V3 {
  return { r: a.r - b.r, f: a.f - b.f, u: a.u - b.u };
}

export function scale(a: V3, s: number): V3 {
  return { r: a.r * s, f: a.f * s, u: a.u * s };
}

export function dot(a: V3, b: V3): number {
  return a.r * b.r + a.f * b.f + a.u * b.u;
}

export function cross(a: V3, b: V3): V3 {
  return {
    r: a.f * b.u - a.u * b.f,
    f: a.u * b.r - a.r * b.u,
    u: a.r * b.f - a.f * b.r,
  };
}

export function length(a: V3): number {
  return Math.sqrt(dot(a, a));
}

export function distance(a: V3, b: V3): number {
  return length(sub(a, b));
}

export function normalize(a: V3): V3 {
  const len = length(a);
  if (len < 1e-9) {
    return { r: 0, f: 0, u: 0 };
  }
  return scale(a, 1 / len);
}

export function lerp(a: V3, b: V3, t: number): V3 {
  return {
    r: a.r + (b.r - a.r) * t,
    f: a.f + (b.f - a.f) * t,
    u: a.u + (b.u - a.u) * t,
  };
}

export function angleBetweenDeg(a: V3, b: V3): number {
  const c = dot(normalize(a), normalize(b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
