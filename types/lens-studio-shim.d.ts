/**
 * Minimal ambient declarations for the Lens Studio / SIK APIs that Assets/Lumen/Lens uses.
 *
 * Lens Studio ships its real typings only inside the app, so CI typechecks the Lens components against
 * this hand-written subset. It catches typos and type errors in our code; it does NOT prove the real
 * API matches — Lens Studio's own compiler and the in-preview self-test (LumenSelfTest) do that.
 */
declare class vec2 { constructor(x: number, y: number); x: number; y: number; }
declare class vec3 {
  constructor(x: number, y: number, z: number);
  x: number; y: number; z: number;
  readonly length: number;
  add(v: vec3): vec3; sub(v: vec3): vec3; cross(v: vec3): vec3; dot(v: vec3): number;
  normalize(): vec3; uniformScale(s: number): vec3;
  static up(): vec3; static forward(): vec3; static zero(): vec3; static one(): vec3;
}
declare class vec4 { constructor(x: number, y: number, z: number, w: number); x: number; y: number; z: number; w: number; }
declare class quat {
  constructor(w: number, x: number, y: number, z: number);
  w: number; x: number; y: number; z: number;
  multiplyVec3(v: vec3): vec3;
  multiply(q: quat): quat;
  static angleAxis(angleRad: number, axis: vec3): quat;
  static quatIdentity(): quat;
  static lookAt(forward: vec3, up: vec3): quat;
}

declare class SceneEvent { bind(cb: (e?: any) => void): void; enabled: boolean; }
declare class DelayedCallbackEvent extends SceneEvent { reset(seconds: number): void; }

declare class Transform {
  getWorldPosition(): vec3; setWorldPosition(p: vec3): void;
  getLocalPosition(): vec3; setLocalPosition(p: vec3): void;
  getWorldRotation(): quat; setWorldRotation(q: quat): void;
  getLocalRotation(): quat; setLocalRotation(q: quat): void;
  getLocalScale(): vec3; setLocalScale(s: vec3): void;
}

declare class Component { getSceneObject(): SceneObject; enabled: boolean; }
declare class ScriptComponent extends Component {}
declare class BaseScriptComponent extends ScriptComponent {
  createEvent(type: "UpdateEvent" | "OnStartEvent" | "LateUpdateEvent"): SceneEvent;
  createEvent(type: "DelayedCallbackEvent"): DelayedCallbackEvent;
  getSceneObject(): SceneObject;
  getTransform(): Transform;
}

declare class SceneObject {
  name: string;
  enabled: boolean;
  readonly isEnabledInHierarchy: boolean;
  getTransform(): Transform;
  setParent(parent: SceneObject | null): void;
  createComponent(type: string): any;
  getComponent(type: string): any;
  destroy(): void;
}

declare class Asset { name: string; }
declare class Pass {
  baseColor: vec4;
  twoSided: boolean;
  blendMode: BlendMode;
  depthTest: boolean;
  depthWrite: boolean;
}
declare class Material extends Asset { clone(): Material; mainPass: Pass; }
declare class Font extends Asset {}
declare class AudioTrackAsset extends Asset {}
declare class RenderMesh extends Asset {}

declare enum BlendMode { Normal, Add, PremultipliedAlpha, Disabled }
declare enum MeshTopology { Triangles, Lines, Points }
declare enum MeshIndexType { UInt16, None }
declare enum HorizontalAlignment { Left, Center, Right }
declare enum VerticalAlignment { Top, Center, Bottom }
declare enum HorizontalOverflow { Overflow, Truncate, Wrap, Shrink }
declare enum VerticalOverflow { Overflow, Truncate, Shrink }

declare class MeshBuilder {
  constructor(layout: { name: string; components: number; normalized?: boolean }[]);
  topology: MeshTopology;
  indexType: MeshIndexType;
  appendVerticesInterleaved(v: number[]): void;
  appendIndices(i: number[]): void;
  updateMesh(): void;
  getMesh(): RenderMesh;
}

declare class Visual extends Component { setRenderOrder(order: number): void; renderOrder: number; }
declare class Rect { static create(left: number, right: number, bottom: number, top: number): Rect; }
declare class RenderMeshVisual extends Visual { mesh: RenderMesh; mainMaterial: Material; }
declare class TextFill { color: vec4; }
declare class OutlineSettings { enabled: boolean; size: number; fill: TextFill; }
declare class Text extends Visual {
  text: string;
  outlineSettings: OutlineSettings;
  size: number;
  font: Font;
  horizontalAlignment: HorizontalAlignment;
  verticalAlignment: VerticalAlignment;
  horizontalOverflow: HorizontalOverflow;
  verticalOverflow: VerticalOverflow;
  textFill: TextFill;
  /** Defaults to false in Lens Studio. */
  depthTest: boolean;
  layoutRect: Rect;
  worldSpaceRect: Rect;
}

declare class Shape {
  static createSphereShape(): SphereShape;
  static createBoxShape(): BoxShape;
}
declare class SphereShape extends Shape { radius: number; }
declare class BoxShape extends Shape { size: vec3; }
/** Assigning `shape` resets `fitVisual` to true. */
declare class ColliderComponent extends Component { shape: Shape; fitVisual: boolean; debugDrawEnabled: boolean; }

declare class SpatialAudio { enabled: boolean; positionEffect: { enabled: boolean }; }
declare namespace Audio { enum PlaybackMode { LowPower, LowLatency } }
declare class AudioComponent extends Component {
  audioTrack: AudioTrackAsset;
  /** Specs default: LowPower (adds latency). */
  playbackMode: Audio.PlaybackMode;
  volume: number;
  spatialAudio: SpatialAudio;
  play(loops: number): void;
  stop(fade: boolean): void;
  isPlaying(): boolean;
}

declare const global: { scene: { createSceneObject(name: string): SceneObject }; [key: string]: any };
declare function getTime(): number;
declare function print(message: unknown): void;

// Lens Studio TypeScript decorators.
declare function component(target: any): any;
declare function input(target: any, key: string): void;
declare function hint(text: string): (target: any, key: string) => void;
declare function allowUndefined(target: any, key: string): void;

// Spectacles Interaction Kit (package path as installed by the SPECS Base Template).
declare module "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable" {
  export class Interactable extends ScriptComponent {
    static getTypeName(): string;
    onTriggerEnd: { add(cb: (e: any) => void): void };
  }
}
