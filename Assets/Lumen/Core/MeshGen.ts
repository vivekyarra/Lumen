/**
 * Procedural meshes shared by the Lens Studio build (MeshBuilder) and the web preview (BufferGeometry).
 *
 * Two coordinate conventions:
 *   - "world" meshes use spec space: x = r (right), y = f (forward), z = u (up).
 *   - "billboard" meshes use label space: x = right, y = up, z = toward the viewer.
 * Both are right-handed; triangles wind counter-clockwise seen from outside.
 */
import { V3, add, cross, dot, length, normalize, scale, sub, v3 } from "./Vec";

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export function emptyMesh(): MeshData {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

export function vertexCount(m: MeshData): number {
  return m.positions.length / 3;
}

function pushVertex(m: MeshData, p: V3, n: V3, u: number, w: number): number {
  m.positions.push(p.r, p.f, p.u);
  m.normals.push(n.r, n.f, n.u);
  m.uvs.push(u, w);
  return m.positions.length / 3 - 1;
}

export function merge(meshes: MeshData[]): MeshData {
  const out = emptyMesh();
  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const base = vertexCount(out);
    for (let j = 0; j < m.positions.length; j++) out.positions.push(m.positions[j]);
    for (let j = 0; j < m.normals.length; j++) out.normals.push(m.normals[j]);
    for (let j = 0; j < m.uvs.length; j++) out.uvs.push(m.uvs[j]);
    for (let j = 0; j < m.indices.length; j++) out.indices.push(m.indices[j] + base);
  }
  return out;
}

/** Axis-aligned box. */
export function box(center: V3, size: V3): MeshData {
  const m = emptyMesh();
  const h = scale(size, 0.5);
  // Each face: normal, then two in-plane axes (a, b) with a × b = normal.
  const faces: [V3, V3, V3][] = [
    [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)],
    [v3(-1, 0, 0), v3(0, 0, 1), v3(0, 1, 0)],
    [v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)],
    [v3(0, -1, 0), v3(1, 0, 0), v3(0, 0, 1)],
    [v3(0, 0, 1), v3(1, 0, 0), v3(0, 1, 0)],
    [v3(0, 0, -1), v3(0, 1, 0), v3(1, 0, 0)],
  ];
  for (let i = 0; i < faces.length; i++) {
    const n = faces[i][0];
    const a = faces[i][1];
    const b = faces[i][2];
    const c = add(center, v3(n.r * h.r, n.f * h.f, n.u * h.u));
    const ea = v3(a.r * h.r, a.f * h.f, a.u * h.u);
    const eb = v3(b.r * h.r, b.f * h.f, b.u * h.u);
    const i0 = pushVertex(m, sub(sub(c, ea), eb), n, 0, 0);
    pushVertex(m, sub(add(c, ea), eb), n, 1, 0);
    pushVertex(m, add(add(c, ea), eb), n, 1, 1);
    pushVertex(m, add(sub(c, ea), eb), n, 0, 1);
    m.indices.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  return m;
}

/** Any vector perpendicular to `d`. */
function perpendicular(d: V3): V3 {
  const a = Math.abs(d.u) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0);
  return normalize(cross(d, a));
}

/** Tube along a polyline with parallel-transport frames (no twisting). Open ends unless `caps`. */
export function tube(points: V3[], radius: number, sides: number, caps: boolean): MeshData {
  const m = emptyMesh();
  if (points.length < 2) return m;
  const n = points.length;
  let normal = perpendicular(normalize(sub(points[1], points[0])));
  let total = 0;
  for (let i = 0; i < n; i++) {
    const tangent =
      i === 0 ? normalize(sub(points[1], points[0]))
        : i === n - 1 ? normalize(sub(points[n - 1], points[n - 2]))
          : normalize(add(normalize(sub(points[i], points[i - 1])), normalize(sub(points[i + 1], points[i]))));
    // Parallel transport: remove the tangent component and renormalise.
    normal = normalize(sub(normal, scale(tangent, dot(normal, tangent))));
    if (length(normal) < 1e-6) normal = perpendicular(tangent);
    const binormal = normalize(cross(tangent, normal));
    if (i > 0) total += length(sub(points[i], points[i - 1]));
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const dir = add(scale(normal, Math.cos(a)), scale(binormal, Math.sin(a)));
      pushVertex(m, add(points[i], scale(dir, radius)), dir, s / sides, total);
    }
  }
  const ring = sides + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * ring + s;
      const b = a + ring;
      m.indices.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  if (caps) {
    capEnd(m, points[0], normalize(sub(points[0], points[1])), radius, sides);
    capEnd(m, points[n - 1], normalize(sub(points[n - 1], points[n - 2])), radius, sides);
  }
  return m;
}

function capEnd(m: MeshData, center: V3, outward: V3, radius: number, sides: number): void {
  const a = perpendicular(outward);
  const b = cross(outward, a);
  const c = pushVertex(m, center, outward, 0.5, 0.5);
  for (let s = 0; s <= sides; s++) {
    const t = (s / sides) * Math.PI * 2;
    pushVertex(m, add(center, add(scale(a, Math.cos(t) * radius), scale(b, Math.sin(t) * radius))), outward, 0, 0);
  }
  for (let s = 0; s < sides; s++) m.indices.push(c, c + 1 + s, c + 2 + s);
}

export function cylinder(from: V3, to: V3, radius: number, sides: number): MeshData {
  return tube([from, to], radius, sides, true);
}

export function sphere(center: V3, radius: number, rings: number, sides: number): MeshData {
  const m = emptyMesh();
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI; // 0 at the top
    for (let s = 0; s <= sides; s++) {
      const th = (s / sides) * Math.PI * 2;
      const n = v3(Math.sin(phi) * Math.cos(th), Math.sin(phi) * Math.sin(th), Math.cos(phi));
      pushVertex(m, add(center, scale(n, radius)), n, s / sides, i / rings);
    }
  }
  const ring = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * ring + s;
      const b = a + ring;
      m.indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return m;
}

/** Capsule = cylinder + two spheres (simple, smooth mannequin parts). */
export function capsule(from: V3, to: V3, radius: number, sides: number): MeshData {
  return merge([tube([from, to], radius, sides, false), sphere(from, radius, 8, sides), sphere(to, radius, 8, sides)]);
}

/** Ellipsoid (sphere scaled per axis). */
export function ellipsoid(center: V3, radii: V3, rings: number, sides: number): MeshData {
  const m = sphere(v3(0, 0, 0), 1, rings, sides);
  for (let i = 0; i < m.positions.length; i += 3) {
    const nx = m.normals[i] / radii.r;
    const ny = m.normals[i + 1] / radii.f;
    const nz = m.normals[i + 2] / radii.u;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    m.positions[i] = center.r + m.positions[i] * radii.r;
    m.positions[i + 1] = center.f + m.positions[i + 1] * radii.f;
    m.positions[i + 2] = center.u + m.positions[i + 2] * radii.u;
    m.normals[i] = nx / nl;
    m.normals[i + 1] = ny / nl;
    m.normals[i + 2] = nz / nl;
  }
  return m;
}

// ---------------- billboard (label-space) shapes: x right, y up, z toward viewer ----------------

/** Flat quad strip between two 2D points (thickness w), facing +z. */
function strip(m: MeshData, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const n = v3(0, 0, 1);
  const i0 = pushVertex(m, v3(x0 - nx, y0 - ny, 0), n, 0, 0);
  pushVertex(m, v3(x1 - nx, y1 - ny, 0), n, 1, 0);
  pushVertex(m, v3(x1 + nx, y1 + ny, 0), n, 1, 1);
  pushVertex(m, v3(x0 + nx, y0 + ny, 0), n, 0, 1);
  m.indices.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}

/** Flat annulus (marker ring), outer diameter `diameter`, facing +z. */
export function ringXY(diameter: number, width: number, segments: number): MeshData {
  const m = emptyMesh();
  const ro = diameter / 2;
  const ri = ro - width;
  const n = v3(0, 0, 1);
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    pushVertex(m, v3(Math.cos(a) * ri, Math.sin(a) * ri, 0), n, s / segments, 0);
    pushVertex(m, v3(Math.cos(a) * ro, Math.sin(a) * ro, 0), n, s / segments, 1);
  }
  for (let s = 0; s < segments; s++) {
    const a = s * 2;
    m.indices.push(a, a + 3, a + 2, a, a + 1, a + 3);
  }
  return m;
}

/** Filled disc facing +z. */
export function discXY(diameter: number, segments: number): MeshData {
  const m = emptyMesh();
  const n = v3(0, 0, 1);
  const c = pushVertex(m, v3(0, 0, 0), n, 0.5, 0.5);
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2;
    pushVertex(m, v3((Math.cos(a) * diameter) / 2, (Math.sin(a) * diameter) / 2, 0), n, 0, 0);
  }
  for (let s = 0; s < segments; s++) m.indices.push(c, c + 1 + s, c + 2 + s);
  return m;
}

/** ✓ icon as geometry (fonts may lack the glyph). `size` = overall width. */
export function checkXY(size: number, stroke: number): MeshData {
  const m = emptyMesh();
  const s = size / 2;
  strip(m, -s * 0.8, 0, -s * 0.2, -s * 0.6, stroke);
  strip(m, -s * 0.2, -s * 0.6, s * 0.85, s * 0.6, stroke);
  return m;
}

/** ✕ icon as geometry. */
export function crossXY(size: number, stroke: number): MeshData {
  const m = emptyMesh();
  const s = (size / 2) * 0.7;
  strip(m, -s, -s, s, s, stroke);
  strip(m, -s, s, s, -s, stroke);
  return m;
}

/** Chevron pointing along +x (rotate in the view plane for the edge arrow). */
export function chevronXY(size: number, stroke: number): MeshData {
  const m = emptyMesh();
  const s = size / 2;
  strip(m, -s * 0.4, s, s * 0.5, 0, stroke);
  strip(m, s * 0.5, 0, -s * 0.4, -s, stroke);
  return m;
}

/** Rectangle outline (button border), centred, facing +z. */
export function rectOutlineXY(w: number, h: number, stroke: number): MeshData {
  const m = emptyMesh();
  const x = w / 2;
  const y = h / 2;
  const e = stroke / 2;
  strip(m, -x - e, -y, x + e, -y, stroke);
  strip(m, -x - e, y, x + e, y, stroke);
  strip(m, -x, -y, -x, y, stroke);
  strip(m, x, -y, x, y, stroke);
  return m;
}

/** Filled rectangle facing +z (button backplate / hit area). */
export function rectXY(w: number, h: number): MeshData {
  const m = emptyMesh();
  strip(m, -w / 2, 0, w / 2, 0, h);
  return m;
}

/** Signed volume of a closed mesh (positive when triangles wind outward). */
export function signedVolume(m: MeshData): number {
  let vol = 0;
  const p = m.positions;
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3;
    const b = m.indices[i + 1] * 3;
    const c = m.indices[i + 2] * 3;
    const pa = v3(p[a], p[a + 1], p[a + 2]);
    const pb = v3(p[b], p[b + 1], p[b + 2]);
    const pc = v3(p[c], p[c + 1], p[c + 2]);
    vol += dot(pa, cross(pb, pc)) / 6;
  }
  return vol;
}
