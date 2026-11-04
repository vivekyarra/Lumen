// Spec space (r, f, u) in cm → three.js world (x right, y up, z toward the start viewer), in cm.
import * as THREE from "three";
import { V3 } from "../../Assets/Lumen/Core/Vec";
import { MeshData } from "../../Assets/Lumen/Core/MeshGen";

export function toThree(p: V3): THREE.Vector3 {
  return new THREE.Vector3(p.r, p.u, -p.f);
}

export function fromThree(v: THREE.Vector3): V3 {
  return { r: v.x, f: -v.z, u: v.y };
}

/** World mesh (spec space) → BufferGeometry in three space. */
export function worldGeometry(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(m.positions.length);
  const nor = new Float32Array(m.normals.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    pos[i] = m.positions[i];
    pos[i + 1] = m.positions[i + 2];
    pos[i + 2] = -m.positions[i + 1];
    nor[i] = m.normals[i];
    nor[i + 1] = m.normals[i + 2];
    nor[i + 2] = -m.normals[i + 1];
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(m.uvs), 2));
  g.setIndex(m.indices);
  return g;
}

/** Billboard mesh (x right, y up, z toward viewer) → BufferGeometry (same axes as a three object facing +z). */
export function billboardGeometry(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m.positions), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(m.normals), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(m.uvs), 2));
  g.setIndex(m.indices);
  return g;
}
