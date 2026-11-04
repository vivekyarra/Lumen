/**
 * LensAdapters — the only module (besides the @component entry points) that touches Lens Studio APIs.
 * Converts Lumen's spec space (r, f, u in cm) into Lens Studio world space and wraps mesh, material,
 * text, collider, SIK interactable and audio creation.
 *
 * Lens Studio: x = right, y = up, camera looks along −z; units are centimetres.
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { MeshData } from "../Core/MeshGen";
import { V3 } from "../Core/Vec";

/** Places spec space in the world: the start eye (0, 0, 165) lands on the camera's start pose. */
export class SpecFrame {
  private origin: vec3;
  private yaw: number;

  constructor(cameraStart: vec3, cameraForward: vec3, eyeHeightCm: number) {
    // Keep only the heading of the start pose (gravity stays vertical).
    this.yaw = Math.atan2(cameraForward.x, -cameraForward.z);
    this.origin = new vec3(cameraStart.x, cameraStart.y - eyeHeightCm, cameraStart.z);
  }

  /** Spec point → Lens world point. */
  point(p: V3): vec3 {
    const d = this.dir(p);
    return new vec3(this.origin.x + d.x, this.origin.y + d.y, this.origin.z + d.z);
  }

  /** Spec direction → Lens world direction (rotated by the start heading). */
  dir(p: V3): vec3 {
    const x = p.r;
    const y = p.u;
    const z = -p.f;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return new vec3(c * x - s * z, y, s * x + c * z);
  }

  /** Lens world point → spec point. */
  toSpec(w: vec3): V3 {
    const x0 = w.x - this.origin.x;
    const y0 = w.y - this.origin.y;
    const z0 = w.z - this.origin.z;
    const c = Math.cos(-this.yaw);
    const s = Math.sin(-this.yaw);
    const x = c * x0 - s * z0;
    const z = s * x0 + c * z0;
    return { r: x, f: -z, u: y0 };
  }

  toSpecDir(w: vec3): V3 {
    const c = Math.cos(-this.yaw);
    const s = Math.sin(-this.yaw);
    return { r: c * w.x - s * w.z, f: -(s * w.x + c * w.z), u: w.y };
  }

  /** Rotation of the spec frame in the world (for world meshes built in spec space). */
  rotation(): quat {
    return quat.angleAxis(-this.yaw, vec3.up());
  }

  originPoint(): vec3 {
    return this.origin;
  }
}

/** Rotation whose local x, y, z axes map to the given orthonormal world axes. */
export function quatFromBasis(right: vec3, up: vec3, normal: vec3): quat {
  const m00 = right.x, m01 = up.x, m02 = normal.x;
  const m10 = right.y, m11 = up.y, m12 = normal.y;
  const m20 = right.z, m21 = up.z, m22 = normal.z;
  const tr = m00 + m11 + m22;
  let w: number, x: number, y: number, z: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1.0) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  return new quat(w, x, y, z);
}

/** Turns `obj` to face `eye` without rolling (text stays upright). */
export function faceCamera(obj: SceneObject, eye: vec3): void {
  const t = obj.getTransform();
  const p = t.getWorldPosition();
  let n = eye.sub(p);
  if (n.length < 1e-4) return;
  n = n.normalize();
  let right = vec3.up().cross(n);
  right = right.length < 1e-5 ? new vec3(1, 0, 0) : right.normalize();
  const up = n.cross(right).normalize();
  t.setWorldRotation(quatFromBasis(right, up, n));
}

/**
 * Builds a mesh. `space` "world": MeshData in spec space, converted to the object's local space where
 * the object sits at the spec origin with the spec frame's rotation. "billboard": x right, y up, z normal (as is).
 */
export function buildMesh(data: MeshData, space: "world" | "billboard"): RenderMesh {
  const builder = new MeshBuilder([
    { name: "position", components: 3 },
    { name: "normal", components: 3, normalized: true },
    { name: "texture0", components: 2 },
  ]);
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  const verts: number[] = [];
  const n = data.positions.length / 3;
  for (let i = 0; i < n; i++) {
    const px = data.positions[i * 3], py = data.positions[i * 3 + 1], pz = data.positions[i * 3 + 2];
    const nx = data.normals[i * 3], ny = data.normals[i * 3 + 1], nz = data.normals[i * 3 + 2];
    if (space === "world") {
      verts.push(px, pz, -py, nx, nz, -ny);
    } else {
      verts.push(px, py, pz, nx, ny, nz);
    }
    verts.push(data.uvs[i * 2], data.uvs[i * 2 + 1]);
  }
  builder.appendVerticesInterleaved(verts);
  builder.appendIndices(data.indices);
  builder.updateMesh();
  return builder.getMesh();
}

export interface MaterialOptions {
  color: vec4;
  /** Draw on top of everything (overlay UI). */
  onTop?: boolean;
  additive?: boolean;
  twoSided?: boolean;
  /** Alpha will be animated later: needs a blending pass even if it starts opaque. */
  fade?: boolean;
}

export function makeMaterial(base: Material, o: MaterialOptions): Material {
  const m = base.clone();
  const pass = m.mainPass;
  pass.baseColor = o.color;
  safe(function () { pass.twoSided = o.twoSided !== false; });
  if (o.color.w < 0.999 || o.additive || o.fade || o.onTop) {
    safe(function () { pass.blendMode = o.additive ? BlendMode.Add : BlendMode.Normal; });
    safe(function () { pass.depthWrite = false; });
  }
  if (o.onTop) {
    safe(function () { pass.depthTest = false; });
    safe(function () { pass.depthWrite = false; });
  }
  return m;
}

export function setColor(m: Material, c: vec4): void {
  m.mainPass.baseColor = c;
}

export function addMeshVisual(obj: SceneObject, mesh: RenderMesh, mat: Material, renderOrder?: number): RenderMeshVisual {
  const v = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
  v.mesh = mesh;
  v.mainMaterial = mat;
  if (renderOrder !== undefined) safe(function () { v.setRenderOrder(renderOrder); });
  return v;
}

export function child(parent: SceneObject, name: string): SceneObject {
  const o = global.scene.createSceneObject(name);
  o.setParent(parent);
  return o;
}

export interface TextOptions {
  capCm: number;
  /** "left" = text starts at the anchor; "right" = text ends at it. */
  align: "left" | "center" | "right";
  color: vec4;
  cmPerPoint: number;
  font?: Font;
  onTop: boolean;
}

/** World-space text whose origin is the bottom edge of the block. */
export function makeText(obj: SceneObject, o: TextOptions): Text {
  const t = obj.createComponent("Component.Text") as Text;
  const pointSize = 48;
  t.size = pointSize;
  // Cap height ≈ 0.7 em: scale the object so caps are `capCm` tall.
  const k = o.capCm / 0.7 / (pointSize * o.cmPerPoint);
  obj.getTransform().setLocalScale(new vec3(k, k, k));
  if (o.font) t.font = o.font;
  t.horizontalAlignment = o.align === "left" ? HorizontalAlignment.Left : o.align === "right" ? HorizontalAlignment.Right : HorizontalAlignment.Center;
  t.verticalAlignment = VerticalAlignment.Bottom;
  // World-space text aligns against its layout rect: pin it to the origin so "left"/"right" start/end at the anchor.
  safe(function () { (t as any).layoutRect = Rect.create(0, 0, 0, 0); });
  safe(function () { (t as any).worldSpaceRect = Rect.create(0, 0, 0, 0); });
  // A zero-width rect with the default (wrapping) overflow would wrap one glyph per line: let text overflow it.
  safe(function () { t.horizontalOverflow = HorizontalOverflow.Overflow; });
  safe(function () { t.verticalOverflow = VerticalOverflow.Overflow; });
  t.textFill.color = o.color;
  // Near-black outline: on the additive SPECS display black is transparent, so on glasses it vanishes; in the
  // Lens Studio preview (and on screen recordings) it keeps white text readable against the white bedside.
  safe(function () {
    t.outlineSettings.enabled = true;
    t.outlineSettings.size = 0.32;
    t.outlineSettings.fill.color = new vec4(0.05, 0.07, 0.09, 1);
  });
  // Text.depthTest defaults to false: set it explicitly so printed scene text is hidden by geometry.
  safe(function () { t.depthTest = !o.onTop; });
  if (o.onTop) safe(function () { t.setRenderOrder(30); });
  t.text = "";
  return t;
}

export function setText(t: Text, s: string | null, color?: vec4): void {
  const o = t.getSceneObject();
  if (s === null) {
    if (o.enabled) o.enabled = false;
    return;
  }
  if (t.text !== s) t.text = s;
  if (color) t.textFill.color = color;
  if (!o.enabled) o.enabled = true;
}

/** Sphere / box collider + SIK Interactable. `onPinch` fires on trigger end (pinch release / mouse click). */
export function makePinchTarget(
  obj: SceneObject,
  shape: { sphere: number } | { box: vec3 },
  onPinch: (hitWorld: vec3 | null) => void,
): Interactable {
  const col = obj.createComponent("Physics.ColliderComponent") as ColliderComponent;
  if ("sphere" in shape) {
    const s = Shape.createSphereShape();
    s.radius = shape.sphere;
    col.shape = s;
  } else {
    const b = Shape.createBoxShape();
    b.size = shape.box;
    col.shape = b;
  }
  // Assigning `shape` resets fitVisual to true, so turn it off afterwards (explicit sizes, never the visual's AABB).
  safe(function () { col.fitVisual = false; });
  const it = obj.createComponent(Interactable.getTypeName()) as Interactable;
  it.onTriggerEnd.add(function (e: any) {
    let hit: vec3 | null = null;
    safe(function () {
      const it = e && e.interactor;
      const info = it && it.targetHitInfo;
      if (info && info.hit && info.hit.position) hit = info.hit.position;
      else if (it && it.targetHitPosition) hit = it.targetHitPosition;
    });
    onPinch(hit);
  });
  return it;
}

export function makeAudio(obj: SceneObject, track: AudioTrackAsset | undefined): AudioComponent | null {
  if (!track) return null;
  const a = obj.createComponent("Component.AudioComponent") as AudioComponent;
  a.audioTrack = track;
  // Specs defaults every AudioComponent to LowPower, which audibly lags input-reactive cues.
  safe(function () { a.playbackMode = Audio.PlaybackMode.LowLatency; });
  safe(function () {
    a.spatialAudio.enabled = true;
    a.spatialAudio.positionEffect.enabled = true;
  });
  return a;
}

export function rgba(hex: number, a: number): vec4 {
  return new vec4(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a);
}

/** Runs a Lens API call that may not exist in every Lens Studio version. */
export function safe(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    // Optional API missing in this Lens Studio version: keep going.
  }
}
